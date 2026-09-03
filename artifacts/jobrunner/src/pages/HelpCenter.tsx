import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  PlayCircle,
  Briefcase,
  FileText,
  Users,
  DollarSign,
  Settings,
  HelpCircle,
  MessageCircle,
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// ─── types ────────────────────────────────────────────────────────────────────

interface HelpCategory {
  id: string;
  label: string;
  icon: string;
}

interface HelpArticle {
  id: string;
  category: string;
  title: string;
  body: string;
  summary: string;
  deeplink?: string;
  mobileDeeplink?: string;
}

interface HelpData {
  categories: HelpCategory[];
  articles: HelpArticle[];
}

interface RelatedArticle {
  id: string;
  title: string;
  summary: string;
  deeplink?: string;
  mobileDeeplink?: string;
}

interface HelpChatMessage {
  role: "user" | "assistant";
  content: string;
  relatedArticles?: RelatedArticle[];
  deeplink?: string;
  confidence?: "high" | "medium" | "low";
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "getting-started": <PlayCircle className="h-4 w-4" />,
  jobs: <Briefcase className="h-4 w-4" />,
  "quotes-invoices": <FileText className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  payments: <DollarSign className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

/**
 * Very lightweight markdown renderer — handles headings, bold, tables, lists,
 * and paragraphs without pulling in a library.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (s: string): React.ReactNode => {
    // Bold **text**
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, idx) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={idx}>{p.slice(2, -2)}</strong>
      ) : (
        p
      ),
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">
          {line.slice(3)}
        </h2>,
      );
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      nodes.push(
        <h1 key={i} className="text-lg font-bold mt-4 mb-2 text-foreground">
          {line.slice(2)}
        </h1>,
      );
      i++;
      continue;
    }

    // Table row (starts with |)
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Filter out separator rows (|---|---|)
      const dataRows = tableLines.filter((l) => !/^\|[-| ]+\|$/.test(l));
      const [header, ...body] = dataRows;
      const parseCells = (row: string) =>
        row
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());

      nodes.push(
        <div key={`tbl-${i}`} className="my-3 overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr>
                {parseCells(header).map((cell, ci) => (
                  <th
                    key={ci}
                    className="text-left px-3 py-1.5 bg-muted font-medium border border-border rounded"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b border-border">
                  {parseCells(row).map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-muted-foreground align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Numbered list
    if (/^\d+\./.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\d+\./.test(lines[i])) {
        listLines.push(lines[i].replace(/^\d+\.\s*/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 text-sm text-muted-foreground">
          {listLines.map((item, li) => (
            <li key={li}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Bullet list
    if (line.startsWith("- ")) {
      const listLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        listLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-sm text-muted-foreground">
          {listLines.map((item, li) => (
            <li key={li}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Normal paragraph
    nodes.push(
      <p key={i} className="text-sm text-muted-foreground leading-relaxed my-1.5">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return nodes;
}

// ─── Help Chat ────────────────────────────────────────────────────────────────

const HELP_CHAT_STARTERS = [
  "How do I create a quote?",
  "How do I add a team member?",
  "Where do I find my invoices?",
  "How do I set up payments?",
];

function HelpChat({
  onNavigate,
  onViewArticle,
}: {
  onNavigate: (path: string) => void;
  onViewArticle: (article: HelpArticle) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<HelpChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: async ({ message, history }: { message: string; history: HelpChatMessage[] }) => {
      const res = await apiRequest("POST", "/api/help/chat", {
        message,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      });
      return res.json();
    },
    onSuccess: (data, { message }) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: message },
        {
          role: "assistant",
          content: data.response,
          relatedArticles: data.relatedArticles ?? [],
          deeplink: data.deeplink,
          confidence: data.confidence,
        },
      ]);
      setInputValue("");
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again or contact support at admin@avwebinnovation.com.",
          confidence: "low",
        },
      ]);
      setInputValue("");
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  const handleSend = () => {
    const msg = inputValue.trim();
    if (!msg || chatMutation.isPending) return;
    chatMutation.mutate({ message: msg, history: messages });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStarter = (text: string) => {
    chatMutation.mutate({ message: text, history: [] });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0"
        style={{ backgroundColor: "hsl(var(--primary) / 0.04)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "hsl(var(--primary) / 0.12)",
            border: "1px solid hsl(var(--primary) / 0.2)",
          }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-none">Help Assistant</p>
          <p className="text-xs text-muted-foreground mt-0.5">App usage questions only</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask me anything about how to use JobRunner. I can help with features, settings, and workflows.
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
              {HELP_CHAT_STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStarter(s)}
                  disabled={chatMutation.isPending}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted/60 transition-colors text-foreground"
                  data-testid={`help-chat-starter-${s.slice(0, 20)}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className="space-y-2">
                <div
                  className={cn(
                    "px-3 py-2.5 rounded-xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-muted ml-6 text-foreground"
                      : "mr-6 text-foreground",
                  )}
                  style={
                    msg.role === "assistant"
                      ? {
                          backgroundColor: "hsl(var(--primary) / 0.05)",
                          border: "1px solid hsl(var(--primary) / 0.1)",
                        }
                      : {}
                  }
                >
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">
                    {msg.role === "user" ? "You" : "Help Assistant"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                  {/* Deeplink button */}
                  {msg.role === "assistant" && msg.deeplink && (
                    <button
                      onClick={() => onNavigate(msg.deeplink!)}
                      className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <ArrowRight className="h-3 w-3" />
                      Take me there
                    </button>
                  )}

                  {/* Low confidence fallback */}
                  {msg.role === "assistant" && msg.confidence === "low" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Not sure about this one. Try{" "}
                      <button
                        onClick={() => window.open("mailto:admin@avwebinnovation.com")}
                        className="text-primary hover:underline font-medium"
                      >
                        contacting support
                      </button>{" "}
                      if you need more help.
                    </p>
                  )}
                </div>

                {/* Related articles */}
                {msg.role === "assistant" &&
                  msg.relatedArticles &&
                  msg.relatedArticles.length > 0 && (
                    <div className="mr-6 space-y-1">
                      <p className="text-xs text-muted-foreground px-1">Related articles:</p>
                      {msg.relatedArticles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => onViewArticle(article as HelpArticle)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-muted/60 transition-colors border border-border group"
                        >
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground group-hover:text-primary transition-colors flex-1 min-w-0 truncate">
                            {article.title}
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {/* Thinking indicator */}
            {chatMutation.isPending && (
              <div
                className="mr-6 px-3 py-2.5 rounded-xl flex items-center gap-2 text-sm text-muted-foreground"
                style={{
                  backgroundColor: "hsl(var(--primary) / 0.05)",
                  border: "1px solid hsl(var(--primary) / 0.1)",
                }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                Thinking...
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about JobRunner..."
            disabled={chatMutation.isPending}
            className="flex-1 text-sm"
            data-testid="help-chat-input"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || chatMutation.isPending}
            className="shrink-0"
            data-testid="help-chat-send"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── sub-views ────────────────────────────────────────────────────────────────

function ArticleDetail({
  article,
  onBack,
  onNavigate,
}: {
  article: HelpArticle;
  onBack: () => void;
  onNavigate: (path: string) => void;
}) {
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) =>
      apiRequest("POST", `/api/help/articles/${article.id}/feedback`, { helpful }),
  });

  const handleFeedback = (helpful: boolean) => {
    if (feedback) return;
    setFeedback(helpful ? "yes" : "no");
    feedbackMutation.mutate(helpful);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to articles
      </button>

      <h2 className="text-lg font-semibold text-foreground mb-4 leading-snug">
        {article.title}
      </h2>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="prose-sm pb-8">
          {renderMarkdown(article.body)}

          {/* Deeplink button */}
          {article.deeplink && (
            <Button
              variant="outline"
              size="sm"
              className="mt-6 gap-2"
              onClick={() => {
                onNavigate(article.deeplink!);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Take me there
            </Button>
          )}
        </div>
      </ScrollArea>

      {/* Feedback */}
      <div className="border-t border-border pt-4 mt-2">
        {!feedback ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Was this helpful?</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => handleFeedback(true)}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Yes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => handleFeedback(false)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              No
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {feedback === "yes"
              ? "Thanks for the feedback!"
              : "Thanks, we will work on improving this."}
          </p>
        )}
      </div>
    </div>
  );
}

function ArticleList({
  articles,
  onSelect,
}: {
  articles: HelpArticle[];
  onSelect: (article: HelpArticle) => void;
}) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <HelpCircle className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No articles found</p>
        <p className="text-sm text-muted-foreground">
          Try different keywords, or contact support.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 mt-2"
          onClick={() => window.open("mailto:admin@avwebinnovation.com")}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Contact support
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {articles.map((article) => (
        <button
          key={article.id}
          onClick={() => onSelect(article)}
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left hover:bg-muted/60 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
              {article.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground transition-colors" />
        </button>
      ))}
    </div>
  );
}

// ─── main panel ───────────────────────────────────────────────────────────────

interface HelpCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current page route — used to pre-select the most relevant category */
  currentRoute?: string;
}

const ROUTE_TO_CATEGORY: Record<string, string> = {
  "/jobs": "jobs",
  "/quotes": "quotes-invoices",
  "/invoices": "quotes-invoices",
  "/clients": "getting-started",
  "/settings": "settings",
  "/integrations": "settings",
  "/dispatch": "team",
  "/calendar": "jobs",
  "/map": "team",
  "/reports": "payments",
  "/": "getting-started",
};

type PanelTab = "articles" | "chat";

export default function HelpCenter({
  open,
  onOpenChange,
  currentRoute,
}: HelpCenterProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<PanelTab>("articles");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // Pre-select category based on current route
  const initialCategory = useMemo(() => {
    if (!currentRoute) return "all";
    for (const [prefix, cat] of Object.entries(ROUTE_TO_CATEGORY)) {
      if (currentRoute.startsWith(prefix) && prefix !== "/") return cat;
    }
    return ROUTE_TO_CATEGORY["/"] ?? "all";
  }, [currentRoute]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveCategory(initialCategory);
      setSelectedArticle(null);
      setActiveTab("articles");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
  };

  const { data, isLoading } = useQuery<HelpData>({
    queryKey: ["/api/help/articles"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const categories = data?.categories ?? [];
  const allArticles = data?.articles ?? [];

  const filteredArticles = useMemo(() => {
    let list = allArticles;
    if (activeCategory !== "all") {
      list = list.filter((a) => a.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.body.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allArticles, activeCategory, search]);

  const handleNavigate = (path: string) => {
    setLocation(path);
    onOpenChange(false);
  };

  const handleViewArticle = (article: HelpArticle) => {
    setSelectedArticle(article);
    setActiveTab("articles");
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        data-testid="help-center-panel"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Help Center
          </SheetTitle>

          {/* Tab selector */}
          <div className="flex gap-1 mt-3 p-1 rounded-lg bg-muted">
            <button
              onClick={() => { setActiveTab("articles"); setSelectedArticle(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === "articles"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="help-tab-articles"
            >
              <FileText className="h-3.5 w-3.5" />
              Articles
            </button>
            <button
              onClick={() => { setActiveTab("chat"); setSelectedArticle(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid="help-tab-chat"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask AI
            </button>
          </div>
        </SheetHeader>

        {/* ─── Chat tab ─── */}
        {activeTab === "chat" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <HelpChat onNavigate={handleNavigate} onViewArticle={handleViewArticle} />
          </div>
        )}

        {/* ─── Articles tab ─── */}
        {activeTab === "articles" && (
          <>
            {/* Search — hidden when viewing article */}
            {!selectedArticle && (
              <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search articles..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (e.target.value) setActiveCategory("all");
                      setSelectedArticle(null);
                    }}
                    className="pl-9"
                    data-testid="help-search-input"
                  />
                </div>
              </div>
            )}

            {/* Category tabs — hidden when article detail is shown */}
            {!selectedArticle && (
              <div className="px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
                <div className="flex gap-1.5 min-w-max">
                  <button
                    onClick={() => setActiveCategory("all")}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                      activeCategory === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setSearch("");
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                        activeCategory === cat.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {CATEGORY_ICONS[cat.id]}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-hidden px-4 py-4">
              {selectedArticle ? (
                <ArticleDetail
                  article={selectedArticle}
                  onBack={() => setSelectedArticle(null)}
                  onNavigate={handleNavigate}
                />
              ) : isLoading ? (
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-14 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-full -mx-1 px-1">
                  <ArticleList
                    articles={filteredArticles}
                    onSelect={setSelectedArticle}
                  />

                  {/* Contact footer */}
                  {filteredArticles.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground text-center">
                        Still need help?{" "}
                        <button
                          onClick={() =>
                            window.open("mailto:admin@avwebinnovation.com")
                          }
                          className="text-primary hover:underline font-medium"
                        >
                          Contact support
                        </button>
                        {" "}or{" "}
                        <button
                          onClick={() => setActiveTab("chat")}
                          className="text-primary hover:underline font-medium"
                        >
                          ask the Help Assistant
                        </button>
                      </p>
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
