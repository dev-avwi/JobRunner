import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { History, Download, Undo2, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImportHistoryItem {
  id: string;
  fileName: string;
  hasFile: boolean;
  source: string;
  platform: string | null;
  type: string;
  typeLabel: string;
  status: 'completed' | 'undone';
  recordsImported: number;
  recordsMerged: number;
  recordsSkipped: number;
  recordsRemoved: number;
  remaining: number;
  editedSinceImport: number;
  clientsCreated: number;
  ranBy: string;
  importedAt: string;
  undoneAt: string | null;
}

const DATA_QUERY_KEYS = ['/api/clients', '/api/jobs', '/api/quotes', '/api/invoices', '/api/catalog'];

export function ImportHistoryCard() {
  const { toast } = useToast();
  const [undoTarget, setUndoTarget] = useState<ImportHistoryItem | null>(null);
  // Set when the server reports edited records and asks for a decision.
  const [editWarning, setEditWarning] = useState<{ item: ImportHistoryItem; editedCount: number; totalCount: number; message: string } | null>(null);

  const { data, isLoading } = useQuery<{ imports: ImportHistoryItem[] }>({
    queryKey: ['/api/import/history'],
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/import/history/${id}/file-url`);
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.open(data.url, '_blank');
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Download failed', description: error.message || 'The original file could not be downloaded.' });
    },
  });

  const undoMutation = useMutation({
    mutationFn: async ({ id, keepEdited, confirmEdited }: { id: string; keepEdited?: boolean; confirmEdited?: boolean }) => {
      const res = await apiRequest('POST', `/api/import/history/${id}/undo`, { keepEdited, confirmEdited });
      return res.json();
    },
    onSuccess: (result: { removed: number; clientsRemoved: number; keptEdited: number; typeLabel: string }) => {
      setUndoTarget(null);
      setEditWarning(null);
      queryClient.invalidateQueries({ queryKey: ['/api/import/history'] });
      DATA_QUERY_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({
        title: 'Import undone',
        description: `Removed ${result.removed} ${result.typeLabel}${result.clientsRemoved ? ` and ${result.clientsRemoved} client${result.clientsRemoved === 1 ? '' : 's'} created by the import` : ''}${result.keptEdited ? `. Kept ${result.keptEdited} edited record${result.keptEdited === 1 ? '' : 's'}.` : '.'}`,
      });
    },
    onError: async (error: any, variables) => {
      // 409 = edit protection: the server wants an explicit decision.
      const item = data?.imports.find(i => i.id === variables.id);
      const body = error?.body || tryParseError(error?.message);
      if (body?.requiresConfirmation && item) {
        setUndoTarget(null);
        setEditWarning({ item, editedCount: body.editedCount, totalCount: body.totalCount, message: body.message });
        return;
      }
      setUndoTarget(null);
      toast({ variant: 'destructive', title: 'Undo failed', description: body?.error || error.message || 'Please try again.' });
    },
  });

  function tryParseError(message?: string): any {
    // apiRequest throws Error("409: {json}") — recover the JSON payload.
    if (!message) return null;
    const idx = message.indexOf('{');
    if (idx === -1) return null;
    try { return JSON.parse(message.slice(idx)); } catch { return null; }
  }

  const imports = data?.imports || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          Import History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Every import is kept on record — the original file, what it created, and a one-tap undo.
        </p>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!isLoading && imports.length === 0 && (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
            No imports yet. When you import data, it will show up here with its original file and an undo option.
          </p>
        )}

        {imports.map((item) => (
          <div key={item.id} className="border rounded-lg p-3 space-y-2" data-testid={`import-history-item-${item.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" title={item.fileName}>{item.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.importedAt ? format(new Date(item.importedAt), 'd MMM yyyy, h:mm a') : ''} · by {item.ranBy}
                </p>
              </div>
              {item.status === 'undone' ? (
                <Badge variant="outline" className="text-muted-foreground shrink-0">Undone</Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0 capitalize">{item.typeLabel}</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {item.status === 'completed' ? (
                <>
                  <span>{item.recordsImported} imported</span>
                  {item.recordsMerged > 0 && <span>· {item.recordsMerged} merged</span>}
                  {item.recordsSkipped > 0 && <span>· {item.recordsSkipped} skipped</span>}
                  {item.clientsCreated > 0 && <span>· {item.clientsCreated} client{item.clientsCreated === 1 ? '' : 's'} created</span>}
                  {item.editedSinceImport > 0 && (
                    <span className="text-amber-600">· {item.editedSinceImport} edited since</span>
                  )}
                </>
              ) : (
                <span>{item.recordsRemoved} record{item.recordsRemoved === 1 ? '' : 's'} removed{item.undoneAt ? ` on ${format(new Date(item.undoneAt), 'd MMM yyyy')}` : ''}</span>
              )}
            </div>

            <div className="flex gap-2">
              {item.hasFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadMutation.mutate(item.id)}
                  disabled={downloadMutation.isPending}
                  data-testid={`button-download-import-${item.id}`}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Original file
                </Button>
              )}
              {item.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setUndoTarget(item)}
                  data-testid={`button-undo-import-${item.id}`}
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                  Undo import
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      {/* Step 1: confirm the undo */}
      <AlertDialog open={!!undoTarget} onOpenChange={(open) => !open && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this import?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes everything "{undoTarget?.fileName}" created — {undoTarget?.remaining} {undoTarget?.typeLabel}
              {undoTarget && undoTarget.clientsCreated > 0 ? ` plus up to ${undoTarget.clientsCreated} client${undoTarget.clientsCreated === 1 ? '' : 's'} it created` : ''}.
              The original file stays available for re-import.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (undoTarget) undoMutation.mutate({ id: undoTarget.id });
              }}
            >
              {undoMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Undo2 className="h-4 w-4 mr-1.5" />}
              Undo import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: edit protection — some records changed since the import */}
      <AlertDialog open={!!editWarning} onOpenChange={(open) => !open && setEditWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Some records were edited after the import
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editWarning?.message} You can keep the edited ones and remove the rest, or remove everything including your edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={undoMutation.isPending}
              onClick={() => editWarning && undoMutation.mutate({ id: editWarning.item.id, keepEdited: true })}
              data-testid="button-undo-keep-edited"
            >
              Keep {editWarning?.editedCount} edited record{editWarning?.editedCount === 1 ? '' : 's'}, remove the rest
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              disabled={undoMutation.isPending}
              onClick={() => editWarning && undoMutation.mutate({ id: editWarning.item.id, confirmEdited: true })}
              data-testid="button-undo-remove-all"
            >
              {undoMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Remove everything, including edited records
            </Button>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
