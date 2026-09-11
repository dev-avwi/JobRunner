/**
 * UnifiedWorkSection (web)
 *
 * Replaces the separate JobChecklistSection + JobTasksSection with a single
 * work-tracking card. Items are either:
 *   - Simple checklist items (checkbox only)
 *   - Full tasks (title, optional rich description, toggle, edit description, delete)
 *
 * Users can promote a checklist item to a full task inline.
 * The header shows combined progress: "3 of 7 complete".
 *
 * Tasks support a rich markdown description (## headings, bullet/numbered lists,
 * **bold**, *italic*). Owners can create tasks with a description via a dialog,
 * and edit or clear existing descriptions inline.
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, safeInvalidateQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ListChecks,
  Plus,
  X,
  Loader2,
  ArrowUpCircle,
  List,
  FileText,
} from "lucide-react";
import {
  buildCreateTaskPayload,
  descriptionSaveValue,
  descriptionInitialValue,
} from "@/lib/taskDescriptionUtils";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  jobId: string;
  text: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface JobTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  source?: string | null;
}

interface UnifiedWorkSectionProps {
  jobId: string;
  readOnly?: boolean;
}

// ─── TaskMarkdown ─────────────────────────────────────────────────────────────

/** Renders a task description as styled markdown (headings, lists, bold, italic). */
function TaskMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-xs max-w-none text-xs text-muted-foreground mt-0.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-1 [&_h2]:mb-0.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-1 [&_h3]:mb-0.5 [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0 [&_p]:my-0.5">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UnifiedWorkSection({ jobId, readOnly = false }: UnifiedWorkSectionProps) {
  const { toast } = useToast();
  const { isOwner } = useUserRole();

  const [addMode, setAddMode] = useState<"item" | "task">("item");
  const [newText, setNewText] = useState("");

  // Create-task dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTaskTitle, setCreateTaskTitle] = useState("");
  const [createTaskDesc, setCreateTaskDesc] = useState("");

  // Edit-description dialog
  const [editingTask, setEditingTask] = useState<JobTask | null>(null);
  const [editTaskDesc, setEditTaskDesc] = useState("");

  const clQueryKey = ["/api/jobs", jobId, "checklist"];
  const taskQueryKey = ["/api/jobs", jobId, "tasks"];

  // ── Checklist data ──────────────────────────────────────────────────────────

  const { data: checklistItems = [], isLoading: clLoading } = useQuery<ChecklistItem[]>({
    queryKey: clQueryKey,
    enabled: !!jobId,
  });

  const addChecklistMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest("POST", `/api/jobs/${jobId}/checklist`, {
        text,
        isCompleted: false,
        sortOrder: checklistItems.length,
      }),
    onSuccess: () => safeInvalidateQueries({ queryKey: clQueryKey }),
    onError: () => toast({ title: "Could not add item", variant: "destructive" }),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      apiRequest("PATCH", `/api/checklist/${id}`, { isCompleted }),
    onSuccess: () => safeInvalidateQueries({ queryKey: clQueryKey }),
    onError: () => toast({ title: "Could not update item", variant: "destructive" }),
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/checklist/${id}`),
    onSuccess: () => safeInvalidateQueries({ queryKey: clQueryKey }),
    onError: () => toast({ title: "Could not delete item", variant: "destructive" }),
  });

  // Promote checklist item → full task (sequential: create then delete)
  const promoteMutation = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      // Task creation must succeed first; if it throws, onError fires and delete is skipped.
      await apiRequest("POST", "/api/tasks", { title: item.text, jobId });
      // Attempt deletion; catch to allow partial-success reporting without hiding the new task.
      let deleteSucceeded = true;
      try {
        await apiRequest("DELETE", `/api/checklist/${item.id}`);
      } catch {
        deleteSucceeded = false;
      }
      return { deleteSucceeded };
    },
    onSuccess: ({ deleteSucceeded }) => {
      // Always refresh both lists — the task was created regardless.
      safeInvalidateQueries({ queryKey: clQueryKey });
      safeInvalidateQueries({ queryKey: taskQueryKey });
      if (!deleteSucceeded) {
        toast({
          title: "Task created, but the checklist item could not be removed. Please delete it manually.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Converted to full task" });
      }
    },
    onError: () => toast({ title: "Could not create task", variant: "destructive" }),
  });

  // ── Task data ───────────────────────────────────────────────────────────────

  const { data: tasks = [], isLoading: taskLoading } = useQuery<JobTask[]>({
    queryKey: taskQueryKey,
    enabled: !!jobId,
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ title, description }: { title: string; description?: string }) =>
      apiRequest("POST", "/api/tasks", buildCreateTaskPayload(title, jobId, description ?? "")),
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: taskQueryKey });
      setShowCreateDialog(false);
      setCreateTaskTitle("");
      setCreateTaskDesc("");
      setNewText("");
    },
    onError: () => toast({ title: "Could not add task", variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, {
        status: status === "done" ? "open" : "done",
      }),
    onSuccess: () => safeInvalidateQueries({ queryKey: taskQueryKey }),
    onError: () => toast({ title: "Could not update task", variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => safeInvalidateQueries({ queryKey: taskQueryKey }),
    onError: () => toast({ title: "Could not delete task", variant: "destructive" }),
  });

  const updateDescMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string | null }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, {
        description: description === null ? null : descriptionSaveValue(description),
      }),
    onSuccess: () => {
      setEditingTask(null);
      setEditTaskDesc("");
      safeInvalidateQueries({ queryKey: taskQueryKey });
    },
    onError: () => toast({ title: "Could not save description", variant: "destructive" }),
  });

  // ── Computed values ─────────────────────────────────────────────────────────

  const completedCL = checklistItems.filter((i) => i.isCompleted).length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const totalItems = checklistItems.length + tasks.length;
  const completedItems = completedCL + completedTasks;

  // Checklist items follow the same permissions as the original JobChecklistSection:
  // editable by any authenticated user when the job is not invoiced.
  const canEditChecklist = !readOnly;
  // Task-specific actions (add/delete/toggle/promote) stay owner-only.
  const canEditTasks = isOwner && !readOnly;

  // ── Add handler ─────────────────────────────────────────────────────────────

  function handleAdd() {
    const text = newText.trim();
    if (!text) return;
    if (addMode === "item") {
      addChecklistMutation.mutate(text);
      setNewText("");
    } else {
      // Task mode: open the create dialog so the user can optionally add a description
      setCreateTaskTitle(text);
      setCreateTaskDesc("");
      setShowCreateDialog(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  function openEditDesc(task: JobTask) {
    setEditingTask(task);
    setEditTaskDesc(descriptionInitialValue(task));
  }

  const isLoading = clLoading || taskLoading;
  const isAdding = addChecklistMutation.isPending || addTaskMutation.isPending;

  // Hide card when empty and user cannot edit (non-owners / read-only)
  if (!isLoading && totalItems === 0 && !canEditChecklist && !canEditTasks) return null;

  const badgeLabel =
    totalItems > 0 ? `${completedItems} of ${totalItems} complete` : "No items";

  return (
    <>
      <Card data-testid="unified-work-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListChecks className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
            Work Items
            {totalItems > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {badgeLabel}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Checklist items ── */}
              {checklistItems.length > 0 && (
                <div className="space-y-1">
                  {tasks.length > 0 && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Checklist
                    </p>
                  )}
                  {checklistItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
                      data-testid={`checklist-item-${item.id}`}
                    >
                      <Checkbox
                        checked={item.isCompleted}
                        onCheckedChange={(checked) =>
                          toggleChecklistMutation.mutate({ id: item.id, isCompleted: checked as boolean })
                        }
                        disabled={readOnly}
                        data-testid={`checkbox-checklist-${item.id}`}
                      />
                      <span
                        className={`flex-1 text-sm ${
                          item.isCompleted ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.text}
                      </span>
                      {canEditChecklist && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Promote to full task — owner-only */}
                          {canEditTasks && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => promoteMutation.mutate(item)}
                              title="Convert to full task"
                              data-testid={`button-promote-checklist-${item.id}`}
                            >
                              <ArrowUpCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteChecklistMutation.mutate(item.id)}
                            data-testid={`button-delete-checklist-${item.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Full tasks ── */}
              {tasks.length > 0 && (
                <div className="space-y-1">
                  {checklistItems.length > 0 && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Tasks
                    </p>
                  )}
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg bg-muted/50"
                      data-testid={`job-task-${task.id}`}
                    >
                      <Checkbox
                        checked={task.status === "done"}
                        onCheckedChange={() =>
                          toggleTaskMutation.mutate({ id: task.id, status: task.status })
                        }
                        disabled={!canEditTasks}
                        className="mt-0.5"
                        data-testid={`checkbox-task-${task.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            task.status === "done" ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <TaskMarkdown content={task.description} />
                        )}
                      </div>
                      {canEditTasks && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 shrink-0 ${task.description ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => openEditDesc(task)}
                            title="Edit description"
                            data-testid={`button-edit-desc-task-${task.id}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            data-testid={`button-delete-task-${task.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {totalItems === 0 && (canEditChecklist || canEditTasks) && (
                <p className="text-sm text-muted-foreground py-1">
                  Add checklist items or tasks to track work for this job.
                </p>
              )}

              {/* ── Add row — visible when user can add at least one item type ── */}
              {(canEditChecklist || canEditTasks) && (
                <div className="space-y-2 pt-1">
                  {/* Mode toggle: "Full task" only shown to owners */}
                  {canEditTasks && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAddMode("item")}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                          addMode === "item"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                        data-testid="toggle-add-mode-item"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        Checklist item
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode("task")}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                          addMode === "task"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                        data-testid="toggle-add-mode-task"
                      >
                        <List className="h-3.5 w-3.5" />
                        Full task
                      </button>
                    </div>
                  )}

                  {/* Input: only show when the selected mode is allowed */}
                  {(addMode === "item" ? canEditChecklist : canEditTasks) && (
                    <div className="flex gap-2">
                      <Input
                        placeholder={addMode === "item" ? "Add a checklist item..." : "Add a task..."}
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isAdding}
                        data-testid="input-new-work-item"
                      />
                      <Button
                        size="icon"
                        onClick={handleAdd}
                        disabled={!newText.trim() || isAdding}
                        data-testid="button-add-work-item"
                      >
                        {isAdding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create task with description dialog ── */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) setShowCreateDialog(false);
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              Add a title and optional description with headings, lists, and formatted steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={createTaskTitle}
                onChange={(e) => setCreateTaskTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                data-testid="input-create-task-title"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && createTaskTitle.trim()) {
                    addTaskMutation.mutate({
                      title: createTaskTitle.trim(),
                      description: createTaskDesc || undefined,
                    });
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                value={createTaskDesc}
                onChange={(e) => setCreateTaskDesc(e.target.value)}
                placeholder={"## Heading\n- Bullet item\n1. Numbered step\n\nOr write plain instructions..."}
                className="min-h-[140px] font-mono text-xs resize-none"
                data-testid="textarea-create-task-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addTaskMutation.mutate({
                  title: createTaskTitle.trim(),
                  description: createTaskDesc || undefined,
                })
              }
              disabled={!createTaskTitle.trim() || addTaskMutation.isPending}
              data-testid="button-confirm-add-task"
            >
              {addTaskMutation.isPending ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit description dialog ── */}
      <Dialog
        open={!!editingTask}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
            setEditTaskDesc("");
          }
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-edit-desc">
          <DialogHeader>
            <DialogTitle className="truncate">{editingTask?.title}</DialogTitle>
            <DialogDescription>
              Edit the description. Supports headings (## H2, ### H3), bullet lists, numbered
              lists, **bold**, and *italic*.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <Label>Description</Label>
            <Textarea
              value={editTaskDesc}
              onChange={(e) => setEditTaskDesc(e.target.value)}
              placeholder={"## Heading\n- Bullet item\n1. Numbered step\n\nOr write plain instructions..."}
              className="min-h-[180px] font-mono text-xs resize-none"
              data-testid="textarea-edit-task-desc"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingTask(null);
                setEditTaskDesc("");
              }}
            >
              Cancel
            </Button>
            {editingTask && editTaskDesc.trim() && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  updateDescMutation.mutate({ id: editingTask.id, description: null })
                }
                disabled={updateDescMutation.isPending}
                data-testid="button-confirm-clear-desc"
              >
                Clear
              </Button>
            )}
            <Button
              onClick={() =>
                editingTask &&
                updateDescMutation.mutate({ id: editingTask.id, description: editTaskDesc })
              }
              disabled={!editingTask || updateDescMutation.isPending}
              data-testid="button-confirm-save-desc"
            >
              {updateDescMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UnifiedWorkSection;
