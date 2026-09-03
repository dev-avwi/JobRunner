import { useState, useMemo, useEffect } from "react";
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

export default function HelpCenter({
  open,
  onOpenChange,
  currentRoute,
}: HelpCenterProps) {
  const [, setLocation] = useLocation();
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

  // Reset state whenever the panel transitions from closed → open so the
  // context-appropriate category is applied regardless of how `open` is set
  // (e.g. from the parent directly setting the prop vs. Sheet's own handler).
  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveCategory(initialCategory);
      setSelectedArticle(null);
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

          {/* Search */}
          <div className="relative mt-2">
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
        </SheetHeader>

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
                  </p>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
