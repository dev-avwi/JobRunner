import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignaturePad, SignatureDisplay } from '@/components/ui/signature-pad';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PenTool, Check, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';

interface DigitalSignature {
  id: string;
  jobId: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signedAt: string;
  documentType: string;
  isValid: boolean;
}

interface JobSignatureProps {
  jobId: string;
}

export function JobSignature({ jobId }: JobSignatureProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const { data: signatures = [], isLoading } = useQuery<DigitalSignature[]>({
    queryKey: ['/api/jobs', jobId, 'signatures'],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { signerName: string; signerEmail?: string; signatureData: string }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/signatures`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'signatures'] });
      toast({ title: 'Signature saved successfully' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to save signature', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (signatureId: string) => {
      return apiRequest('DELETE', `/api/jobs/${jobId}/signatures/${signatureId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'signatures'] });
      toast({ title: 'Signature deleted' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to delete signature', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setSignerName('');
    setSignerEmail('');
    setSignatureData(null);
  };

  const handleSave = () => {
    if (!signerName.trim()) {
      toast({ 
        title: 'Name required', 
        description: 'Please enter the signer\'s name',
        variant: 'destructive' 
      });
      return;
    }
    if (!signatureData) {
      toast({ 
        title: 'Signature required', 
        description: 'Please draw a signature',
        variant: 'destructive' 
      });
      return;
    }

    saveMutation.mutate({
      signerName: signerName.trim(),
      signerEmail: signerEmail.trim() || undefined,
      signatureData,
    });
  };

  const clientSignature = signatures.find(s => s.documentType === 'job_completion');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="job-signature-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <PenTool className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
          Client Signature
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clientSignature ? (
          <div className="space-y-3">
            <SignatureDisplay 
              signatureDataUrl={clientSignature.signatureData} 
              label={`Signed by ${clientSignature.signerName}`}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {format(new Date(clientSignature.signedAt), 'MMM d, yyyy h:mm a')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(clientSignature.id)}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => setIsDialogOpen(true)}
            data-testid="button-capture-signature"
          >
            <PenTool className="h-4 w-4" />
            Capture Client Signature
          </Button>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Capture Signature</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="signerName">Client Name *</Label>
                <Input
                  id="signerName"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter client's name"
                  data-testid="input-signer-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signerEmail">Client Email (optional)</Label>
                <Input
                  id="signerEmail"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="client@email.com"
                  data-testid="input-signer-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Signature</Label>
                <SignaturePad
                  onSignatureChange={setSignatureData}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveMutation.isPending || !signerName || !signatureData}
                data-testid="button-save-signature"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save Signature
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
