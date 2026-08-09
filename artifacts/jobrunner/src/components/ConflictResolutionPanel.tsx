import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, Check, X, Merge } from 'lucide-react';
import type { SyncConflict } from '@/lib/syncManager';

interface ConflictResolutionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: SyncConflict[];
  onResolve: (conflictId: string, useLocal: boolean, mergedData?: Record<string, unknown>) => Promise<void>;
}

const DISPLAY_FIELDS: Record<string, string[]> = {
  clients: ['name', 'email', 'phone', 'address', 'company'],
  jobs: ['title', 'description', 'status', 'priority', 'scheduledDate', 'address'],
  quotes: ['title', 'status', 'total', 'validUntil', 'notes'],
  invoices: ['invoiceNumber', 'status', 'total', 'dueDate', 'notes'],
  timeEntries: ['description', 'startTime', 'endTime', 'duration'],
  payments: ['amount', 'method', 'status', 'date'],
};

function formatFieldName(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(value).toLocaleDateString('en-AU');
      } catch {
        return value;
      }
    }
    return value;
  }
  return JSON.stringify(value);
}

type FieldChoice = 'local' | 'server';

function ConflictCard({
  conflict,
  onResolve,
}: {
  conflict: SyncConflict;
  onResolve: (useLocal: boolean, mergedData?: Record<string, unknown>) => Promise<void>;
}) {
  const [resolving, setResolving] = useState(false);

  const fields = DISPLAY_FIELDS[conflict.storeName] || Object.keys(conflict.localVersion || {}).filter(k => k !== 'id');
  const changedFields = fields.filter(f => {
    const l = formatValue(conflict.localVersion?.[f]);
    const s = formatValue(conflict.serverVersion?.[f]);
    return l !== s;
  });

  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>(() => {
    const defaults: Record<string, FieldChoice> = {};
    changedFields.forEach(f => { defaults[f] = 'local'; });
    return defaults;
  });

  const toggleFieldChoice = (field: string) => {
    setFieldChoices(prev => ({
      ...prev,
      [field]: prev[field] === 'local' ? 'server' : 'local',
    }));
  };

  const handleResolveAll = async (mode: 'local' | 'server' | 'merge') => {
    setResolving(true);
    try {
      if (mode === 'local') {
        await onResolve(true);
      } else if (mode === 'server') {
        await onResolve(false);
      } else {
        const merged = { ...conflict.serverVersion };
        for (const field of changedFields) {
          if (fieldChoices[field] === 'local') {
            merged[field] = conflict.localVersion?.[field];
          }
        }
        await onResolve(true, merged);
      }
    } finally {
      setResolving(false);
    }
  };

  const allLocal = changedFields.every(f => fieldChoices[f] === 'local');
  const allServer = changedFields.every(f => fieldChoices[f] === 'server');

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
          <span className="text-sm font-medium capitalize">{conflict.storeName}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} differ
        </Badge>
      </div>

      {changedFields.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 text-xs text-muted-foreground font-medium px-1">
            <span>Field</span>
            <span>Your version</span>
            <span>Server version</span>
            <span className="w-14 text-center">Use</span>
          </div>
          {changedFields.map(field => {
            const choice = fieldChoices[field];
            return (
              <div key={field} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1 text-xs bg-muted/30 rounded-md p-1.5 items-center">
                <span className="text-muted-foreground">{formatFieldName(field)}</span>
                <span className={`break-words ${choice === 'local' ? 'font-medium' : 'text-muted-foreground'}`}>
                  {formatValue(conflict.localVersion?.[field])}
                </span>
                <span className={`break-words ${choice === 'server' ? 'font-medium' : 'text-muted-foreground'}`}>
                  {formatValue(conflict.serverVersion?.[field])}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-14 text-xs px-1"
                  onClick={() => toggleFieldChoice(field)}
                  disabled={resolving}
                >
                  {choice === 'local' ? 'Mine' : 'Server'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => handleResolveAll('local')}
          disabled={resolving}
        >
          <Check className="h-3 w-3 mr-1" />
          All mine
        </Button>
        {changedFields.length > 1 && !allLocal && !allServer && (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => handleResolveAll('merge')}
            disabled={resolving}
          >
            {resolving ? (
              <ArrowRight className="h-3 w-3 mr-1 animate-pulse" />
            ) : (
              <Merge className="h-3 w-3 mr-1" />
            )}
            Merge
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => handleResolveAll('server')}
          disabled={resolving}
        >
          <X className="h-3 w-3 mr-1" />
          All server
        </Button>
      </div>
    </div>
  );
}

export default function ConflictResolutionPanel({
  open,
  onOpenChange,
  conflicts,
  onResolve,
}: ConflictResolutionPanelProps) {
  const unresolvedConflicts = conflicts.filter(c => !c.resolvedAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
            Sync Conflicts
          </SheetTitle>
          <SheetDescription>
            {unresolvedConflicts.length === 0
              ? 'No conflicts to resolve.'
              : `${unresolvedConflicts.length} conflict${unresolvedConflicts.length > 1 ? 's' : ''} found. For each field, choose your version or the server's, then merge or keep all.`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-10rem)]">
          <div className="space-y-3 pr-3">
            {unresolvedConflicts.map(conflict => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={(useLocal, mergedData) => onResolve(conflict.id, useLocal, mergedData)}
              />
            ))}

            {unresolvedConflicts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500 dark:text-green-400" />
                All conflicts have been resolved.
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
