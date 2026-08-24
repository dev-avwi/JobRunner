import { useState } from "react";
import { ListChecks, Plus, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useChecklist } from "@/hooks/use-checklist";

interface JobChecklistSectionProps {
  jobId: string;
  readOnly?: boolean;
}

export function JobChecklistSection({ jobId, readOnly = false }: JobChecklistSectionProps) {
  const { items, isLoading, addItem, toggleItem, deleteItem, isAdding } = useChecklist(jobId);
  const [newItemText, setNewItemText] = useState("");

  const completedCount = items.filter((item) => item.isCompleted).length;
  const totalCount = items.length;

  function handleAdd() {
    const text = newItemText.trim();
    if (!text) return;
    addItem(text);
    setNewItemText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <Card data-testid="job-checklist-section">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
          Checklist
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs font-normal">
              {completedCount}/{totalCount} done
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    data-testid={`checklist-item-${item.id}`}
                  >
                    <Checkbox
                      checked={item.isCompleted}
                      onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
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
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteItem(item.id)}
                        data-testid={`button-delete-checklist-${item.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No checklist items yet.{!readOnly && " Add items to track tasks for this job."}
              </p>
            )}

            {!readOnly && (
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Add checklist item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isAdding}
                  data-testid="input-new-checklist-item"
                />
                <Button
                  size="icon"
                  onClick={handleAdd}
                  disabled={!newItemText.trim() || isAdding}
                  data-testid="button-add-checklist-item"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default JobChecklistSection;
