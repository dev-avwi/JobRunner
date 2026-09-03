/**
 * Help centre routes
 *   GET  /api/help/articles       – returns the seeded article list
 *   POST /api/help/articles/:id/feedback – logs a helpful/not-helpful vote
 */
import type { Express } from "express";
import { requireAuth } from "./middleware";
import { logger } from "../logger";
import { HELP_ARTICLES, HELP_CATEGORIES } from "./helpArticles";

export function registerHelpRoutes(app: Express): void {
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
