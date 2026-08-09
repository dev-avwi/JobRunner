import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Clipboard, CheckCircle2, User, Phone, Mail, MapPin, FileText, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ParsedJob {
  success: boolean;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  address?: string;
  description: string;
  suggestedTitle: string;
  urgency: 'urgent' | 'normal' | 'flexible';
  extractedDetails: string[];
}

interface PasteJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateJob: (data: {
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    address?: string;
    title: string;
    description: string;
    urgency: string;
  }) => void;
}

export default function PasteJobModal({ open, onOpenChange, onCreateJob }: PasteJobModalProps) {
  const { toast } = useToast();
  const [pastedText, setPastedText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedJob | null>(null);
  const [editedData, setEditedData] = useState<{
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    address: string;
    title: string;
    description: string;
  }>({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    address: "",
    title: "",
    description: "",
  });

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest('POST', '/api/ai/parse-job-text', { text });
      return await response.json() as ParsedJob;
    },
    onSuccess: (data) => {
      setParsedData(data);
      setEditedData({
        clientName: data.clientName || "",
        clientPhone: data.clientPhone || "",
        clientEmail: data.clientEmail || "",
        address: data.address || "",
        title: data.suggestedTitle || "",
        description: data.description || "",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to parse text. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleParse = () => {
    if (pastedText.trim().length >= 10) {
      parseMutation.mutate(pastedText.trim());
    }
  };

  const handleCreate = () => {
    if (editedData.title.trim()) {
      onCreateJob({
        clientName: editedData.clientName || undefined,
        clientPhone: editedData.clientPhone || undefined,
        clientEmail: editedData.clientEmail || undefined,
        address: editedData.address || undefined,
        title: editedData.title,
        description: editedData.description,
        urgency: parsedData?.urgency || 'normal',
      });
      onOpenChange(false);
      resetState();
    }
  };

  const resetState = () => {
    setPastedText("");
    setParsedData(null);
    setEditedData({
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      address: "",
      title: "",
      description: "",
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Urgent</Badge>;
      case 'flexible':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Flexible</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clipboard className="h-5 w-5 text-primary" />
            Instant Job from Text
          </DialogTitle>
          <DialogDescription>
            Paste an SMS, email, or message and I'll extract job details automatically.
          </DialogDescription>
        </DialogHeader>

        {!parsedData ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paste-text">Paste message here</Label>
              <Textarea
                id="paste-text"
                placeholder={`e.g., "Hi mate, John here from 45 Smith St Parramatta. Hot water's gone cold, can you come have a look? My number is 0412 345 678. Pretty urgent if possible!"`}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                data-testid="input-paste-job-text"
              />
              <p className="text-xs text-muted-foreground">
                I'll extract client name, phone, email, address, and job details
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Extracted Details</h3>
              {getUrgencyBadge(parsedData.urgency)}
            </div>

            {parsedData.extractedDetails.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {parsedData.extractedDetails.slice(0, 5).map((detail, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{detail}</Badge>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-name" className="flex items-center gap-1 text-xs">
                  <User className="h-3 w-3" />
                  Client Name
                </Label>
                <Input
                  id="client-name"
                  value={editedData.clientName}
                  onChange={(e) => setEditedData({ ...editedData, clientName: e.target.value })}
                  placeholder="Client name"
                  data-testid="input-parsed-client-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-phone" className="flex items-center gap-1 text-xs">
                    <Phone className="h-3 w-3" />
                    Phone
                  </Label>
                  <Input
                    id="client-phone"
                    value={editedData.clientPhone}
                    onChange={(e) => setEditedData({ ...editedData, clientPhone: e.target.value })}
                    placeholder="Phone number"
                    data-testid="input-parsed-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-email" className="flex items-center gap-1 text-xs">
                    <Mail className="h-3 w-3" />
                    Email
                  </Label>
                  <Input
                    id="client-email"
                    value={editedData.clientEmail}
                    onChange={(e) => setEditedData({ ...editedData, clientEmail: e.target.value })}
                    placeholder="Email address"
                    data-testid="input-parsed-email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" />
                  Address
                </Label>
                <Input
                  id="address"
                  value={editedData.address}
                  onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                  placeholder="Job site address"
                  data-testid="input-parsed-address"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title" className="flex items-center gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  Job Title
                </Label>
                <Input
                  id="title"
                  value={editedData.title}
                  onChange={(e) => setEditedData({ ...editedData, title: e.target.value })}
                  placeholder="Job title"
                  data-testid="input-parsed-title"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea
                  id="description"
                  value={editedData.description}
                  onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                  placeholder="Job description"
                  rows={3}
                  data-testid="input-parsed-description"
                />
              </div>
            </div>

            {(!editedData.clientName && !editedData.clientPhone) && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                <span>No client details found. You can add them manually above.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {!parsedData ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-paste-job">
                Cancel
              </Button>
              <Button 
                onClick={handleParse} 
                disabled={parseMutation.isPending || pastedText.trim().length < 10}
                data-testid="button-parse-job-text"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Clipboard className="h-4 w-4 mr-2" />
                    Extract Details
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setParsedData(null);
                  setPastedText("");
                }}
                data-testid="button-paste-again"
              >
                Paste Different Text
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!editedData.title.trim()}
                data-testid="button-create-parsed-job"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create Job
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
