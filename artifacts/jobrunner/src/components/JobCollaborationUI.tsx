import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, AlertTriangle, Check, ArrowRight } from "lucide-react";
import { useState, useCallback } from "react";

interface JobEditor {
  userId: string;
  userName: string;
  joinedAt: number;
}

interface ConflictData {
  localChanges: Record<string, unknown>;
  serverData: Record<string, unknown>;
  changedFields: string[];
  serverVersion: number;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Job Title",
  description: "Description",
  address: "Address",
  status: "Status",
  priority: "Priority",
  scheduledAt: "Scheduled Date",
  estimatedHours: "Estimated Hours",
  estimatedDuration: "Estimated Duration",
  notes: "Notes",
  assignedTo: "Assigned To",
  geofenceEnabled: "Geofence",
  geofenceRadius: "Geofence Radius",
  workerStatus: "Worker Status",
  customFields: "Custom Fields",
};

export function PresenceIndicator({ editors }: { editors: JobEditor[] }) {
  if (editors.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {editors.slice(0, 3).map((editor) => (
          <UserAvatar
            key={editor.userId}
            className="h-7 w-7 border-2 border-background"
            fallbackClassName="text-[10px]"
            user={{ id: editor.userId, name: editor.userName }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {editors.length === 1
          ? `${editors[0].userName} is viewing`
          : `${editors.length} people viewing`}
      </span>
    </div>
  );
}

export function FieldUpdateIndicator({ fieldName, updatedByName }: { fieldName: string; updatedByName: string }) {
  return (
    <div className="animate-pulse-field absolute -top-1 -right-1 z-10">
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 whitespace-nowrap">
        Updated by {updatedByName}
      </Badge>
    </div>
  );
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === 'boolean') return value ? "Yes" : "No";
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      return new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return String(value); }
  }
  return String(value);
}

interface ConflictResolutionDialogProps {
  conflict: ConflictData;
  onResolve: (resolvedData: Record<string, unknown>, serverVersion: number) => void;
  onCancel: () => void;
}

export function ConflictResolutionDialog({ conflict, onResolve, onCancel }: ConflictResolutionDialogProps) {
  const [choices, setChoices] = useState<Record<string, 'local' | 'server'>>(() => {
    const initial: Record<string, 'local' | 'server'> = {};
    conflict.changedFields.forEach(field => {
      initial[field] = 'local';
    });
    return initial;
  });

  const handleResolve = useCallback(() => {
    const resolved: Record<string, unknown> = {};
    conflict.changedFields.forEach(field => {
      if (choices[field] === 'local') {
        resolved[field] = conflict.localChanges[field];
      } else {
        resolved[field] = conflict.serverData[field];
      }
    });
    onResolve(resolved, conflict.serverVersion);
  }, [choices, conflict, onResolve]);

  const selectAll = useCallback((choice: 'local' | 'server') => {
    const newChoices: Record<string, 'local' | 'server'> = {};
    conflict.changedFields.forEach(field => {
      newChoices[field] = choice;
    });
    setChoices(newChoices);
  }, [conflict.changedFields]);

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Changes Conflict
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Another user has modified this job while you were editing. Choose which version to keep for each field.
          </p>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2">
          <Button variant="outline" size="sm" onClick={() => selectAll('local')}>
            Keep All Mine
          </Button>
          <Button variant="outline" size="sm" onClick={() => selectAll('server')}>
            Accept All Server
          </Button>
        </div>

        <div className="space-y-3">
          {conflict.changedFields.map(field => {
            const label = FIELD_LABELS[field] || field;
            const localVal = formatFieldValue(conflict.localChanges[field]);
            const serverVal = formatFieldValue(conflict.serverData[field]);
            const isLocal = choices[field] === 'local';

            return (
              <Card key={field}>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <button
                    type="button"
                    className={`w-full text-left p-2 rounded-md border text-sm transition-colors ${
                      isLocal
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                        : 'border-border hover-elevate'
                    }`}
                    onClick={() => setChoices(prev => ({ ...prev, [field]: 'local' }))}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isLocal && <Check className="h-3.5 w-3.5 text-green-600" />}
                      <span className="font-medium text-xs">Your version</span>
                    </div>
                    <p className="text-muted-foreground break-words whitespace-pre-wrap">{localVal}</p>
                  </button>

                  <button
                    type="button"
                    className={`w-full text-left p-2 rounded-md border text-sm transition-colors ${
                      !isLocal
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-border hover-elevate'
                    }`}
                    onClick={() => setChoices(prev => ({ ...prev, [field]: 'server' }))}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!isLocal && <Check className="h-3.5 w-3.5 text-blue-600" />}
                      <span className="font-medium text-xs">Server version</span>
                    </div>
                    <p className="text-muted-foreground break-words whitespace-pre-wrap">{serverVal}</p>
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleResolve}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Save Resolved Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
