import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search, FileText, Receipt, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type DateRangeKey = "30d" | "90d" | "ytd" | "all";

const DATE_RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "This year" },
  { key: "all", label: "All" },
];

const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "VOIDED"] as const;
const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"] as const;

// Map UI labels to Xero status codes (Xero uses SUBMITTED/AUTHORISED for "sent" invoices)
const INVOICE_STATUS_TO_XERO: Record<string, string[]> = {
  DRAFT: ["DRAFT"],
  SENT: ["SUBMITTED", "AUTHORISED"],
  PAID: ["PAID"],
  VOIDED: ["VOIDED"],
};

const QUOTE_STATUS_TO_XERO: Record<string, string[]> = {
  DRAFT: ["DRAFT"],
  SENT: ["SENT"],
  ACCEPTED: ["ACCEPTED"],
  DECLINED: ["DECLINED"],
};

function rangeToFromIso(key: DateRangeKey): string | undefined {
  const now = new Date();
  if (key === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  if (key === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d.toISOString();
  }
  if (key === "ytd") {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }
  return undefined;
}

const LS_KEY = "jr.xeroSyncManager.lastTab.v1";

interface PersistedTab {
  direction: "pull" | "push";
  docType: "invoices" | "quotes";
}

function loadPersistedTab(): PersistedTab | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      (parsed?.direction === "pull" || parsed?.direction === "push") &&
      (parsed?.docType === "invoices" || parsed?.docType === "quotes")
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function persistTab(tab: PersistedTab) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tab));
  } catch {}
}

function buildXeroDeepLink(
  docType: "invoices" | "quotes",
  xeroId: string,
  shortCode: string | null | undefined,
): string {
  // When we know the tenant short code, deep-link straight into the right org
  // so users with multiple Xero organisations skip the org-switcher.
  const path = docType === "invoices" ? "invoicing" : "quotes";
  if (shortCode) {
    return `https://go.xero.com/app/!${shortCode}/${path}/view/${xeroId}`;
  }
  return `https://go.xero.com/app/${path}/view/${xeroId}`;
}

interface XeroTenantInfo {
  shortCode: string | null;
  tenantName: string | null;
  tenantId: string;
}

interface ClientLite {
  id: string;
  name: string;
}

type Direction = "pull" | "push";
type DocType = "invoices" | "quotes";

interface BrowseRow {
  xeroId: string;
  number: string | null;
  reference: string | null;
  status: string | null;
  contactName: string | null;
  contactId: string | null;
  date: string | null;
  total: number;
  currency: string | null;
  alreadyImported: boolean;
}

interface PreviewLineItem {
  description: string | null;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  taxAmount: number;
  accountCode: string | null;
}

interface PreviewDoc {
  xeroId: string;
  type: "invoice" | "quote";
  number: string | null;
  reference: string | null;
  status: string | null;
  contactName: string | null;
  date: string | null;
  dueDate: string | null;
  expiryDate: string | null;
  subtotal: number;
  totalTax: number;
  total: number;
  currency: string | null;
  lineItems: PreviewLineItem[];
  alreadyImported: boolean;
}

interface LocalRow {
  id: string;
  number: string | null;
  status: string | null;
  clientName: string | null;
  total: number;
  date: string | null;
  alreadyPushed: boolean;
}

interface LocalPreview {
  id: string;
  number: string | null;
  status: string | null;
  clientName: string | null;
  date: string | null;
  total: number;
  subtotal: number;
  gstAmount: number;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  alreadyPushed: boolean;
  pushedAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtMoney(n: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return format(new Date(s), "d MMM yyyy");
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const s = status.toUpperCase();
  const color =
    s === "PAID" || s === "ACCEPTED"
      ? "default"
      : s === "VOIDED" || s === "DELETED" || s === "DECLINED"
      ? "destructive"
      : s === "DRAFT"
      ? "secondary"
      : "outline";
  return (
    <Badge variant={color as any} className="text-xs">
      {s}
    </Badge>
  );
}

export function XeroSyncManager({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const initialTab = loadPersistedTab();
  const [direction, setDirection] = useState<Direction>(initialTab?.direction ?? "pull");
  const [docType, setDocType] = useState<DocType>(initialTab?.docType ?? "invoices");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeKey>("90d");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Persist active tab
  useEffect(() => {
    persistTab({ direction, docType });
  }, [direction, docType]);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelected(new Set());
    setActivePreviewId(null);
    setSearch("");
    setStatusFilters(new Set());
  }, [direction, docType, open]);

  // Reset selection when filters change
  useEffect(() => {
    setSelected(new Set());
    setActivePreviewId(null);
  }, [dateRange, statusFilters]);

  const isXero = direction === "pull";

  // Tenant info for deep-linking with short code
  const tenantInfoQ = useQuery<XeroTenantInfo>({
    queryKey: ["/api/integrations/xero/tenant-info"],
    enabled: open,
    staleTime: 30 * 60_000,
    retry: false,
  });
  const shortCode = tenantInfoQ.data?.shortCode || null;

  // Local clients (used to estimate new clients that will be created on bulk pull)
  const clientsQ = useQuery<ClientLite[]>({
    queryKey: ["/api/clients"],
    enabled: open && isXero,
    staleTime: 60_000,
    retry: false,
  });
  const existingClientNames = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientsQ.data || []) {
      if (c?.name) set.add(c.name.trim().toLowerCase());
    }
    return set;
  }, [clientsQ.data]);

  // Build the Xero status query string from selected UI status chips
  const xeroStatusParam = useMemo(() => {
    if (!isXero || statusFilters.size === 0) return undefined;
    const map = docType === "invoices" ? INVOICE_STATUS_TO_XERO : QUOTE_STATUS_TO_XERO;
    const codes: string[] = [];
    for (const s of Array.from(statusFilters)) {
      for (const c of map[s] || []) codes.push(c);
    }
    return codes.length ? codes.join(",") : undefined;
  }, [isXero, statusFilters, docType]);

  const fromIso = isXero ? rangeToFromIso(dateRange) : undefined;

  // ── Browse list (Xero side for pull, local side for push) ─────────────────
  const browseQ = useQuery<{ rows: BrowseRow[] } | { rows: LocalRow[] }>({
    queryKey: isXero
      ? [
          `/api/integrations/xero/browse/${docType}`,
          { from: fromIso ?? null, status: xeroStatusParam ?? null },
        ]
      : [`/api/integrations/xero/local/${docType}`],
    enabled: open,
    staleTime: 30_000,
    retry: false,
  });

  const rows: Array<BrowseRow | LocalRow> = (browseQ.data as any)?.rows || [];

  // Status chip filter for the Push (local) side: client-side only
  const statusFilteredRows = useMemo(() => {
    if (isXero || statusFilters.size === 0) return rows;
    const lc = new Set(Array.from(statusFilters).map(s => s.toLowerCase()));
    return rows.filter((r: any) => {
      const s = (r.status || "").toString().toLowerCase();
      return lc.has(s);
    });
  }, [rows, isXero, statusFilters]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statusFilteredRows;
    // Money search: strip $ and commas, parse as number
    const numCandidate = q.replace(/[$,\s]/g, "");
    const numeric = numCandidate.length > 0 && /^\d+(\.\d+)?$/.test(numCandidate)
      ? parseFloat(numCandidate)
      : null;
    return statusFilteredRows.filter((r: any) => {
      const totalNum = typeof r.total === "number" ? r.total : parseFloat(r.total ?? "0");
      const totalRaw = String(totalNum);
      const totalFmt = totalNum.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (
        (r.number || "").toLowerCase().includes(q) ||
        (r.contactName || r.clientName || "").toLowerCase().includes(q) ||
        (r.reference || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q) ||
        totalRaw.includes(numCandidate) ||
        totalFmt.toLowerCase().includes(q)
      ) {
        return true;
      }
      if (numeric !== null && Math.abs(totalNum - numeric) < 0.005) return true;
      return false;
    });
  }, [statusFilteredRows, search]);

  // Auto-select first row for preview
  useEffect(() => {
    if (!activePreviewId && filteredRows.length > 0) {
      const first: any = filteredRows[0];
      setActivePreviewId(isXero ? first.xeroId : first.id);
    }
  }, [filteredRows, activePreviewId, isXero]);

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewQ = useQuery<PreviewDoc | LocalPreview>({
    queryKey: [
      isXero
        ? `/api/integrations/xero/preview/${docType === "invoices" ? "invoice" : "quote"}/${activePreviewId}`
        : `/api/integrations/xero/local-preview/${docType === "invoices" ? "invoice" : "quote"}/${activePreviewId}`,
    ],
    enabled: open && !!activePreviewId,
    staleTime: 60_000,
    retry: false,
  });

  // ── Sync action ───────────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const path = isXero
        ? `/api/integrations/xero/pull-${docType}`
        : `/api/integrations/xero/push-selected-${docType}`;
      const resp = await apiRequest("POST", path, { ids });
      return resp.json();
    },
    onSuccess: (data: any) => {
      const verb = isXero ? "Imported" : "Pushed";
      const count = isXero ? data.imported : data.pushed;
      const skipped = data.skipped || 0;
      const failed = data.failed || 0;
      toast({
        title: `${verb} ${count} ${docType.slice(0, -1)}${count !== 1 ? "s" : ""}`,
        description: [
          skipped > 0 && `${skipped} skipped (already synced)`,
          failed > 0 && `${failed} failed`,
        ]
          .filter(Boolean)
          .join(" · ") || "Done.",
        variant: failed > 0 ? "destructive" : "default",
      });
      setSelected(new Set());
      browseQ.refetch();
      // Invalidate consumers so the affected pages refresh
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: (err: any) => {
      toast({
        title: "Sync failed",
        description: err?.message || "Could not complete the sync.",
        variant: "destructive",
      });
    },
  });

  const toggleAll = () => {
    if (selected.size === filteredRows.length) {
      setSelected(new Set());
    } else {
      const ids = filteredRows.map((r: any) => (isXero ? r.xeroId : r.id));
      setSelected(new Set(ids));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const isAlreadySynced = (r: any) => (isXero ? r.alreadyImported : r.alreadyPushed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Xero Sync Manager
          </DialogTitle>
          <DialogDescription>
            Pick exactly which quotes and invoices to pull from Xero or push to Xero. See a live preview before syncing.
          </DialogDescription>
        </DialogHeader>

        {/* Direction + DocType tabs */}
        <div className="px-6 pb-3 flex flex-wrap items-center gap-3">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList>
              <TabsTrigger value="pull" data-testid="tab-pull">
                <ArrowDownToLine className="w-4 h-4 mr-1.5" /> Pull from Xero
              </TabsTrigger>
              <TabsTrigger value="push" data-testid="tab-push">
                <ArrowUpFromLine className="w-4 h-4 mr-1.5" /> Push to Xero
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <TabsList>
              <TabsTrigger value="invoices" data-testid="tab-invoices">
                <Receipt className="w-4 h-4 mr-1.5" /> Invoices
              </TabsTrigger>
              <TabsTrigger value="quotes" data-testid="tab-quotes">
                <FileText className="w-4 h-4 mr-1.5" /> Quotes
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 min-w-48 relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by number, reference, contact, amount…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-xero-sync"
            />
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="px-6 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {isXero && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Date:</span>
              {DATE_RANGES.map((r) => {
                const active = dateRange === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setDateRange(r.key)}
                    className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`chip-date-${r.key}`}
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                    >
                      {r.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Status:</span>
            {(docType === "invoices" ? INVOICE_STATUSES : QUOTE_STATUSES).map((s) => {
              const active = statusFilters.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const next = new Set(statusFilters);
                    if (next.has(s)) next.delete(s); else next.add(s);
                    setStatusFilters(next);
                  }}
                  className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`chip-status-${s.toLowerCase()}`}
                >
                  <Badge
                    variant={active ? "default" : "outline"}
                    className="cursor-pointer text-xs capitalize"
                  >
                    {s.toLowerCase()}
                  </Badge>
                </button>
              );
            })}
            {statusFilters.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setStatusFilters(new Set())}
                data-testid="chip-status-clear"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Two-pane: list (left) | preview (right) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] min-h-0">
          {/* List */}
          <div className="border-r flex flex-col min-h-0">
            <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    filteredRows.length > 0 &&
                    selected.size === filteredRows.length
                  }
                  onCheckedChange={toggleAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-xs text-muted-foreground">
                  {selected.size} selected · {filteredRows.length} shown
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => browseQ.refetch()}
                disabled={browseQ.isFetching}
                data-testid="button-refresh-list"
              >
                {browseQ.isFetching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {browseQ.isLoading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : browseQ.error ? (
                <div className="p-6 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 inline mr-1.5" />
                  {(browseQ.error as any).message || "Could not load list"}
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  {search ? "No matches." : "Nothing to sync here."}
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredRows.map((r: any) => {
                    const id = isXero ? r.xeroId : r.id;
                    const synced = isAlreadySynced(r);
                    const isActive = activePreviewId === id;
                    return (
                      <li
                        key={id}
                        className={`px-3 py-2.5 cursor-pointer hover-elevate ${
                          isActive ? "bg-muted/60" : ""
                        }`}
                        onClick={() => setActivePreviewId(id)}
                        data-testid={`row-${id}`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-1"
                            checked={selected.has(id)}
                            onCheckedChange={() => toggle(id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={synced}
                            data-testid={`checkbox-${id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {r.number || "(no number)"}
                              </span>
                              <StatusBadge status={r.status} />
                              {synced && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {isXero ? "Already imported" : "Already pushed"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {r.contactName || r.clientName || "No client"} · {fmtDate(r.date)}
                            </div>
                          </div>
                          <div className="text-sm font-medium tabular-nums">
                            {fmtMoney(r.total, (r as any).currency)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Preview pane */}
          <div className="flex flex-col min-h-0 bg-muted/10">
            {!activePreviewId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a {docType.slice(0, -1)} to preview
              </div>
            ) : previewQ.isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : previewQ.error ? (
              <div className="p-6 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 inline mr-1.5" />
                Could not load preview.
              </div>
            ) : previewQ.data ? (
              <ScrollArea className="flex-1">
                <PreviewBody
                  doc={previewQ.data as any}
                  isXero={isXero}
                  docType={docType}
                  xeroLink={
                    isXero && activePreviewId
                      ? buildXeroDeepLink(docType, activePreviewId, shortCode)
                      : null
                  }
                />
              </ScrollArea>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between gap-3 bg-background">
          <div className="text-xs text-muted-foreground">
            {isXero
              ? "Imported items appear in Documents and won't duplicate on re-sync."
              : "Pushed items get a Xero ID and won't be re-pushed unless you delete it in Xero."}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-sync-manager"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (isXero && selected.size > 25) {
                  setConfirmOpen(true);
                } else {
                  syncMutation.mutate();
                }
              }}
              disabled={selected.size === 0 || syncMutation.isPending}
              data-testid="button-sync-selected"
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isXero ? (
                <ArrowDownToLine className="w-4 h-4 mr-2" />
              ) : (
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
              )}
              {isXero ? "Pull" : "Push"} {selected.size > 0 ? `${selected.size} ` : ""}
              {docType.slice(0, -1)}
              {selected.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Bulk pull confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk import from Xero</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {(() => {
                  const selRows = (rows as any[]).filter((r) =>
                    selected.has(isXero ? r.xeroId : r.id)
                  );
                  const uniqueContacts = Array.from(
                    new Set(
                      selRows
                        .map((r: any) => (r.contactName || r.clientName || "").trim())
                        .filter(Boolean) as string[]
                    )
                  );
                  const newContacts = uniqueContacts.filter(
                    (n) => !existingClientNames.has(n.toLowerCase())
                  );
                  const docNoun = docType.slice(0, -1);
                  const docLabel = `${selected.size} ${docNoun}${selected.size !== 1 ? "s" : ""}`;
                  const clientLabel = `${newContacts.length} new client${newContacts.length !== 1 ? "s" : ""}`;
                  const sample = newContacts.slice(0, 5);
                  return (
                    <>
                      <p>
                        This will create <strong>{docLabel}</strong> and{" "}
                        <strong>{clientLabel}</strong>
                        {clientsQ.isLoading ? " (estimating…)" : ""}. Continue?
                      </p>
                      {sample.length > 0 && (
                        <div>
                          <p className="text-muted-foreground">
                            New clients (showing {sample.length} of {newContacts.length}):
                          </p>
                          <ul className="list-disc pl-5 mt-1">
                            {sample.map((n) => (
                              <li key={n}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {newContacts.length === 0 && uniqueContacts.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          All {uniqueContacts.length} contacts already exist in JobRunner.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-bulk-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                syncMutation.mutate();
              }}
              data-testid="button-confirm-bulk-pull"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function PreviewBody({
  doc,
  isXero,
  docType,
  xeroLink,
}: {
  doc: PreviewDoc | LocalPreview;
  isXero: boolean;
  docType: DocType;
  xeroLink?: string | null;
}) {
  const isInvoice = docType === "invoices";
  const xDoc = doc as PreviewDoc;
  const lDoc = doc as LocalPreview;
  const lineItems = isXero ? xDoc.lineItems : lDoc.lineItems;
  const subtotal = isXero ? xDoc.subtotal : lDoc.subtotal;
  const tax = isXero ? xDoc.totalTax : lDoc.gstAmount;
  const total = doc.total;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {isInvoice ? "Invoice" : "Quote"}
          </div>
          <div className="text-xl font-semibold mt-0.5 truncate">
            {doc.number || "(no number)"}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5 truncate">
            {(isXero ? xDoc.contactName : lDoc.clientName) || "No client"}
          </div>
        </div>
        <div className="text-right space-y-1.5 flex flex-col items-end">
          <StatusBadge status={doc.status} />
          {xeroLink && (
            <a
              href={xeroLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid="link-open-in-xero"
            >
              <ExternalLink className="w-3 h-3" />
              Open in Xero
            </a>
          )}
          {isXero && xDoc.alreadyImported && (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" /> Already in JobRunner
            </Badge>
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Meta label="Date" value={fmtDate(doc.date)} />
        {isInvoice ? (
          <Meta label="Due" value={fmtDate((doc as any).dueDate)} />
        ) : (
          <Meta label="Expires" value={fmtDate((doc as any).expiryDate)} />
        )}
        {isXero && (xDoc as any).reference && (
          <Meta label="Reference" value={(xDoc as any).reference} className="col-span-2" />
        )}
        {!isXero && lDoc.pushedAt && (
          <Meta label="Pushed to Xero" value={fmtDate(lDoc.pushedAt)} className="col-span-2" />
        )}
      </div>

      <Separator />

      {/* Line items */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Line items ({lineItems.length})
        </div>
        {lineItems.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No line items.</div>
        ) : (
          <div className="rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-right px-3 py-2 font-medium w-16">Qty</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Unit</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li: any, i: number) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 align-top">
                      {li.description || <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(li.quantity).toFixed(li.quantity % 1 === 0 ? 0 : 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(Number(li.unitAmount ?? li.unitPrice ?? 0), (xDoc as any).currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmtMoney(Number(li.lineAmount ?? li.total ?? 0), (xDoc as any).currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{fmtMoney(subtotal, (xDoc as any).currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST</span>
            <span className="tabular-nums">{fmtMoney(tax, (xDoc as any).currency)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="tabular-nums">{fmtMoney(total, (xDoc as any).currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
