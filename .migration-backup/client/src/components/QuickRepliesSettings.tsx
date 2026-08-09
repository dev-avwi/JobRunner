import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import type { QuickReply } from "@shared/schema";

const VARIABLE_HELP = "[date], [clientName], [clientFirstName], [jobTitle], [businessName]";

export function QuickRepliesSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: replies = [], isLoading } = useQuery<QuickReply[]>({
    queryKey: ["/api/quick-replies"],
  });

  const [localOrder, setLocalOrder] = useState<QuickReply[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [creating, setCreating] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formBody, setFormBody] = useState("");

  useEffect(() => {
    setLocalOrder([...replies].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
  }, [replies]);

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest("POST", "/api/quick-replies/reorder", { orderedIds });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] }),
    onError: (err: any) => {
      toast({ title: "Couldn't reorder", description: err?.message ?? "", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: { label: string; body: string }) => {
      const res = await apiRequest("POST", "/api/quick-replies", input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Quick reply added" });
      closeDialog();
    },
    onError: (err: any) =>
      toast({ title: "Couldn't add", description: err?.message ?? "", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; label: string; body: string }) => {
      const res = await apiRequest("PATCH", `/api/quick-replies/${id}`, input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Quick reply updated" });
      closeDialog();
    },
    onError: (err: any) =>
      toast({ title: "Couldn't update", description: err?.message ?? "", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/quick-replies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quick-replies"] });
      toast({ title: "Quick reply deleted" });
    },
    onError: (err: any) =>
      toast({ title: "Couldn't delete", description: err?.message ?? "", variant: "destructive" }),
  });

  const closeDialog = () => {
    setEditing(null);
    setCreating(false);
    setFormLabel("");
    setFormBody("");
  };

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormLabel("");
    setFormBody("");
  };

  const openEdit = (r: QuickReply) => {
    setEditing(r);
    setCreating(false);
    setFormLabel(r.label);
    setFormBody(r.body);
  };

  const handleSave = () => {
    const label = formLabel.trim();
    const body = formBody.trim();
    if (!label || !body) {
      toast({ title: "Label and message are required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, label, body });
    } else {
      createMutation.mutate({ label, body });
    }
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const fromIdx = localOrder.findIndex((r) => r.id === dragId);
    const toIdx = localOrder.findIndex((r) => r.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...localOrder];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLocalOrder(next);
  };
  const handleDragEnd = () => {
    if (!dragId) return;
    setDragId(null);
    const ids = localOrder.map((r) => r.id);
    const original = [...replies]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((r) => r.id);
    if (ids.join(",") !== original.join(",")) {
      reorderMutation.mutate(ids);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Quick Replies</CardTitle>
            <CardDescription>
              Canned SMS responses that appear above the Chat Hub composer. Drag to reorder.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm" data-testid="button-add-quick-reply">
            <Plus className="h-4 w-4 mr-1" /> Add reply
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Variables: <code className="text-xs">{VARIABLE_HELP}</code>
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : localOrder.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No quick replies yet.</p>
        ) : (
          <ul className="space-y-2">
            {localOrder.map((r) => (
              <li
                key={r.id}
                draggable
                onDragStart={() => handleDragStart(r.id)}
                onDragOver={(e) => handleDragOver(e, r.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => e.preventDefault()}
                className={`flex items-start gap-2 rounded-md border bg-card p-3 ${
                  dragId === r.id ? "opacity-60" : ""
                }`}
                data-testid={`quick-reply-item-${r.id}`}
              >
                <div className="cursor-grab pt-0.5 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{r.label}</div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {r.body}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(r)}
                    data-testid={`button-edit-quick-reply-${r.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-quick-reply-${r.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={creating || !!editing} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit quick reply" : "New quick reply"}</DialogTitle>
              <DialogDescription>
                Use variables like <code className="text-xs">{VARIABLE_HELP}</code> — they'll be filled in from the active conversation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="qr-label">Label</Label>
                <Input
                  id="qr-label"
                  value={formLabel}
                  maxLength={60}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. On my way"
                  data-testid="input-qr-label"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-body">Message</Label>
                <Textarea
                  id="qr-body"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Hi [clientFirstName], on my way to [jobTitle] now."
                  rows={4}
                  data-testid="input-qr-body"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-quick-reply"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
