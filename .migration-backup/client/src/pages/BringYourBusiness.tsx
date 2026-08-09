import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SmartImportFlow } from "@/components/SmartImportFlow";
import { tradeCatalog, getTradeDefinition } from "@shared/tradeCatalog";
import { SiXero } from "react-icons/si";
import {
  Upload,
  FileText,
  ClipboardList,
  Building2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Shield,
  Rocket,
} from "lucide-react";

interface BringBusinessStatus {
  data: { completedImports: number; clientCount: number };
  documents: { count: number };
  forms: { count: number };
  accounting: { xeroConnected: boolean; quickbooksConnected: boolean };
  quickSetup: {
    tradeType: string | null;
    teamSize: string | null;
    defaultHourlyRate: string | null;
    calloutFee: string | null;
  };
}

function LaneDoneBadge({ done, label }: { done: boolean; label?: string }) {
  if (!done) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Optional
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      {label || "Done"}
    </Badge>
  );
}

/** Inline connect buttons for the accounting-first path. */
function AccountingConnectRow({
  xeroConnected,
  quickbooksConnected,
  onImported,
}: {
  xeroConnected: boolean;
  quickbooksConnected: boolean;
  onImported: () => void;
}) {
  const { toast } = useToast();

  // Real import action: pull clients (contacts) FROM Xero into the app.
  const importFromXero = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/xero/sync", { type: "contacts" });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Xero import finished",
        description: data?.message || "Your Xero contacts were imported as clients.",
      });
      onImported();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Xero import failed",
        description: error?.message || "Please try again from the Integrations page.",
      });
    },
  });

  const connect = useMutation({
    mutationFn: async (provider: "xero" | "quickbooks") => {
      const res = await apiRequest("POST", `/api/integrations/${provider}/connect`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({
          variant: "destructive",
          title: "Couldn't start connection",
          description: data?.message || "Please try again from the Integrations page.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error?.message || "Please try again from the Integrations page.",
      });
    },
  });

  return (
    <div className="flex gap-2 flex-wrap">
      {xeroConnected ? (
        <>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 h-8 px-3">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Xero connected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importFromXero.mutate()}
            disabled={importFromXero.isPending}
            data-testid="button-byb-import-xero-clients"
          >
            {importFromXero.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <SiXero className="h-4 w-4 mr-2 text-[#13B5EA]" />
            )}
            Import clients from Xero
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => connect.mutate("xero")}
          disabled={connect.isPending}
          data-testid="button-byb-connect-xero"
        >
          {connect.isPending && connect.variables === "xero" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <SiXero className="h-4 w-4 mr-2 text-[#13B5EA]" />
          )}
          Connect Xero
        </Button>
      )}
      {quickbooksConnected ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 h-8 px-3">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          QuickBooks connected
        </Badge>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => connect.mutate("quickbooks")}
          disabled={connect.isPending}
          data-testid="button-byb-connect-quickbooks"
        >
          {connect.isPending && connect.variables === "quickbooks" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4 mr-2 text-[#2CA01C]" />
          )}
          Connect QuickBooks
        </Button>
      )}
      <Link href="/integrations">
        <Button variant="ghost" size="sm" data-testid="link-byb-integrations">
          All integrations
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </Link>
    </div>
  );
}

/** Paper-only guided fast setup: trade, solo/team, how they charge. */
function PaperOnlySetup({
  status,
  onDone,
}: {
  status: BringBusinessStatus | undefined;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [tradeType, setTradeType] = useState(status?.quickSetup.tradeType || "");
  const [teamSize, setTeamSize] = useState<"solo" | "team">(
    status?.quickSetup.teamSize && status.quickSetup.teamSize !== "solo" ? "team" : "solo",
  );
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [calloutFee, setCalloutFee] = useState<string>("");
  const [seedSamples, setSeedSamples] = useState(true);
  const [result, setResult] = useState<{ templatesSeeded: number; sampleDataSeeded: boolean } | null>(null);

  const trade = tradeType ? getTradeDefinition(tradeType) : undefined;
  const ratePlaceholder = trade ? String(trade.defaultRateCard.hourlyRate) : "100";
  const calloutPlaceholder = trade ? String(trade.defaultRateCard.calloutFee) : "80";

  const setup = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { tradeType, teamSize, seedSampleData: seedSamples };
      if (hourlyRate.trim() !== "" && !Number.isNaN(Number(hourlyRate))) body.defaultHourlyRate = Number(hourlyRate);
      if (calloutFee.trim() !== "" && !Number.isNaN(Number(calloutFee))) body.calloutFee = Number(calloutFee);
      const res = await apiRequest("POST", "/api/onboarding/quick-setup", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      setResult({ templatesSeeded: data.templatesSeeded ?? 0, sampleDataSeeded: !!data.sampleDataSeeded });
      toast({
        title: "You're set up",
        description: `${trade?.name || "Trade"} defaults applied${data.templatesSeeded ? ` — ${data.templatesSeeded} quote templates added` : ""}.`,
      });
      ["/api/business-settings", "/api/auth/me", "/api/clients", "/api/jobs", "/api/quotes", "/api/invoices", "/api/onboarding/sample-data", "/api/business-templates"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      );
      onDone();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Setup failed",
        description: error?.message || "Please try again.",
      });
    },
  });

  if (result) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-green-800 dark:text-green-300">Trade defaults applied</p>
          <p className="text-green-700 dark:text-green-400 mt-0.5">
            {result.templatesSeeded > 0
              ? `${result.templatesSeeded} quote templates ready to use. `
              : ""}
            {result.sampleDataSeeded ? "Sample records added so you can look around — remove them anytime from Settings." : ""}
            {" "}Rates and terminology are tuned for your trade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>What's your trade?</Label>
          <Select value={tradeType} onValueChange={setTradeType}>
            <SelectTrigger data-testid="select-byb-trade">
              <SelectValue placeholder="Select your trade…" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(tradeCatalog).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Just you, or a team?</Label>
          <div className="flex gap-2">
            {(["solo", "team"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                variant={teamSize === v ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setTeamSize(v)}
                data-testid={`button-byb-team-${v}`}
              >
                {v === "solo" ? "Just me" : "I have a team"}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Hourly rate ($/hr)</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={ratePlaceholder}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            data-testid="input-byb-hourly-rate"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Callout fee ($)</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={calloutPlaceholder}
            value={calloutFee}
            onChange={(e) => setCalloutFee(e.target.value)}
            data-testid="input-byb-callout-fee"
          />
        </div>
      </div>
      {trade && (
        <p className="text-xs text-muted-foreground">
          Leave rates blank to use typical {trade.name.toLowerCase()} rates (${trade.defaultRateCard.hourlyRate}/hr, ${trade.defaultRateCard.calloutFee} callout).
        </p>
      )}
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Add a few sample records</p>
            <p className="text-xs text-muted-foreground">Example clients, jobs and invoices so nothing feels empty. One-tap removal later.</p>
          </div>
        </div>
        <Switch checked={seedSamples} onCheckedChange={setSeedSamples} data-testid="switch-byb-samples" />
      </div>
      <Button
        onClick={() => setup.mutate()}
        disabled={!tradeType || setup.isPending}
        data-testid="button-byb-quick-setup"
      >
        {setup.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Setting up…
          </>
        ) : (
          <>
            Set me up
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}

export default function BringYourBusiness() {
  const [, navigate] = useLocation();
  const [openLane, setOpenLane] = useState<string | null>(null);

  const { data: status, refetch } = useQuery<BringBusinessStatus>({
    queryKey: ["/api/onboarding/bring-business/status"],
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const accountingConnected =
    !!status?.accounting.xeroConnected || !!status?.accounting.quickbooksConnected;
  // Lane progress = actual data in the app (imports / real clients).
  // An accounting connection alone is setup, not migrated data.
  const dataDone =
    (status?.data.completedImports ?? 0) > 0 || (status?.data.clientCount ?? 0) > 0;
  const docsDone = (status?.documents.count ?? 0) > 0;
  const formsDone = (status?.forms.count ?? 0) > 0;
  const paperDone = !!status?.quickSetup.tradeType && status.quickSetup.tradeType !== "general";

  const doneCount = [dataDone, docsDone, formsDone].filter(Boolean).length;

  const toggleLane = (id: string) => setOpenLane((cur) => (cur === id ? null : id));

  return (
    <PageShell>
      <PageHeader
        title="Bring your business across"
        subtitle="Pick and choose what to bring over — data, documents, forms. Everything here is optional, in any order, now or later."
      />

      <div className="flex items-center gap-2 mb-6" data-testid="byb-progress">
        {[dataDone, docsDone, formsDone].map((done, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${done ? "bg-green-500" : "bg-muted"}`}
          />
        ))}
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
          {doneCount}/3 lanes started
        </span>
      </div>

      <div className="space-y-4 max-w-3xl">
        {/* ------- Lane 1: Data ------- */}
        <Card data-testid="card-byb-data">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleLane("data")}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                Your data — clients, jobs, quotes &amp; invoices
              </CardTitle>
              <div className="flex items-center gap-2">
                {accountingConnected && !dataDone && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Accounting connected
                  </Badge>
                )}
                <LaneDoneBadge done={dataDone} label="Data in" />
              </div>
            </div>
          </CardHeader>
          {openLane === "data" ? (
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Drop in any spreadsheet — we'll work out what's in it. Exports from Tradify or ServiceM8 work too.
              </p>
              <SmartImportFlow onDone={() => refetch()} />
              <p className="text-xs text-muted-foreground">
                More import options (competitor exports, CSV templates) live in{" "}
                <Link href="/settings?tab=data" className="underline hover:text-foreground">
                  Settings → Data
                </Link>
                .
              </p>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Already in Xero or QuickBooks?
                </p>
                <p className="text-xs text-muted-foreground">
                  Connect Xero to import your clients straight from your contacts — no spreadsheet needed.
                  Connecting QuickBooks sets up invoice syncing; your client list still comes in via
                  spreadsheet import above.
                </p>
                <AccountingConnectRow
                  xeroConnected={!!status?.accounting.xeroConnected}
                  quickbooksConnected={!!status?.accounting.quickbooksConnected}
                  onImported={() => refetch()}
                />
              </div>
            </CardContent>
          ) : (
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                Import spreadsheets, or connect Xero / QuickBooks if that's where your business lives.
                {dataDone && status
                  ? ` ${status.data.clientCount} client${status.data.clientCount === 1 ? "" : "s"} in so far.`
                  : ""}
              </p>
            </CardContent>
          )}
        </Card>

        {/* ------- Lane 2: Documents ------- */}
        <Card data-testid="card-byb-documents">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleLane("documents")}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                Your documents — licences, insurance &amp; safety
              </CardTitle>
              <LaneDoneBadge done={docsDone} label={`${status?.documents.count ?? 0} uploaded`} />
            </div>
          </CardHeader>
          <CardContent className={openLane === "documents" ? "space-y-3" : "pt-0"}>
            <p className="text-sm text-muted-foreground">
              Upload licences, insurance certificates, white cards and training records so expiry reminders keep you compliant.
            </p>
            {openLane === "documents" && (
              <div className="flex gap-2 flex-wrap">
                <Link href="/files">
                  <Button size="sm" data-testid="button-byb-files">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload compliance documents
                  </Button>
                </Link>
                <Link href="/whs">
                  <Button variant="outline" size="sm" data-testid="button-byb-whs">
                    <Shield className="h-4 w-4 mr-2" />
                    Safety hub (SWMS &amp; bulk upload)
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ------- Lane 3: Forms ------- */}
        <Card data-testid="card-byb-forms">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleLane("forms")}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                Your forms — checklists &amp; paperwork
              </CardTitle>
              <LaneDoneBadge done={formsDone} label={`${status?.forms.count ?? 0} forms`} />
            </div>
          </CardHeader>
          <CardContent className={openLane === "forms" ? "space-y-3" : "pt-0"}>
            <p className="text-sm text-muted-foreground">
              Rebuild your paper checklists digitally — snap a photo of an existing form and AI rebuilds it for you.
            </p>
            {openLane === "forms" && (
              <div className="flex gap-2 flex-wrap">
                <Link href="/templates?tab=forms">
                  <Button size="sm" data-testid="button-byb-forms-list">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Rebuild a form with AI
                  </Button>
                </Link>
                <Link href="/forms/new">
                  <Button variant="outline" size="sm" data-testid="button-byb-forms-new">
                    Build one from scratch
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ------- Paper-only fast setup ------- */}
        <Card data-testid="card-byb-paper">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleLane("paper")}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-5 w-5" style={{ color: "hsl(var(--trade))" }} />
                Coming from pen &amp; paper? Fast setup
              </CardTitle>
              <LaneDoneBadge done={paperDone} label="Trade set" />
            </div>
          </CardHeader>
          <CardContent className={openLane === "paper" ? "space-y-3" : "pt-0"}>
            <p className="text-sm text-muted-foreground">
              No exports needed — answer three quick questions and we'll set sensible defaults for your trade: rates, quote templates and terminology.
            </p>
            {openLane === "paper" && <PaperOnlySetup status={status} onDone={() => refetch()} />}
          </CardContent>
        </Card>

        {/* ------- Start fresh / exit ------- */}
        <div className="flex items-center justify-between gap-3 pt-2 pb-8">
          <Link href="/settings?tab=data">
            <Button variant="ghost" size="sm" data-testid="button-byb-back-settings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            data-testid="button-byb-start-fresh"
          >
            {doneCount > 0 ? "Done for now — go to dashboard" : "Start fresh — skip all of this"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
