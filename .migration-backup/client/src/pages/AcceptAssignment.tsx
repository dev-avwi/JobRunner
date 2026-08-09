import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/ui/signature-pad";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Loader2, Shield, FileText, PenTool, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AcceptAssignment() {
  const [, params] = useRoute("/accept-assignment/:jobId/:assignmentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const jobId = params?.jobId || '';
  const assignmentId = params?.assignmentId || '';

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [confidentialityAgreed, setConfidentialityAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { data: assignmentDetails, isLoading, error } = useQuery({
    queryKey: ['/api/jobs', jobId, 'assignments', assignmentId, 'details'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/assignments/${assignmentId}/details`);
      if (!res.ok) throw new Error('Failed to load assignment details');
      return res.json();
    },
    enabled: !!jobId && !!assignmentId,
  });

  const handleAccept = async () => {
    if (!signatureData) {
      toast({ title: "Signature Required", description: "Please sign to accept this assignment", variant: "destructive" });
      return;
    }
    if (!confidentialityAgreed) {
      toast({ title: "Agreement Required", description: "Please agree to the confidentiality terms", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('POST', `/api/jobs/${jobId}/assignments/${assignmentId}/accept`, {
        signature_data: signatureData,
        confidentiality_agreed: true,
        signer_name: assignmentDetails?.workerName || 'Worker',
      });
      setAccepted(true);
      toast({ title: "Assignment Accepted", description: "You have successfully accepted this assignment" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || 'Failed to accept assignment', variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!jobId || !assignmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                This assignment link is invalid. Please check the link and try again.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => setLocation('/')}
              className="w-full mt-4"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading assignment details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !assignmentDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Assignment Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {(error as Error)?.message || 'Unable to load assignment details. The assignment may have been removed or you may not have access.'}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => setLocation('/')}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyAccepted = assignmentDetails.assignmentStatus === 'accepted' || assignmentDetails.hasSignature;

  if (accepted || alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-600">
              Assignment Accepted
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {accepted
                ? <>You have successfully accepted this assignment for <span className="font-semibold text-foreground">{assignmentDetails.jobTitle}</span></>
                : <>This assignment for <span className="font-semibold text-foreground">{assignmentDetails.jobTitle}</span> has already been accepted</>
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-md p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Business</p>
              <p className="font-medium">{assignmentDetails.businessName}</p>
              {assignmentDetails.scheduledDate && (
                <>
                  <p className="text-sm text-muted-foreground mt-2">Scheduled</p>
                  <p className="font-medium">{new Date(assignmentDetails.scheduledDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </>
              )}
            </div>
            {assignmentDetails.signatureData && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">Signature on file</p>
                <div className="border rounded-md p-3 bg-white">
                  <img src={assignmentDetails.signatureData} alt="Acceptance signature" className="max-h-24 mx-auto" />
                </div>
              </div>
            )}
            <Button
              onClick={() => setLocation('/')}
              className="w-full"
              size="lg"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Accept Assignment</CardTitle>
          <CardDescription className="text-base mt-2">
            Review and accept your job assignment
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-md p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Job Title</p>
                <p className="text-xl font-semibold text-foreground">{assignmentDetails.jobTitle}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="font-medium text-sm">{assignmentDetails.businessName}</p>
                </div>
              </div>

              {assignmentDetails.jobAddress && (
                <div className="flex items-start gap-3">
                  <div className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium text-sm">{assignmentDetails.jobAddress}</p>
                  </div>
                </div>
              )}

              {assignmentDetails.scheduledDate && (
                <div className="flex items-start gap-3">
                  <div className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Scheduled Date</p>
                    <p className="font-medium text-sm">
                      {new Date(assignmentDetails.scheduledDate).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={alreadyAccepted ? "default" : "secondary"} className="mt-1">
                    {assignmentDetails.assignmentStatus || 'Pending'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {!alreadyAccepted && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Confidentiality Agreement</h3>
                </div>
                <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground space-y-3 max-h-64 overflow-y-auto">
                  <p>By accepting this assignment, you agree to the following confidentiality terms:</p>
                  <p>1. All client information, job details, pricing, and business operations shared with you are strictly confidential.</p>
                  <p>2. You agree not to disclose any client contact details, job addresses, pricing information, or business strategies to any third party.</p>
                  <p>3. You will not solicit or accept direct work from any client introduced to you through this assignment for a period of 12 months after the job is completed.</p>
                  <p>4. All photos, documents, and records created during this assignment remain the property of the business and may not be shared or used without written permission.</p>
                  <p>5. Breach of these terms may result in immediate termination of the working relationship and potential legal action.</p>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-md border">
                  <Checkbox
                    id="confidentiality"
                    checked={confidentialityAgreed}
                    onCheckedChange={(checked) => setConfidentialityAgreed(checked === true)}
                  />
                  <Label htmlFor="confidentiality" className="text-sm cursor-pointer leading-relaxed">
                    I have read and agree to the confidentiality terms above
                  </Label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Digital Signature</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Please sign below to confirm your acceptance of this assignment.
                </p>
                <SignaturePad onSignatureChange={setSignatureData} />
              </div>

              <Button
                onClick={handleAccept}
                disabled={submitting || !signatureData || !confidentialityAgreed}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Accept Assignment
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
