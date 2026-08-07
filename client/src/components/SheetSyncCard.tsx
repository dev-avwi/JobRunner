// One-way spreadsheet sync settings (Task #306)
// Owners can push data OUT to a Google Sheet or a scheduled Excel email.
// Strictly one-way: JobRunner stays the source of truth.

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Loader2,
  RefreshCw,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sheet as SheetIcon,
} from "lucide-react";

interface SheetSyncStatus {
  configured: boolean;
  enabled: boolean;
  target: 'google_sheets' | 'excel_email';
  frequency: 'daily' | 'weekly';
  dataTypes: string[];
  googleConnected: boolean;
  googleEmail: string | null;
  spreadsheetUrl: string | null;
  lastRunAt: string | null;
  lastStatus: 'success' | 'error' | null;
  lastError: string | null;
}

const DATA_TYPE_OPTIONS = [
  { key: 'clients', label: 'Clients' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
];

export function SheetSyncCard() {
  const { toast } = useToast();

  const { data: status, isLoading, isError } = useQuery<SheetSyncStatus>({
    queryKey: ['/api/sheet-sync/status'],
    retry: false,
  });

  // Surface OAuth callback result (?sheetsync=connected|error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('sheetsync');
    if (!result) return;
    if (result === 'connected') {
      toast({ title: 'Google account connected', description: 'You can now enable scheduled spreadsheet sync.' });
    } else if (result === 'error') {
      toast({
        title: 'Google connection failed',
        description: params.get('message') || 'Please try again.',
        variant: 'destructive',
      });
    }
    params.delete('sheetsync');
    params.delete('message');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
    queryClient.invalidateQueries({ queryKey: ['/api/sheet-sync/status'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<Pick<SheetSyncStatus, 'enabled' | 'target' | 'frequency' | 'dataTypes'>>) => {
      const res = await apiRequest('POST', '/api/sheet-sync/settings', updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sheet-sync/status'] });
    },
    onError: (error: any) => {
      toast({ title: 'Could not save sync settings', description: error.message, variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: ['/api/sheet-sync/status'] });
    },
  });

  const connectGoogle = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sheet-sync/connect');
      return res.json();
    },
    onSuccess: (data: { authUrl?: string }) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({ title: 'Could not start Google connection', description: error.message, variant: 'destructive' });
    },
  });

  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sheet-sync/disconnect');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Google account disconnected' });
      queryClient.invalidateQueries({ queryKey: ['/api/sheet-sync/status'] });
    },
    onError: (error: any) => {
      toast({ title: 'Could not disconnect', description: error.message, variant: 'destructive' });
    },
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/sheet-sync/run-now');
      return res.json();
    },
    onSuccess: (data: { url?: string | null }) => {
      toast({
        title: 'Sync complete',
        description: data.url ? 'Your Google Sheet has been refreshed.' : 'Your Excel export has been emailed to you.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sheet-sync/status'] });
    },
    onError: (error: any) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
      queryClient.invalidateQueries({ queryKey: ['/api/sheet-sync/status'] });
    },
  });

  // Hidden for non-owners (status endpoint is owner-only) and while loading
  if (isLoading || isError || !status) return null;

  const usingGoogle = status.target === 'google_sheets';
  const canEnable = !usingGoogle || status.googleConnected;

  const toggleDataType = (key: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...status.dataTypes, key]))
      : status.dataTypes.filter((t) => t !== key);
    if (next.length === 0) {
      toast({ title: 'Pick at least one data type', variant: 'destructive' });
      return;
    }
    updateSettings.mutate({ dataTypes: next });
  };

  return (
    <Card data-testid="card-sheet-sync">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <SheetIcon className="h-5 w-5 text-muted-foreground" />
              Spreadsheet Sync
            </CardTitle>
            <CardDescription>
              Automatically push your data out to a Google Sheet or a scheduled Excel email — perfect for keeping your bookkeeper in the loop.
            </CardDescription>
          </div>
          {status.enabled && (
            <Badge variant="default" className="shrink-0" data-testid="badge-sheet-sync-on">On</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* One-way messaging */}
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground" data-testid="text-one-way-note">
          <ArrowRight className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            <span className="font-medium text-foreground">One-way sync only.</span>{' '}
            JobRunner stays the source of truth. Each sync fully replaces the spreadsheet data, and changes made in the spreadsheet do <span className="font-medium text-foreground">not</span> flow back into JobRunner.
          </p>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <Label className="text-sm">Send data to</Label>
          <Select
            value={status.target}
            onValueChange={(v) => updateSettings.mutate({ target: v as SheetSyncStatus['target'] })}
          >
            <SelectTrigger className="w-full" data-testid="select-sheet-sync-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google_sheets">Google Sheet (kept up to date)</SelectItem>
              <SelectItem value="excel_email">Excel file emailed to me</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Google connection */}
        {usingGoogle && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="text-sm">
              {status.googleConnected ? (
                <>
                  <p className="font-medium flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Google connected
                  </p>
                  {status.googleEmail && <p className="text-xs text-muted-foreground">{status.googleEmail}</p>}
                </>
              ) : (
                <>
                  <p className="font-medium">Google account not connected</p>
                  <p className="text-xs text-muted-foreground">Connect to let JobRunner update your sheet</p>
                </>
              )}
            </div>
            {status.googleConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectGoogle.mutate()}
                disabled={disconnectGoogle.isPending}
                data-testid="button-sheets-disconnect"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => connectGoogle.mutate()}
                disabled={connectGoogle.isPending || !status.configured}
                data-testid="button-sheets-connect"
              >
                {connectGoogle.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Connect Google
              </Button>
            )}
          </div>
        )}

        {/* Enable + frequency */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="sheet-sync-enabled" className="text-sm">Scheduled sync</Label>
            <p className="text-xs text-muted-foreground">
              {canEnable ? 'Runs automatically in the background' : 'Connect Google above (or switch to Excel email) to enable'}
            </p>
          </div>
          <Switch
            id="sheet-sync-enabled"
            checked={status.enabled}
            disabled={!canEnable || updateSettings.isPending}
            onCheckedChange={(checked) => updateSettings.mutate({ enabled: checked })}
            data-testid="switch-sheet-sync-enabled"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Frequency</Label>
          <Select
            value={status.frequency}
            onValueChange={(v) => updateSettings.mutate({ frequency: v as SheetSyncStatus['frequency'] })}
          >
            <SelectTrigger className="w-full" data-testid="select-sheet-sync-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data types */}
        <div className="space-y-2">
          <Label className="text-sm">Data to include</Label>
          <div className="grid grid-cols-2 gap-2">
            {DATA_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex items-center gap-2 rounded-md border p-2.5 text-sm cursor-pointer"
                data-testid={`label-datatype-${opt.key}`}
              >
                <Checkbox
                  checked={status.dataTypes.includes(opt.key)}
                  onCheckedChange={(checked) => toggleDataType(opt.key, checked === true)}
                  data-testid={`checkbox-datatype-${opt.key}`}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Last sync status */}
        <div className="rounded-md border p-3 text-sm space-y-1" data-testid="section-last-sync">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last synced</span>
            <span data-testid="text-last-synced">
              {status.lastRunAt ? format(new Date(status.lastRunAt), 'd MMM yyyy, h:mm a') : 'Never'}
            </span>
          </div>
          {status.lastStatus === 'error' && (
            <div className="flex items-start gap-1.5 text-xs text-destructive" data-testid="text-last-sync-error">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{status.lastError || 'Last sync failed'}</span>
            </div>
          )}
          {status.spreadsheetUrl && usingGoogle && (
            <a
              href={status.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid="link-open-spreadsheet"
            >
              Open Google Sheet <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending || (usingGoogle && !status.googleConnected)}
            data-testid="button-sync-now"
          >
            {runNow.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Sync now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/sheet-sync/download-excel', '_blank')}
            data-testid="button-download-excel"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
