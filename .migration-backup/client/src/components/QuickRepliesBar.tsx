import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Plus, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import type { QuickReply } from "@shared/schema";
import { format } from "date-fns";

export interface QuickReplyContext {
  clientName?: string | null;
  clientFirstName?: string | null;
  jobTitle?: string | null;
  jobDate?: Date | string | null;
  businessName?: string | null;
}

export function applyQuickReplyVariables(body: string, ctx: QuickReplyContext): string {
  if (!body) return body;
  const clientName = ctx.clientName || "Customer";
  const clientFirst = (ctx.clientFirstName || clientName.split(" ")[0] || "Customer").trim();
  const jobTitle = ctx.jobTitle || "your job";
  const businessName = ctx.businessName || "Our business";
  let dateStr = "";
  if (ctx.jobDate) {
    const d = typeof ctx.jobDate === "string" ? new Date(ctx.jobDate) : ctx.jobDate;
    if (!isNaN(d.getTime())) {
      dateStr = format(d, "EEE d MMM 'at' h:mm a");
    }
  }
  return body
    .replace(/\[date\]/gi, dateStr || "the scheduled time")
    .replace(/\[clientName\]/gi, clientName)
    .replace(/\[clientFirstName\]/gi, clientFirst)
    .replace(/\[jobTitle\]/gi, jobTitle)
    .replace(/\[businessName\]/gi, businessName)
    .replace(/\{client_name\}/g, clientName)
    .replace(/\{client_first_name\}/g, clientFirst)
    .replace(/\{job_title\}/g, jobTitle)
    .replace(/\{business_name\}/g, businessName);
}

interface QuickRepliesBarProps {
  context: QuickReplyContext;
  draft: string;
  onInsert: (text: string) => void;
  disabled?: boolean;
  showSaveDraft?: boolean;
  leadingActions?: ReactNode;
  excludeLabels?: string[];
}

export function QuickRepliesBar({
  context,
  draft,
  onInsert,
  disabled,
  showSaveDraft = true,
  leadingActions,
  excludeLabels,
}: QuickRepliesBarProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const { data: quickReplies = [] } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { label: string; body: string }) => {
      const res = await apiRequest("POST", "/api/quick-replies", input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Saved as quick reply" });
      setSaveDialogOpen(false);
      setNewLabel("");
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save", description: err?.message ?? "", variant: "destructive" });
    },
  });

  const sortedReplies = useMemo(() => {
    const excluded = new Set((excludeLabels ?? []).map((l) => l.trim().toLowerCase()));
    return [...quickReplies]
      .filter((r) => !excluded.has((r.label ?? "").trim().toLowerCase()))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [quickReplies, excludeLabels]);

  const trimmedDraft = draft.trim();
  const canSaveDraft = showSaveDraft && trimmedDraft.length > 0 && !disabled;

  return (
    <div className="px-3 py-2 border-b bg-muted/30">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {leadingActions}
        {sortedReplies.map((reply) => (
          <Button
            key={reply.id}
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 bg-background"
            disabled={disabled}
            onClick={() => onInsert(applyQuickReplyVariables(reply.body, context))}
            data-testid={`quick-reply-${reply.id}`}
          >
            {reply.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 text-muted-foreground"
          onClick={() => setLocation("/settings?tab=communications")}
          data-testid="button-manage-quick-replies"
          title="Manage quick replies"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          Manage
        </Button>
      </div>
      {canSaveDraft && (
        <div className="mt-1.5 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground gap-1"
            onClick={() => {
              setNewLabel(trimmedDraft.slice(0, 30));
              setSaveDialogOpen(true);
            }}
            data-testid="button-save-as-quick-reply"
          >
            <Plus className="h-3 w-3" />
            Save as quick reply
          </Button>
        </div>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as quick reply</DialogTitle>
            <DialogDescription>
              Give it a short label so you can find it next time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-reply-label">Label</Label>
              <Input
                id="quick-reply-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value.slice(0, 60))}
                maxLength={60}
                placeholder="e.g. On my way"
                data-testid="input-quick-reply-label"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <div className="rounded-md border bg-muted/50 p-2 text-sm whitespace-pre-wrap break-words">
                {trimmedDraft}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const label = newLabel.trim();
                if (!label) {
                  toast({ title: "Add a label", variant: "destructive" });
                  return;
                }
                createMutation.mutate({ label, body: trimmedDraft });
              }}
              disabled={createMutation.isPending}
              data-testid="button-confirm-save-quick-reply"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
