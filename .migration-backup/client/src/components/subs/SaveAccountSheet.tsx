import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Briefcase,
} from "lucide-react";

interface SaveAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  sessionToken: string;
  businessName?: string;
  onSaved?: (mode: "linked" | "created") => void;
}

interface AccountStatus {
  hasAccount: boolean;
  alreadyLinked: boolean;
  firstName?: string | null;
}

const TRADES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "carpentry", label: "Carpentry" },
  { value: "tiling", label: "Tiling" },
  { value: "painting", label: "Painting" },
  { value: "landscaping", label: "Landscaping" },
  { value: "roofing", label: "Roofing" },
  { value: "concreting", label: "Concreting" },
  { value: "hvac", label: "HVAC / Air-con" },
  { value: "handyman", label: "Handyman" },
  { value: "other", label: "Other" },
];

export default function SaveAccountSheet({
  open,
  onOpenChange,
  token,
  sessionToken,
  businessName,
  onSaved,
}: SaveAccountSheetProps) {
  const { toast } = useToast();

  const [phase, setPhase] = useState<"loading" | "existing" | "new" | "success">("loading");
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedMode, setSavedMode] = useState<"linked" | "created" | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tradeType, setTradeType] = useState<string>("");

  // Re-fetch status whenever the sheet opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    setSavedMode(null);
    (async () => {
      try {
        const res = await fetch(`/api/m/${token}/account-status`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast({
            title: "Couldn't load",
            description: data?.error || "Try again in a moment.",
            variant: "destructive",
          });
          onOpenChange(false);
          return;
        }
        setStatus(data as AccountStatus);
        if (data.hasAccount) {
          setPhase("existing");
          if (data.firstName) setFirstName(data.firstName);
        } else {
          setPhase("new");
        }
      } catch (e) {
        if (cancelled) return;
        toast({
          title: "Network error",
          description: "Check your connection and try again.",
          variant: "destructive",
        });
        onOpenChange(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, sessionToken, onOpenChange, toast]);

  function reset() {
    setFirstName("");
    setLastName("");
    setTradeType("");
    setPhase("loading");
    setStatus(null);
    setSavedMode(null);
  }

  async function handleSave(includeForm: boolean) {
    setSubmitting(true);
    try {
      const body: Record<string, string> = {};
      if (includeForm) {
        const f = firstName.trim();
        if (!f) {
          toast({
            title: "Add your first name",
            description: "We'll use it on future job links from any contractor.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
        body.firstName = f;
        if (lastName.trim()) body.lastName = lastName.trim();
        if (tradeType) body.tradeType = tradeType;
      }

      const res = await fetch(`/api/m/${token}/save-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't save",
          description: data?.error || "Try again in a moment.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      setSavedMode(data.mode || "linked");
      setPhase("success");
      onSaved?.(data.mode || "linked");
    } catch (e) {
      toast({
        title: "Network error",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="bottom"
        className="px-0 pb-0 max-h-[92dvh] overflow-y-auto rounded-t-xl"
      >
        <div className="px-6 pt-2 pb-6">
          {/* Pull tab */}
          <div className="mx-auto h-1 w-10 rounded-full bg-muted mb-4" />

          <SheetHeader className="text-left mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Free JobRunner account
              </span>
            </div>
            {phase === "loading" && (
              <SheetTitle className="text-xl">Loading…</SheetTitle>
            )}
            {phase === "existing" && (
              <>
                <SheetTitle className="text-2xl leading-tight">
                  {status?.firstName ? `Welcome back, ${status?.firstName}` : "Welcome back"}
                </SheetTitle>
                <SheetDescription className="pt-1.5">
                  Save{" "}
                  <span className="font-semibold text-foreground">
                    {businessName || "this contractor"}
                  </span>{" "}
                  to your contractors list. Future job links from anyone go straight in — no name confirm needed.
                </SheetDescription>
              </>
            )}
            {phase === "new" && (
              <>
                <SheetTitle className="text-2xl leading-tight">Save your spot — 30 seconds</SheetTitle>
                <SheetDescription className="pt-1.5">
                  Get a free JobRunner account so the next link from any contractor opens straight to the job.
                </SheetDescription>
              </>
            )}
            {phase === "success" && (
              <SheetTitle className="text-2xl leading-tight">
                {savedMode === "created" ? "Welcome to JobRunner" : "All set"}
              </SheetTitle>
            )}
          </SheetHeader>

          {/* Loading */}
          {phase === "loading" && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Existing user — one-tap link */}
          {phase === "existing" && status && (
            <div className="space-y-4">
              <div className="rounded-md border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      Linked by your phone number
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      We've matched you to your existing JobRunner account. Tap below to add this job's contractor to your list.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={submitting || status.alreadyLinked}
                onClick={() => handleSave(false)}
                data-testid="button-link-existing-account"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status.alreadyLinked ? (
                  "Already in your contractors"
                ) : (
                  <>Add {businessName || "contractor"} to my list</>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-save-account-skip"
              >
                Not now
              </Button>
            </div>
          )}

          {/* New user — short form */}
          {phase === "new" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="sa-firstName">First name</Label>
                <Input
                  id="sa-firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jake"
                  autoComplete="given-name"
                  className="mt-1.5"
                  data-testid="input-save-account-first-name"
                />
              </div>

              <div>
                <Label htmlFor="sa-lastName" className="flex items-center gap-1.5">
                  Last name <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="sa-lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tester"
                  autoComplete="family-name"
                  className="mt-1.5"
                  data-testid="input-save-account-last-name"
                />
              </div>

              <div>
                <Label className="flex items-center gap-1.5">
                  Trade <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Select value={tradeType} onValueChange={setTradeType}>
                  <SelectTrigger className="mt-1.5" data-testid="select-save-account-trade">
                    <SelectValue placeholder="Pick your trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md bg-muted/50 px-3 py-2.5 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Free forever. We'll never SMS you marketing — only contractors you've worked with can send you job links.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={submitting || !firstName.trim()}
                onClick={() => handleSave(true)}
                data-testid="button-save-account-submit"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create my free account"
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-save-account-skip-form"
              >
                Skip for now
              </Button>
            </div>
          )}

          {/* Success */}
          {phase === "success" && (
            <div className="space-y-5">
              <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      {savedMode === "created"
                        ? "Account created"
                        : "Contractor saved"}
                    </p>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
                      {savedMode === "created"
                        ? `${businessName || "This contractor"} is now in your contractors list. Future job links open straight to the job — no name confirm.`
                        : `${businessName || "This contractor"} is now in your contractors list.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Faster next time</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get the JobRunner app for push notifications, GPS check-in, and a single inbox for every contractor's jobs.
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-save-account-done"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
