import JobPicker from "@/components/JobPicker";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Send, Phone, ShieldCheck, AlertTriangle, Copy, CheckCircle2,
  Link2, MessageSquare, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SendMagicLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobId?: string;
  onSent?: () => void;
}

interface JobOption {
  id: string;
  title: string;
  address?: string | null;
  scheduledAt?: string | null;
}

function formatAuPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("61") && digits.length >= 11) {
    const local = digits.slice(2);
    return `+61 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
  return raw;
}

function last4(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-4) || "––––";
}

function maskedPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return raw;
  if (digits.startsWith("61")) {
    const local = digits.slice(2);
    return `+61 4XX XXX ${local.slice(-3)}`;
  }
  return `04XX XXX ${digits.slice(-3)}`;
}

export default function SendMagicLinkSheet({
  open, onOpenChange, defaultJobId, onSent,
}: SendMagicLinkSheetProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobId, setJobId] = useState<string | undefined>(defaultJobId);
  // Default ON: safer for new contractors who don't think about wrong-number
  // risk. They can flick it off if the recipient is well-known.
  const [requireCode, setRequireCode] = useState(true);
  const [hourlyRate, setHourlyRate] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const jobsQuery = useQuery<JobOption[]>({
    queryKey: ["/api/jobs"],
  });

  const jobs = useMemo(() => {
    const list = (jobsQuery.data ?? []) as any[];
    return list.slice(0, 50).map((j) => ({
      id: j.id,
      title: j.title || "Untitled job",
      address: j.address,
      scheduledAt: j.scheduledAt,
    })) as JobOption[];
  }, [jobsQuery.data]);

  const selectedJob = jobs.find((j) => j.id === jobId);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Pick a job first");
      const res = await apiRequest("POST", `/api/jobs/${jobId}/subcontractor-token`, {
        contactName: name.trim(),
        contactPhone: phone.trim(),
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        requireCode,
        sendViaSms: true,
      });
      return res;
    },
    onSuccess: (data: any) => {
      setIssuedCode(data?.verificationCode || null);
      setIssuedLink(data?.webLink || null);
      setConfirmOpen(false);
      setSuccessOpen(true);
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractors"] });
      onSent?.();
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't send link",
        description: err?.message || "Something went wrong. Try again.",
        variant: "destructive",
      });
    },
  });

  const valid = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10 && !!jobId;

  const reset = () => {
    setName(""); setPhone(""); setJobId(defaultJobId);
    // Reset to safe default ON, matching the initial useState above. This
    // prevents a closed/reopened sheet from silently switching to no-code.
    setRequireCode(true);
    setHourlyRate(""); setIssuedCode(null); setIssuedLink(null); setCodeCopied(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
        <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-md bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Link2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <SheetTitle className="text-base">Send job link</SheetTitle>
                <SheetDescription className="text-xs">
                  No app needed. Sub gets a link via SMS.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Sub's name</Label>
              <Input
                id="sub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jake Smith"
                data-testid="input-sub-name"
              />
              <p className="text-xs text-muted-foreground">They'll see "Are you Jake Smith?" before any details show.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-phone">Mobile number</Label>
              <Input
                id="sub-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0412 345 678"
                inputMode="tel"
                data-testid="input-sub-phone"
              />
              {phone && (
                <p className="text-xs text-muted-foreground">
                  Will send to <span className="font-mono font-semibold text-foreground">{formatAuPhone(phone)}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-job">Which job?</Label>
              <JobPicker
                value={jobId || ""}
                onChange={setJobId}
                label={null}
                placeholder="Pick a job..."
                filterJobs={(job) => jobs.some((j: any) => j.id === job.id)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-rate">Hourly rate (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="sub-rate"
                  type="number"
                  inputMode="decimal"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="80"
                  className="pl-7"
                  data-testid="input-sub-rate"
                />
              </div>
            </div>

            <div className="rounded-md border p-3 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="require-code" className="text-sm font-semibold cursor-pointer">
                    Require verification code
                  </Label>
                  <Switch
                    id="require-code"
                    checked={requireCode}
                    onCheckedChange={setRequireCode}
                    data-testid="switch-require-code"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  We'll show you a 4-digit code. Tell {name.split(" ")[0] || "the sub"} separately (call, in person, WhatsApp).
                  Stops a wrong-number stranger ever seeing the job.
                </p>
              </div>
            </div>

            {selectedJob && (
              <div className="rounded-md bg-muted/40 border p-3 text-xs">
                <div className="font-semibold text-sm">{selectedJob.title}</div>
                {selectedJob.address && <div className="text-muted-foreground mt-0.5">{selectedJob.address}</div>}
              </div>
            )}
          </div>

          <SheetFooter className="px-6 py-4 border-t flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { reset(); onOpenChange(false); }} data-testid="button-cancel-send-link">
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!valid || sendMutation.isPending}
              onClick={() => setConfirmOpen(true)}
              data-testid="button-review-and-send"
            >
              <Send className="w-4 h-4" /> Review & send
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog — last 4 of phone in big */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-confirm-send">
          <DialogHeader>
            <div className="w-10 h-10 rounded-md bg-warning/10 text-warning flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center">Double-check the number</DialogTitle>
            <DialogDescription className="text-center">
              Wrong-number SMS = a stranger sees your job. Worth 2 seconds of you eyeballing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border p-4 text-center">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                Sending to
              </div>
              <div className="text-base font-semibold mb-2" data-testid="text-confirm-name">{name}</div>
              <div className="font-mono text-2xl font-bold tabular-nums tracking-wide" data-testid="text-confirm-phone">
                {formatAuPhone(phone).replace(/\d{3}$/, (last) => "")}
                <span className="text-primary">{last4(phone)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Last 4 digits highlighted. Match what {name.split(" ")[0] || "they"} gave you?
              </div>
            </div>

            {requireCode && (
              <div className="rounded-md bg-purple-500/5 border border-purple-500/20 p-3 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  Verification code is on. We'll show it to you on the next screen — don't text or email it, tell them another way.
                </div>
              </div>
            )}

            {selectedJob && (
              <div className="rounded-md bg-muted/40 p-3 text-xs">
                <div className="text-muted-foreground">Job</div>
                <div className="font-medium">{selectedJob.title}</div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
              disabled={sendMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              Wait, fix number
            </Button>
            <Button
              className="flex-1"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send link</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success / code reveal */}
      <Dialog open={successOpen} onOpenChange={(o) => { setSuccessOpen(o); if (!o) { onOpenChange(false); reset(); } }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-send-success">
          <DialogHeader>
            <div className="w-10 h-10 rounded-md bg-success/10 text-success flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center">Link sent</DialogTitle>
            <DialogDescription className="text-center">
              {name || "The sub"} just got an SMS. They'll see "Are you {name.split(" ")[0] || "Jake"}?" before any details appear.
            </DialogDescription>
          </DialogHeader>

          {issuedCode && (
            <div className="space-y-3">
              <div className="rounded-md bg-purple-500/5 border border-purple-500/30 p-4 text-center">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Verification code
                </div>
                <div className="font-mono text-4xl font-bold tracking-[0.4em] text-purple-700" data-testid="text-issued-code">
                  {issuedCode}
                </div>
                <div className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  Tell {name.split(" ")[0] || "them"} this code <b>another way</b> (call, in person, WhatsApp).
                  Don't text it — that defeats the purpose.
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(issuedCode);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                }}
                data-testid="button-copy-code"
              >
                {codeCopied ? <><CheckCircle2 className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy code</>}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => { setSuccessOpen(false); onOpenChange(false); reset(); }}
              data-testid="button-success-done"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
