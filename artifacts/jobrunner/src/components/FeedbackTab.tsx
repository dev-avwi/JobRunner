import { useState } from "react";
import { X, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const TYPES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
] as const;

type FeedbackType = (typeof TYPES)[number]["value"];

export default function FeedbackTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: type,
          severity: type === "bug" ? "medium" : "low",
          description: message.trim(),
          userName: (user as any)?.name ?? undefined,
          userEmail: (user as any)?.email ?? undefined,
          userId: (user as any)?.id ?? undefined,
          screenName: window.location.pathname,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Submission failed");
      }
      toast({
        title: "Thanks for your feedback",
        description: "We read every submission and will follow up if needed.",
      });
      setMessage("");
      setType("general");
      setIsOpen(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not send feedback",
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop — closes panel on outside click */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Tab + sliding panel, anchored to right edge, vertically centred */}
      <div
        className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2 items-stretch"
        style={{ willChange: "transform" }}
      >
        {/* Vertical tab trigger */}
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="flex flex-col items-center justify-center gap-1.5 rounded-l-md bg-primary px-1.5 py-4 text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isOpen ? "Close feedback panel" : "Open feedback panel"}
          aria-expanded={isOpen}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          <span
            className="text-xs font-medium tracking-wide"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Feedback
          </span>
        </button>

        {/* Sliding panel */}
        <div
          className={`overflow-hidden rounded-l-lg border border-r-0 bg-background shadow-xl transition-all duration-300 ease-in-out ${
            isOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          }`}
          aria-hidden={!isOpen}
        >
          <form onSubmit={handleSubmit} className="flex h-full w-80 flex-col p-4">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Send Feedback</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type */}
            <div className="mb-3 space-y-1.5">
              <Label htmlFor="feedback-type" className="text-xs">
                Type
              </Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as FeedbackType)}
              >
                <SelectTrigger id="feedback-type" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="mb-4 flex flex-1 flex-col space-y-1.5">
              <Label htmlFor="feedback-message" className="text-xs">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "Describe what happened and what you expected..."
                    : type === "feature"
                    ? "What would you like to see added or improved?"
                    : "What's on your mind?"
                }
                className="min-h-[120px] flex-1 resize-none text-sm"
                required
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full"
              size="sm"
            >
              {submitting ? "Sending..." : "Send Feedback"}
            </Button>

            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              We read every submission.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
