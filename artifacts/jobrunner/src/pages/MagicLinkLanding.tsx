import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, ShieldCheck, AlertCircle, Briefcase, Check, X, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Phase = "loading" | "error" | "name-gate" | "code-entry" | "revoked-self";

interface Preview {
  status?: string;
  revoked: boolean;
  nameConfirmed: boolean;
  requiresCode: boolean;
  contactNameFirstChar: string;
  business: { companyName: string };
}

export default function MagicLinkLanding() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Load preview on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/m/${token}/preview`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(data?.error || "This link can't be opened.");
          setPhase("error");
          return;
        }
        setPreview(data as Preview);
        // If they've already confirmed previously and code isn't required,
        // jump them straight into the dashboard via existing webview.
        if (data.nameConfirmed && !data.requiresCode) {
          // Re-confirm to issue a fresh session (idempotent).
          await handleConfirm(true, /*silent*/ true, data as Preview);
          return;
        }
        // Already known recipient AND code required → skip the name-gate
        // and jump straight to code entry.
        if (data.nameConfirmed && data.requiresCode) {
          setPhase("code-entry");
          setTimeout(() => codeInputRef.current?.focus(), 50);
          return;
        }
        setPhase("name-gate");
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg("Couldn't reach JobRunner. Check your connection and try again.");
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const businessName = preview?.business.companyName || "A contractor";
  const firstChar = preview?.contactNameFirstChar || "?";

  async function handleConfirm(yes: boolean, silent = false, overridePreview?: Preview) {
    if (!token) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/m/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: yes }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (!silent) {
          toast({
            title: "Couldn't confirm",
            description: data?.error || "Something went wrong.",
            variant: "destructive",
          });
        }
        setConfirming(false);
        return;
      }

      if (!yes) {
        setPhase("revoked-self");
        setConfirming(false);
        return;
      }

      const eff = overridePreview || preview;
      if (data.requiresCode) {
        setPhase("code-entry");
        setConfirming(false);
        // Focus the code input after render
        setTimeout(() => codeInputRef.current?.focus(), 50);
        return;
      }

      // Success — store session under the same key the existing webview reads,
      // then redirect there so the sub gets the full dashboard for free.
      if (data.sessionToken) {
        try {
          localStorage.setItem(`subbie_session_${token}`, data.sessionToken);
        } catch {}
      }
      navigate(`/s/${token}`);
    } catch (e: any) {
      if (!silent) {
        toast({
          title: "Couldn't confirm",
          description: "Network error. Try again.",
          variant: "destructive",
        });
      }
      setConfirming(false);
    }
  }

  async function handleVerifyCode() {
    if (!token) return;
    const trimmed = code.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      toast({
        title: "Enter the 4-digit code",
        description: "Your contractor will read it to you.",
        variant: "destructive",
      });
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(`/api/m/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.autoRevoked) {
          setPhase("error");
          setErrorMsg("Too many wrong attempts. The contractor has been notified.");
        } else {
          setAttemptsRemaining(typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : null);
          toast({
            title: "Wrong code",
            description: data?.error || "Try again.",
            variant: "destructive",
          });
          setCode("");
          setTimeout(() => codeInputRef.current?.focus(), 50);
        }
        setVerifying(false);
        return;
      }

      if (data.sessionToken) {
        try {
          localStorage.setItem(`subbie_session_${token}`, data.sessionToken);
        } catch {}
      }
      navigate(`/s/${token}`);
    } catch (e: any) {
      toast({
        title: "Couldn't verify",
        description: "Network error. Try again.",
        variant: "destructive",
      });
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Briefcase className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">JobRunner</span>
        </div>

        {phase === "loading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Opening your link…</p>
            </CardContent>
          </Card>
        )}

        {phase === "error" && (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Can't open this link</h1>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-error-message">
                  {errorMsg}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ask the contractor to send you a fresh link.
              </p>
            </CardContent>
          </Card>
        )}

        {phase === "revoked-self" && (
          <Card>
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Check className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Got it — link cancelled</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  We've let {businessName} know this wasn't for you. No details
                  about the job were shown.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "name-gate" && preview && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-start gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sent to you by
                  </p>
                  <h2 className="font-semibold truncate" data-testid="text-business-name">
                    {businessName}
                  </h2>
                </div>
              </div>

              <h1 className="text-2xl font-semibold leading-tight mb-2">
                Quick check first
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                Are you{" "}
                <span className="font-semibold text-foreground" data-testid="text-name-prompt">
                  {`${firstChar}…`}
                </span>
                ?
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={confirming}
                  onClick={() => handleConfirm(false)}
                  data-testid="button-not-me"
                >
                  <X className="h-4 w-4" /> Not me
                </Button>
                <Button
                  size="lg"
                  disabled={confirming}
                  onClick={() => handleConfirm(true)}
                  data-testid="button-yes-its-me"
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Yes, that's me <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-6 text-center">
                We don't show any job details until you confirm.
              </p>
            </CardContent>
          </Card>
        )}

        {phase === "code-entry" && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-start gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    One more step
                  </p>
                  <h2 className="font-semibold truncate">{businessName}</h2>
                </div>
              </div>

              <h1 className="text-2xl font-semibold leading-tight mb-2">
                Enter the 4-digit code
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                {businessName} will read it to you over the phone or in person.
                We never send it by SMS.
              </p>

              <Input
                ref={codeInputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 4) {
                    handleVerifyCode();
                  }
                }}
                placeholder="• • • •"
                className="text-center text-3xl tracking-[0.5em] font-mono h-16"
                data-testid="input-magic-code"
              />

              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <p className="text-xs text-destructive mt-2 text-center" data-testid="text-attempts-remaining">
                  Wrong code — {attemptsRemaining} {attemptsRemaining === 1 ? "attempt" : "attempts"} left
                </p>
              )}

              <Button
                size="lg"
                className="w-full mt-6"
                disabled={verifying || code.length !== 4}
                onClick={handleVerifyCode}
                data-testid="button-verify-code"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open job"}
              </Button>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                3 wrong attempts will cancel this link.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          Powered by JobRunner · A LinkUp2Care product
        </p>
      </div>
    </div>
  );
}
