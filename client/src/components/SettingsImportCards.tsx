import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { SignaturePad, SignatureDisplay } from "@/components/ui/signature-pad";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useSimpleMode } from "@/hooks/use-simple-mode";
import { useTheme } from "@/components/ThemeProvider";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppMode } from "@/hooks/use-app-mode";
import { 
  Building, 
  Palette, 
  CreditCard, 
  Mail,
  Save,
  Upload,
  Crown,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Shield,
  FileText,
  Settings as SettingsIcon,
  Loader2,
  Zap,
  Calendar,
  ExternalLink,
  TrendingUp,
  Headphones,
  Phone,
  MessageCircle,
  PenTool,
  HelpCircle,
  Briefcase,
  Receipt,
  ClipboardList,
  Users,
  BookOpen,
  Sparkles,
  User,
  Edit2,
  X,
  CheckCircle2,
  Check,
  Building2,
  MapPin,
  Wallet,
  Banknote,
  Percent,
  AlertCircle,
  DollarSign,
  PlayCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  Download,
  MessageSquare,
  Bot,
  Link2,
  Star,
  Globe,
  Copy,
  CalendarPlus,
  Plus,
  Settings2
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoUpload } from "./LogoUpload";
import { QuickRepliesSettings } from "./QuickRepliesSettings";
import { useToast } from "@/hooks/use-toast";
import DataSafetyBanner from "./DataSafetyBanner";
import { TemplateId, TemplateCustomization } from "@/lib/document-templates";
import { PRICING } from "@shared/schema";
import { tradeCatalog, getTradeDefinition } from "@shared/tradeCatalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Component to clear sample/demo data when user is ready to start fresh
export function ClearSampleDataCard() {
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);
  
  // Check if user has demo data
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
  });
  
  const hasDemoData = (userData as any)?.user?.hasDemoData === true;

  // Task #115: also detect isSample-flagged rows from the new sample-data system.
  const { data: sampleDataInfo } = useQuery<{ hasSampleData: boolean }>({
    queryKey: ['/api/onboarding/sample-data'],
  });
  const hasSampleData = sampleDataInfo?.hasSampleData === true;

  const handleClearData = async () => {
    if (!confirm('Remove all sample data? This only removes the example records — your own data is safe.')) {
      return;
    }

    setIsClearing(true);
    try {
      // Clear both legacy demo data and isSample-flagged rows.
      if (hasDemoData) {
        try {
          await fetch('/api/onboarding/clear-demo-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
        } catch {}
      }
      if (hasSampleData) {
        const r = await fetch('/api/onboarding/sample-data', {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to remove sample data');
        }
      }

      toast({
        title: "Sample data removed",
        description: "All example clients, jobs, quotes and invoices were deleted. You're ready to add your own!",
      });

      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/sample-data'] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove sample data",
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (!hasDemoData && !hasSampleData) return null;
  
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-amber-600" />
          Sample Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You have sample clients, jobs, quotes, and invoices from your onboarding. 
          When you're ready to start fresh with your own data, clear them here.
        </p>
        <Button 
          variant="outline"
          onClick={handleClearData}
          disabled={isClearing}
          className="border-amber-300"
        >
          {isClearing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Clearing...
            </>
          ) : (
            <>
              <X className="h-4 w-4 mr-2" />
              Remove Sample Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

type ImportDataType = 'clients' | 'catalog' | 'jobs' | 'quotes' | 'invoices';
type ImportPlatform = 'generic' | 'tradify' | 'servicem8';

interface ImportPreviewData {
  headers: string[];
  preview: Record<string, string>[];
  rows: Record<string, string>[];
  totalRows: number;
  suggestedMappings: Record<string, string>;
  detectedPlatform: ImportPlatform;
  detectedType: ImportDataType;
  duplicates: { row: number; reason: string }[];
  duplicateCount: number;
  formatWarning?: string;
}

function CompetitorImportFlow({ platform, onClose }: { platform: ImportPlatform; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicatesSkipped: number } | null>(null);

  const platformName = platform === 'tradify' ? 'Tradify' : 'ServiceM8';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('platform', platform);
    try {
      const res = await fetch('/api/import/preview', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to parse file');
      setPreview(await res.json());
    } catch {
      toast({ variant: "destructive", title: "Could not read that file", description: "Make sure it's a CSV exported from " + platformName + "." });
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/import/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          type: preview.detectedType,
          data: preview.rows,
          mappings: preview.suggestedMappings,
          platform,
          skipDuplicates: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      if (data.imported > 0) {
        const keys = ['/api/clients', '/api/jobs', '/api/quotes', '/api/invoices', '/api/catalog'];
        keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
        toast({ title: `Imported ${data.imported} ${preview.detectedType}` });
      }
    } catch {
      toast({ variant: "destructive", title: "Import failed" });
    } finally {
      setIsImporting(false);
    }
  };

  const typeLabel: Record<ImportDataType, string> = {
    clients: 'Clients', catalog: 'Price List', jobs: 'Jobs', quotes: 'Quotes', invoices: 'Invoices',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Import from {platformName}</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>

      {!preview && !result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload any CSV file exported from {platformName}. We'll automatically detect whether it contains clients, jobs, quotes, or invoices.
          </p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          <Button size="sm" onClick={() => fileRef.current?.click()}>Choose CSV File</Button>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{typeLabel[preview.detectedType] || preview.detectedType}</Badge>
            <Badge variant="outline">{preview.totalRows} rows</Badge>
            {preview.duplicateCount > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                {preview.duplicateCount} duplicate{preview.duplicateCount !== 1 ? 's' : ''} will be skipped
              </Badge>
            )}
          </div>

          {preview.formatWarning && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
              {preview.formatWarning}
            </div>
          )}

          {preview.duplicateCount > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 space-y-1">
              {preview.duplicates.slice(0, 3).map((d, i) => (
                <p key={i}>{d.reason}</p>
              ))}
              {preview.duplicates.length > 3 && (
                <p>...and {preview.duplicates.length - 3} more</p>
              )}
            </div>
          )}

          <div className="overflow-x-auto bg-muted/30 rounded-lg p-2">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {preview.headers.slice(0, 4).map((h, i) => (
                    <th key={i} className="text-left p-1 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-t border-border/50">
                    {preview.headers.slice(0, 4).map((h, j) => (
                      <td key={j} className="p-1 truncate max-w-[120px]">{row[h] || '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Importing...</>
              ) : (
                `Import ${preview.totalRows - preview.duplicateCount} ${typeLabel[preview.detectedType] || 'records'}`
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-600 font-medium">
              Imported {result.imported} records
              {result.duplicatesSkipped > 0 ? ` (${result.duplicatesSkipped} duplicates skipped)` : ''}
              {(result.skipped - (result.duplicatesSkipped || 0)) > 0 ? ` (${result.skipped - (result.duplicatesSkipped || 0)} errors)` : ''}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/insights">
              <Button size="sm" data-testid="button-see-insights">
                <TrendingUp className="h-4 w-4 mr-1" />
                See your business live
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => { setPreview(null); setResult(null); }}>Import another file</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImportDataCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [importType, setImportType] = useState<ImportDataType | null>(null);
  const [competitorPlatform, setCompetitorPlatform] = useState<ImportPlatform | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicatesSkipped?: number } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importType) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', importType);
    try {
      const res = await fetch('/api/import/preview', { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to parse file');
      setPreview(await res.json());
    } catch {
      toast({ variant: "destructive", title: "Could not read that file", description: "Make sure it's a CSV with headers." });
    }
  };

  const handleImport = async () => {
    if (!preview || !importType) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/import/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type: importType, data: preview.rows, mappings: preview.suggestedMappings, skipDuplicates: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      if (data.imported > 0) {
        const queryKeyMap: Record<string, string> = { clients: '/api/clients', catalog: '/api/catalog', jobs: '/api/jobs', quotes: '/api/quotes', invoices: '/api/invoices' };
        queryClient.invalidateQueries({ queryKey: [queryKeyMap[importType]] });
        const typeLabels: Record<string, string> = { clients: 'clients', catalog: 'items', jobs: 'jobs', quotes: 'quotes', invoices: 'invoices' };
        toast({ title: `Imported ${data.imported} ${typeLabels[importType] || 'records'}` });
      }
    } catch {
      toast({ variant: "destructive", title: "Import failed" });
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => { setImportType(null); setCompetitorPlatform(null); setPreview(null); setResult(null); };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          Import Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {competitorPlatform && (
          <CompetitorImportFlow platform={competitorPlatform} onClose={reset} />
        )}

        {!competitorPlatform && !importType && !result && (
          <>
            <p className="text-sm text-muted-foreground">
              Switching from another app? Import your data automatically.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Import from competitor</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setCompetitorPlatform('tradify')}>
                  <Download className="h-4 w-4 mr-1" />
                  Import from Tradify
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCompetitorPlatform('servicem8')}>
                  <Download className="h-4 w-4 mr-1" />
                  Import from ServiceM8
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Generic CSV import</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setImportType('clients')}>
                  <Users className="h-4 w-4 mr-1" />
                  Clients
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportType('catalog')}>
                  <FileText className="h-4 w-4 mr-1" />
                  Price List
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportType('jobs')}>
                  <Briefcase className="h-4 w-4 mr-1" />
                  Jobs
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportType('quotes')}>
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Quotes
                </Button>
                <Button variant="outline" size="sm" onClick={() => setImportType('invoices')}>
                  <Receipt className="h-4 w-4 mr-1" />
                  Invoices
                </Button>
              </div>
            </div>
          </>
        )}
        {!competitorPlatform && importType && !preview && !result && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with your {importType}.
            </p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => fileRef.current?.click()}>Choose CSV File</Button>
              <Button variant="ghost" size="sm" onClick={() => window.open(`/api/import/templates/${importType}`, '_blank')}>
                Download template
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}
        {!competitorPlatform && preview && !result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{preview.totalRows} rows found</p>
              {(preview.duplicateCount || 0) > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  {preview.duplicateCount} duplicate{preview.duplicateCount !== 1 ? 's' : ''} skipped
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleImport} disabled={isImporting}>
                {isImporting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Importing...</> : `Import ${preview.totalRows - (preview.duplicateCount || 0)} records`}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}
        {!competitorPlatform && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-600 font-medium">
                Imported {result.imported} records
                {(result.duplicatesSkipped || 0) > 0 ? ` (${result.duplicatesSkipped} duplicates skipped)` : ''}
                {result.skipped > 0 && result.skipped !== (result.duplicatesSkipped || 0) ? ` (${result.skipped - (result.duplicatesSkipped || 0)} errors)` : ''}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href="/insights">
                <Button size="sm" data-testid="button-see-insights-generic">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  See your business live
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={reset}>Import more</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const AU_TIMEZONES: { value: string; label: string }[] = [
  { value: "Australia/Sydney", label: "Sydney (NSW, ACT, TAS, VIC) — AEST/AEDT" },
  { value: "Australia/Melbourne", label: "Melbourne (VIC) — AEST/AEDT" },
  { value: "Australia/Brisbane", label: "Brisbane (QLD) — AEST (no DST)" },
  { value: "Australia/Adelaide", label: "Adelaide (SA) — ACST/ACDT" },
  { value: "Australia/Perth", label: "Perth (WA) — AWST" },
  { value: "Australia/Hobart", label: "Hobart (TAS) — AEST/AEDT" },
  { value: "Australia/Darwin", label: "Darwin (NT) — ACST (no DST)" },
  { value: "Australia/Broken_Hill", label: "Broken Hill (NSW) — ACST/ACDT" },
  { value: "Australia/Lord_Howe", label: "Lord Howe Island — LHST/LHDT" },
  { value: "Australia/Eucla", label: "Eucla (WA) — ACWST" },
];

function getAllIanaTimezones(): string[] {
  try {
    const supported = (Intl as any).supportedValuesOf?.("timeZone") as string[] | undefined;
    if (Array.isArray(supported) && supported.length) return supported;
  } catch {}
  return [
    "UTC", "Pacific/Auckland", "Pacific/Fiji", "Asia/Singapore", "Asia/Tokyo",
    "Asia/Hong_Kong", "Asia/Manila", "Asia/Bangkok", "Asia/Kuala_Lumpur",
    "Asia/Jakarta", "Asia/Dubai", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
    "America/Toronto",
  ];
}

export function TimezoneField({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const auValues = AU_TIMEZONES.map(t => t.value);
  const isAuValue = auValues.includes(value);
  const [showOther, setShowOther] = useState<boolean>(!isAuValue);
  useEffect(() => {
    if (value && !auValues.includes(value)) {
      setShowOther(true);
    }
  }, [value]);
  const allTimezones = showOther ? getAllIanaTimezones() : [];

  return (
    <div className="space-y-2">
      <Label htmlFor="timezone">Timezone</Label>
      <p className="text-sm text-muted-foreground">
        Used when syncing jobs to Google Calendar so events show at the right local time.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Select
          value={isAuValue && !showOther ? value : showOther ? "__other__" : value}
          onValueChange={(v) => {
            if (v === "__other__") {
              setShowOther(true);
              return;
            }
            setShowOther(false);
            onChange(v);
          }}
        >
          <SelectTrigger data-testid="select-timezone">
            <SelectValue placeholder="Select your timezone" />
          </SelectTrigger>
          <SelectContent>
            {AU_TIMEZONES.map(tz => (
              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
            ))}
            <SelectItem value="__other__">Other (full list)…</SelectItem>
          </SelectContent>
        </Select>
        {showOther && (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger data-testid="select-timezone-iana">
              <SelectValue placeholder="Pick an IANA timezone" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {allTimezones.map(tz => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Current: {value || "Australia/Sydney"}</p>
    </div>
  );
}
