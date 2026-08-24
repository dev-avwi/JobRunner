import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Layers,
  CheckSquare,
  GripVertical,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhaseRow {
  phaseCode: string;
  name: string;
  /** Preserved from the original template; not exposed in the editor UI */
  description?: string;
  /** Preserved from the original template; not exposed in the editor UI */
  bookedHours?: string;
}

interface ChecklistRow {
  text: string;
}

interface TemplateFormState {
  name: string;
  description: string;
  phases: PhaseRow[];
  checklistItems: ChecklistRow[];
  /** Preserved from an existing template so edit never silently drops settings the form doesn't expose */
  preservedSettings?: Record<string, string | undefined>;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description?: string | null;
  templateData: {
    phases: { phaseCode: string; name: string; description?: string; bookedHours?: string }[];
    checklistItems?: { text: string; sortOrder: number }[];
    settings?: Record<string, string | undefined>;
  };
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: TemplateFormState = {
  name: "",
  description: "",
  phases: [{ phaseCode: "1", name: "" }],
  checklistItems: [],
};

function templateToForm(t: ProjectTemplate): TemplateFormState {
  return {
    name: t.name,
    description: t.description ?? "",
    phases:
      t.templateData.phases.length > 0
        ? t.templateData.phases.map((p) => ({
            phaseCode: p.phaseCode,
            name: p.name,
            // Preserve fields the editor doesn't expose so they survive a save round-trip
            description: p.description,
            bookedHours: p.bookedHours,
          }))
        : [{ phaseCode: "1", name: "" }],
    checklistItems: (t.templateData.checklistItems ?? []).map((c) => ({ text: c.text })),
    // Preserve settings the form doesn't expose so edits don't silently drop them
    preservedSettings: t.templateData.settings as Record<string, string | undefined> | undefined,
  };
}

function formToPayload(form: TemplateFormState) {
  const phases = form.phases
    .filter((p) => p.name.trim())
    .map((p, i) => ({
      phaseCode: p.phaseCode.trim() || String(i + 1),
      name: p.name.trim(),
      // Re-emit preserved fields so PATCH doesn't strip them
      ...(p.description ? { description: p.description } : {}),
      ...(p.bookedHours ? { bookedHours: p.bookedHours } : {}),
    }));

  const checklistItems = form.checklistItems
    .filter((c) => c.text.trim())
    .map((c, i) => ({ text: c.text.trim(), sortOrder: i }));

  const trimmedDescription = form.description.trim();

  return {
    name: form.name.trim(),
    // Send null explicitly so PATCH can clear a previously set description;
    // undefined would omit the field and leave the DB value unchanged.
    // POST now also accepts null (schema updated), so this is safe for both operations.
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    templateData: {
      phases,
      // Carry forward any settings the form doesn't expose (markups, budget, etc.)
      ...(form.preservedSettings ? { settings: form.preservedSettings } : {}),
      ...(checklistItems.length > 0 ? { checklistItems } : {}),
    },
  };
}

// ─── Template Form Dialog ────────────────────────────────────────────────────

function TemplateFormDialog({
  open,
  onClose,
  editingTemplate,
}: {
  open: boolean;
  onClose: () => void;
  editingTemplate?: ProjectTemplate;
}) {
  const { toast } = useToast();
  const isEdit = !!editingTemplate;

  const [form, setForm] = useState<TemplateFormState>(() =>
    editingTemplate ? templateToForm(editingTemplate) : EMPTY_FORM,
  );

  // Reset form when dialog opens with a different template (or blank for new)
  const [lastTemplate, setLastTemplate] = useState(editingTemplate?.id);
  if (lastTemplate !== editingTemplate?.id) {
    setLastTemplate(editingTemplate?.id);
    setForm(editingTemplate ? templateToForm(editingTemplate) : EMPTY_FORM);
  }

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      apiRequest("POST", "/api/project-templates", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates"] });
      toast({ title: "Template created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      apiRequest("PATCH", `/api/project-templates/${editingTemplate!.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates"] });
      toast({ title: "Template updated" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    const validPhases = form.phases.filter((p) => p.name.trim());
    if (validPhases.length === 0) {
      toast({ title: "Add at least one phase", variant: "destructive" });
      return;
    }
    const payload = formToPayload(form);
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  // ─── Phase helpers ──────────────────────────────────────────────────────────

  function addPhase() {
    setForm((f) => ({
      ...f,
      phases: [...f.phases, { phaseCode: String(f.phases.length + 1), name: "" }],
    }));
  }

  function removePhase(idx: number) {
    setForm((f) => ({ ...f, phases: f.phases.filter((_, i) => i !== idx) }));
  }

  function updatePhase(idx: number, field: keyof PhaseRow, value: string) {
    setForm((f) => {
      const phases = [...f.phases];
      phases[idx] = { ...phases[idx], [field]: value };
      return { ...f, phases };
    });
  }

  // ─── Checklist helpers ──────────────────────────────────────────────────────

  function addChecklist() {
    setForm((f) => ({ ...f, checklistItems: [...f.checklistItems, { text: "" }] }));
  }

  function removeChecklist(idx: number) {
    setForm((f) => ({ ...f, checklistItems: f.checklistItems.filter((_, i) => i !== idx) }));
  }

  function updateChecklist(idx: number, value: string) {
    setForm((f) => {
      const checklistItems = [...f.checklistItems];
      checklistItems[idx] = { text: value };
      return { ...f, checklistItems };
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit template" : "New project template"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Template name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              placeholder="e.g. New Home Build"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={200}
              data-testid="input-template-name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              placeholder="Brief description of when to use this template"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={1000}
              rows={2}
              data-testid="input-template-description"
            />
          </div>

          <Separator />

          {/* Phases */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Phases</p>
                <p className="text-xs text-muted-foreground">
                  Stages of work this project type follows
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhase}
                data-testid="btn-add-phase"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add phase
              </Button>
            </div>

            <div className="space-y-2">
              {form.phases.map((phase, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-40" />
                  <Input
                    placeholder="Code"
                    value={phase.phaseCode}
                    onChange={(e) => updatePhase(idx, "phaseCode", e.target.value)}
                    maxLength={20}
                    className="w-20 flex-shrink-0 font-mono text-sm"
                    data-testid={`input-phase-code-${idx}`}
                  />
                  <Input
                    placeholder="Phase name (e.g. Slab)"
                    value={phase.name}
                    onChange={(e) => updatePhase(idx, "name", e.target.value)}
                    className="flex-1"
                    data-testid={`input-phase-name-${idx}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhase(idx)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={form.phases.length === 1}
                    data-testid={`btn-remove-phase-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {form.phases.filter((p) => !p.name.trim()).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Phases with no name will not be saved.
              </p>
            )}
          </div>

          <Separator />

          {/* Checklist items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Checklist items (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Tasks that get added to every job created from this template
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChecklist}
                data-testid="btn-add-checklist"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add item
              </Button>
            </div>

            {form.checklistItems.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No checklist items yet.</p>
            )}

            <div className="space-y-2">
              {form.checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-40" />
                  <Input
                    placeholder="e.g. Confirm engineering approval"
                    value={item.text}
                    onChange={(e) => updateChecklist(idx, e.target.value)}
                    maxLength={500}
                    className="flex-1"
                    data-testid={`input-checklist-${idx}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeChecklist(idx)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    data-testid={`btn-remove-checklist-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="btn-save-template">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ProjectTemplatesSettings() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | undefined>(undefined);

  const { data: templates = [], isLoading } = useQuery<ProjectTemplate[]>({
    queryKey: ["/api/project-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/project-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  function openNew() {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  }

  function openEdit(t: ProjectTemplate) {
    setEditingTemplate(t);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingTemplate(undefined);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Saved templates appear in the job-creation flow so managers can spin up a project with
          pre-built phases and checklist items in one click.
        </p>
        <Button
          onClick={openNew}
          size="sm"
          className="ml-4 flex-shrink-0"
          data-testid="btn-new-template"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No templates yet</p>
          <p className="text-xs mt-1">
            Create your first template to speed up project setup.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            New template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const phaseCount = t.templateData.phases.length;
            const checklistCount = t.templateData.checklistItems?.length ?? 0;
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors"
                data-testid={`template-row-${t.id}`}
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ background: "hsl(var(--trade) / 0.12)" }}
                >
                  <Layers className="w-4 h-4" style={{ color: "hsl(var(--trade))" }} />
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs gap-1 font-normal">
                      <Layers className="w-3 h-3" />
                      {phaseCount} {phaseCount === 1 ? "phase" : "phases"}
                    </Badge>
                    {checklistCount > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1 font-normal">
                        <CheckSquare className="w-3 h-3" />
                        {checklistCount} checklist {checklistCount === 1 ? "item" : "items"}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(t)}
                    data-testid={`btn-edit-template-${t.id}`}
                    title="Edit template"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        data-testid={`btn-delete-template-${t.id}`}
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{t.name}" will be permanently removed. Jobs already created from it
                          won't be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(t.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid={`btn-confirm-delete-${t.id}`}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TemplateFormDialog
        open={dialogOpen}
        onClose={handleClose}
        editingTemplate={editingTemplate}
      />
    </>
  );
}
