/**
 * Help centre routes
 *   GET  /api/help/articles             – returns the seeded article list
 *   POST /api/help/articles/:id/feedback – logs a helpful/not-helpful vote
 *   POST /api/help/chat                 – AI help assistant (app-usage questions only)
 */
import type { Express } from "express";
import { requireAuth, aiPerUserLimiter } from "./middleware";
import { logger } from "../logger";
import { HELP_ARTICLES, HELP_CATEGORIES } from "./helpArticles";
import OpenAI from "openai";
import { aiQueue, isBackpressure, send429 } from "../concurrency";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Build a compact knowledge base from all help articles to inject into the system prompt.
function buildKnowledgeBase(): string {
  return HELP_ARTICLES.map((a) => {
    const lines = [`### ${a.title}`, `Category: ${a.category}`, a.body.trim()];
    if (a.deeplink) lines.push(`Web link: ${a.deeplink}`);
    if (a.mobileDeeplink) lines.push(`Mobile link: ${a.mobileDeeplink}`);
    return lines.join('\n');
  }).join('\n\n---\n\n');
}

const KNOWLEDGE_BASE = buildKnowledgeBase();

const HELP_SYSTEM_PROMPT = `You are the Help Assistant for JobRunner, a field-service management app for trade businesses (plumbing, electrical, HVAC, landscaping, etc.).

Your ONLY job is to answer questions about how to USE the JobRunner app — features, navigation, workflows, settings, and troubleshooting. You must NOT answer questions about the user's actual business data (their specific jobs, clients, invoices, payments, etc.) — that is handled by a separate AI Assistant.

## Rules
1. Only answer app-usage questions based on the knowledge base below.
2. If a question is about the user's own business data (e.g. "how much have I earned?", "what jobs do I have today?"), politely explain that this Help Assistant covers app features only and they should use the AI Assistant tab for business questions.
3. If you cannot find the answer in the knowledge base, say so honestly and suggest the most relevant article or email support (admin@avwebinnovation.com).
4. Do NOT make up features that are not in the knowledge base.
5. Keep answers concise and practical — plain language, no jargon.
6. When relevant, include a "deeplink" field in your JSON response pointing to the relevant app page.
7. Never use em dashes (—) in your responses; use commas, colons, or rewrite the sentence instead.

## Response format (JSON)
Always respond with valid JSON matching this schema:
{
  "response": "Your answer here (plain text, no markdown)",
  "relatedArticleIds": ["article-id-1", "article-id-2"],  // up to 3 most relevant article IDs from the knowledge base
  "deeplink": "/web-route",         // optional: most relevant web route for this question
  "mobileDeeplink": "/mobile-route", // optional: most relevant mobile route
  "confidence": "high" | "medium" | "low"  // how confident you are in the answer
}

## JobRunner Knowledge Base

${KNOWLEDGE_BASE}
`;

interface HelpChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HelpChatRequest {
  message: string;
  history?: HelpChatMessage[];
}

interface HelpChatResponse {
  response: string;
  relatedArticles: Array<{
    id: string;
    title: string;
    summary: string;
    deeplink?: string;
    mobileDeeplink?: string;
  }>;
  deeplink?: string;
  mobileDeeplink?: string;
  confidence: 'high' | 'medium' | 'low';
}

async function callHelpAI(message: string, history: HelpChatMessage[]): Promise<HelpChatResponse> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: HELP_SYSTEM_PROMPT },
    // Include up to the last 6 turns of conversation history for context
    ...history.slice(-6).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { response: raw, confidence: 'low' };
  }

  // Resolve article IDs to full article objects
  const relatedArticleIds: string[] = Array.isArray(parsed.relatedArticleIds)
    ? parsed.relatedArticleIds.slice(0, 3)
    : [];
  const relatedArticles = relatedArticleIds
    .map((id: string) => HELP_ARTICLES.find((a) => a.id === id))
    .filter(Boolean)
    .map((a: any) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      deeplink: a.deeplink,
      mobileDeeplink: a.mobileDeeplink,
    }));

  return {
    response: typeof parsed.response === 'string' ? parsed.response : 'Sorry, I could not find an answer. Please try rephrasing or contact support.',
    relatedArticles,
    deeplink: parsed.deeplink ?? undefined,
    mobileDeeplink: parsed.mobileDeeplink ?? undefined,
    confidence: parsed.confidence ?? 'medium',
  };
}

export function registerHelpRoutes(app: Express): void {
  // ─── Help chat (AI) ─────────────────────────────────────────────────────────

  app.post("/api/help/chat", requireAuth, aiPerUserLimiter, async (req: any, res) => {
    try {
      const { message, history = [] } = req.body as HelpChatRequest;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: "message is required" });
      }

      if (message.trim().length > 1000) {
        return res.status(400).json({ error: "Message too long (max 1000 characters)" });
      }

      const result = await aiQueue.run(() => callHelpAI(message.trim(), history));

      if (!result) {
        return res.status(503).json({ error: "Service busy, please try again" });
      }

      logger.info('api', '[help/chat] request', {
        userId: req.userId,
        metadata: { confidence: result.confidence, relatedCount: result.relatedArticles.length },
      });

      res.json(result);
    } catch (err: any) {
      if (isBackpressure(err)) return send429(res, err);
      logger.error('api', '[help/chat] error', { error: err });
      res.status(500).json({ error: "Failed to process help request" });
    }
  });

  // ─── Articles list ───────────────────────────────────────────────────────────

  // Public endpoint — help articles are not sensitive.
  app.get("/api/help/articles", async (req: any, res) => {
    try {
      const { category, q } = req.query as { category?: string; q?: string };

      let articles = HELP_ARTICLES;

      if (category && category !== 'all') {
        articles = articles.filter((a) => a.category === category);
      }

      if (q) {
        const lower = q.toLowerCase();
        articles = articles.filter(
          (a) =>
            a.title.toLowerCase().includes(lower) ||
            a.summary.toLowerCase().includes(lower) ||
            a.body.toLowerCase().includes(lower),
        );
      }

      res.json({ categories: HELP_CATEGORIES, articles });
    } catch (err: any) {
      logger.error('api', '[help] articles list error', { error: err });
      res.status(500).json({ error: "Failed to load help articles" });
    }
  });

  // Accepts both authenticated and anonymous feedback (works in web + mobile).
  app.post("/api/help/articles/:id/feedback", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { helpful } = req.body as { helpful: boolean };

      if (typeof helpful !== "boolean") {
        return res.status(400).json({ error: "helpful must be a boolean" });
      }

      const article = HELP_ARTICLES.find((a) => a.id === id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }

      const userId = req.userId ?? undefined;

      logger.info('api', '[help] article feedback received', {
        userId,
        metadata: { articleId: id, articleTitle: article.title, helpful },
      });

      res.json({ ok: true });
    } catch (err: any) {
      logger.error('api', '[help] feedback error', { error: err });
      res.status(500).json({ error: "Failed to record feedback" });
    }
  });
}
