import { useState, useRef, useCallback } from "react";
import { X, MessageSquarePlus, Star, ImagePlus, Trash2 } from "lucide-react";
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

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export default function FeedbackTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const addPhotos = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const remaining = MAX_PHOTOS - photos.length;
      const toAdd = arr.slice(0, remaining);
      const oversized = toAdd.filter((f) => f.size > MAX_PHOTO_BYTES);
      if (oversized.length) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Each image must be under 5 MB.",
        });
        return;
      }
      const newPhotos = [...photos, ...toAdd];
      setPhotos(newPhotos);
      // Generate object URL previews
      const newPreviews = [...photoPreviews];
      for (const f of toAdd) newPreviews.push(URL.createObjectURL(f));
      setPhotoPreviews(newPreviews);
    },
    [photos, photoPreviews, toast],
  );

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotos((p) => p.filter((_, i) => i !== idx));
    setPhotoPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addPhotos(e.dataTransfer.files);
  };

  function resetForm() {
    photos.forEach((_, i) => URL.revokeObjectURL(photoPreviews[i]));
    setType("general");
    setMessage("");
    setRating(0);
    setHoverRating(0);
    setPhotos([]);
    setPhotoPreviews([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("feedbackType", type);
      formData.append("message", message.trim());
      if (rating > 0) formData.append("rating", String(rating));
      formData.append("platform", "web");
      formData.append("currentRoute", window.location.pathname);
      if ((user as any)?.id) formData.append("userId", (user as any).id);
      photos.forEach((p) => formData.append("photos", p));

      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Submission failed");
      }

      toast({
        title: "Thanks for your feedback",
        description: "We read every submission and will follow up if needed.",
      });
      resetForm();
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

  const activeRating = hoverRating || rating;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating pill button — bottom-right, above the AI chat FAB */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? "Close feedback" : "Send feedback"}
        aria-expanded={isOpen}
        className="fixed bottom-40 md:bottom-20 right-4 z-50 flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform duration-150 hover:scale-105"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium">Feedback</span>
      </button>

      {/* Modal panel */}
      {isOpen && (
        <div
          className="fixed bottom-56 md:bottom-32 right-4 z-50 w-80 rounded-xl border bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit} className="flex flex-col p-4 gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Send Feedback</h2>
              <button
                type="button"
                onClick={() => { setIsOpen(false); }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label htmlFor="feedback-type" className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                <SelectTrigger id="feedback-type" className="h-8 text-sm">
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
            <div className="space-y-1">
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
                className="min-h-[90px] resize-none text-sm"
                required
              />
            </div>

            {/* Star rating */}
            <div className="space-y-1">
              <Label className="text-xs">Rating (optional)</Label>
              <div className="flex gap-1" role="group" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star === rating ? 0 : star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                    className="focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                  >
                    <Star
                      className={`h-5 w-5 transition-colors ${
                        star <= activeRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Photo upload */}
            <div className="space-y-1">
              <Label className="text-xs">
                Screenshots (optional, up to {MAX_PHOTOS})
              </Label>
              {/* Drag-and-drop zone */}
              {photos.length < MAX_PHOTOS && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    Drag & drop or click to browse
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addPhotos(e.target.files)}
                  />
                </div>
              )}
              {/* Previews */}
              {photoPreviews.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative h-14 w-14 rounded overflow-hidden border">
                      <img
                        src={src}
                        alt={`Screenshot ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 text-destructive hover:bg-background"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

            <p className="text-center text-[11px] text-muted-foreground -mt-1">
              We read every submission.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
