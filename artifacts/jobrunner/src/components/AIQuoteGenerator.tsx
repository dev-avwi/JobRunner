import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { calculateDocumentTotals } from "@shared/financials";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Mic, MicOff, Camera, CheckCircle2, AlertCircle, ImagePlus, X, Check, RotateCcw, Wrench, Package, Truck, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'labour' | 'materials' | 'equipment' | 'other';
}

interface AIQuoteResult {
  success: boolean;
  jobType: string;
  description: string;
  lineItems: QuoteLineItem[];
  totalEstimate: number;
  gstAmount: number;
  grandTotal: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
  suggestedTitle: string;
}

interface JobPhoto {
  id: number;
  filename: string;
  mimeType: string;
  signedUrl?: string;
}

interface EditableLineItem extends QuoteLineItem {
  id: string;
  included: boolean;
  editingQty: string;
  editingPrice: string;
}

interface AIQuoteGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  onApplyItems: (items: QuoteLineItem[], title?: string, description?: string) => void;
}

type Step = 'input' | 'generating' | 'review';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

const CATEGORY_CONFIG = {
  labour: { label: 'Labour', icon: Wrench, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  materials: { label: 'Materials', icon: Package, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  equipment: { label: 'Equipment', icon: Truck, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  other: { label: 'Other', icon: HelpCircle, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
};

export default function AIQuoteGenerator({ open, onOpenChange, jobId, onApplyItems }: AIQuoteGeneratorProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('input');
  const [description, setDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([]);
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const [photosExpanded, setPhotosExpanded] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef("");

  const { data: jobPhotos = [] } = useQuery<JobPhoto[]>({
    queryKey: ['/api/jobs', jobId, 'photos'],
    queryFn: async () => {
      if (!jobId) return [];
      const res = await fetch(`/api/jobs/${jobId}/photos`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId && open,
  });

  const imagePhotos = jobPhotos.filter(p => p.mimeType?.startsWith('image/'));

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  useEffect(() => {
    if (!open) {
      stopRecording();
      setStep('input');
      setDescription("");
      setLineItems([]);
      setSuggestedTitle("");
      setAiNotes([]);
      setSelectedPhotoIds(new Set());
      setUploadedPhotos([]);
      setPhotosExpanded(false);
      setRecordingSeconds(0);
      transcriptRef.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (open && imagePhotos.length > 0 && selectedPhotoIds.size === 0) {
      setSelectedPhotoIds(new Set(imagePhotos.map(p => p.id)));
    }
  }, [open, imagePhotos.length]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'en-AU';
    recognition.continuous = true;
    recognition.interimResults = true;

    const baseText = description;
    transcriptRef.current = baseText;

    recognition.onresult = (event) => {
      let interim = '';
      let final = baseText;
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += (final ? ' ' : '') + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      transcriptRef.current = final;
      setDescription(final + (interim ? ' ' + interim : ''));
    };

    recognition.onend = () => {
      setDescription(transcriptRef.current);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recognition.onerror = () => {
      stopRecording();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
  }, [description, stopRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    setUploadedPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      setStep('generating');
      const selectedPhotos = imagePhotos.filter(p => selectedPhotoIds.has(p.id));
      const photoUrls = selectedPhotos.map(p => p.signedUrl).filter(Boolean) as string[];
      for (const { file } of uploadedPhotos) {
        const b64 = await fileToBase64(file);
        photoUrls.push(b64);
      }
      const res = await apiRequest('POST', '/api/ai/generate-quote', {
        jobId,
        photoUrls,
        jobDescription: description.trim() || undefined,
      });
      return await res.json() as AIQuoteResult;
    },
    onSuccess: (data) => {
      if (!data.success || data.lineItems.length === 0) {
        setStep('input');
        toast({
          title: "Couldn't generate a quote",
          description: data.notes[0] || "Add more detail about the job and try again.",
          variant: "destructive",
        });
        return;
      }
      const items: EditableLineItem[] = data.lineItems.map((item, i) => ({
        ...item,
        id: `item-${i}`,
        included: true,
        editingQty: item.quantity.toString(),
        editingPrice: item.unitPrice.toFixed(2),
      }));
      setLineItems(items);
      setSuggestedTitle(data.suggestedTitle);
      setConfidence(data.confidence);
      setAiNotes(data.notes);
      setStep('review');
    },
    onError: () => {
      setStep('input');
      toast({
        title: "Error",
        description: "Failed to generate quote. Check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const updateItem = (id: string, field: 'editingQty' | 'editingPrice' | 'description' | 'included', value: string | boolean) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'editingQty' || field === 'editingPrice') {
        const qty = parseFloat(field === 'editingQty' ? value as string : updated.editingQty) || 0;
        const price = parseFloat(field === 'editingPrice' ? value as string : updated.editingPrice) || 0;
        updated.quantity = qty;
        updated.unitPrice = price;
        updated.total = qty * price;
      }
      return updated;
    }));
  };

  const includedItems = lineItems.filter(i => i.included);
  const { subtotal, gstAmount: gst, total: grandTotal } = calculateDocumentTotals(
    includedItems.map(i => ({ amount: i.total }))
  );

  const handleApply = () => {
    const toApply = includedItems.map(({ description, quantity, unitPrice, total, category }) => ({
      description, quantity, unitPrice, total, category,
    }));
    onApplyItems(toApply, suggestedTitle);
    onOpenChange(false);
  };

  const hasInput = description.trim() || selectedPhotoIds.size > 0 || uploadedPhotos.length > 0;
  const totalPhotos = selectedPhotoIds.size + uploadedPhotos.length;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Quote Generator
            {step === 'review' && (
              <Badge
                className={
                  confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-auto' :
                  confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ml-auto' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ml-auto'
                }
              >
                {confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Review prices' : 'Low confidence — edit carefully'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'input' && (
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Describe the job — speak or type. The more detail, the better the quote.
              </p>

              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  onClick={toggleRecording}
                  disabled={!speechSupported}
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isRecording
                      ? 'bg-red-500 text-white shadow-lg scale-105'
                      : speechSupported
                      ? 'bg-primary text-primary-foreground shadow-md hover-elevate active-elevate-2'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
                      <MicOff className="h-7 w-7 relative" />
                    </>
                  ) : (
                    <Mic className="h-7 w-7" />
                  )}
                </button>

                <p className="text-xs text-muted-foreground text-center">
                  {!speechSupported
                    ? 'Voice not supported in this browser — type below'
                    : isRecording
                    ? <span className="text-red-500 font-medium">Recording {formatTime(recordingSeconds)} — tap to stop</span>
                    : 'Tap to speak'}
                </p>
              </div>

              <Textarea
                placeholder="e.g., Replace hot water system, Rinnai 26L continuous flow, run new gas line 3 metres, 4 hours labour, plus two 15amp power points in garage..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none text-sm"
                data-testid="input-ai-job-description"
              />

              <div>
                <button
                  onClick={() => setPhotosExpanded(!photosExpanded)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  {photosExpanded ? 'Hide photos' : `Add photos for analysis${totalPhotos > 0 ? ` (${totalPhotos} selected)` : ''}`}
                </button>

                {photosExpanded && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {imagePhotos.map((photo) => {
                        const selected = selectedPhotoIds.has(photo.id);
                        return (
                          <div
                            key={photo.id}
                            onClick={() => {
                              const next = new Set(selectedPhotoIds);
                              selected ? next.delete(photo.id) : next.add(photo.id);
                              setSelectedPhotoIds(next);
                            }}
                            className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                              selected ? 'border-primary' : 'border-transparent opacity-60'
                            }`}
                          >
                            <img
                              src={photo.signedUrl || `/api/jobs/${jobId}/photos/${photo.id}/view`}
                              alt={photo.filename}
                              className="w-full h-full object-cover"
                            />
                            {selected && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {uploadedPhotos.map((photo, i) => (
                        <div key={`up-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-primary">
                          <img src={photo.preview} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setUploadedPhotos(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Add</span>
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 px-5 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <Loader2 className="absolute -top-1 -right-1 h-6 w-6 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-medium">Analysing your job...</p>
                <p className="text-sm text-muted-foreground mt-1">Generating Australian-priced line items</p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="px-5 py-4 space-y-3">
              {suggestedTitle && (
                <p className="text-sm font-semibold text-foreground">{suggestedTitle}</p>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {includedItems.length} of {lineItems.length} items selected
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setLineItems(prev => prev.map(i => ({ ...i, included: true })))} className="text-xs text-primary">
                    All
                  </button>
                  <span className="text-xs text-muted-foreground">·</span>
                  <button onClick={() => setLineItems(prev => prev.map(i => ({ ...i, included: false })))} className="text-xs text-muted-foreground">
                    None
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {lineItems.map((item) => {
                  const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
                  const Icon = cat.icon;
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3 space-y-2 transition-all ${
                        item.included ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => updateItem(item.id, 'included', !item.included)}
                          className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            item.included ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                          }`}
                        >
                          {item.included && <Check className="h-3 w-3 text-primary-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{item.description}</p>
                          <span className={`inline-flex items-center gap-1 mt-1 text-xs px-1.5 py-0.5 rounded-md ${cat.color}`}>
                            <Icon className="h-3 w-3" />
                            {cat.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold shrink-0 tabular-nums">
                          ${item.total.toFixed(2)}
                        </span>
                      </div>

                      {item.included && (
                        <div className="flex items-center gap-2 pl-7">
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-xs text-muted-foreground w-5 shrink-0">Qty</span>
                            <Input
                              type="number"
                              value={item.editingQty}
                              onChange={(e) => updateItem(item.id, 'editingQty', e.target.value)}
                              className="h-7 text-xs w-16 text-center"
                              min="0"
                              step="0.5"
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-xs text-muted-foreground shrink-0">$</span>
                            <Input
                              type="number"
                              value={item.editingPrice}
                              onChange={(e) => updateItem(item.id, 'editingPrice', e.target.value)}
                              className="h-7 text-xs w-24"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {aiNotes.length > 0 && (
                <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{aiNotes[0]}</span>
                </div>
              )}

              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST (10%)</span>
                  <span>${gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total (inc. GST)</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t shrink-0 flex gap-2">
          {step === 'input' && (
            <>
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => generateMutation.mutate()}
                disabled={!hasInput || generateMutation.isPending}
                data-testid="button-generate-ai-quote"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Quote
              </Button>
            </>
          )}

          {step === 'generating' && (
            <Button variant="outline" className="flex-1" onClick={() => { generateMutation.reset(); setStep('input'); }}>
              Cancel
            </Button>
          )}

          {step === 'review' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                data-testid="button-regenerate-ai-quote"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Redo
              </Button>
              <Button
                className="flex-1"
                onClick={handleApply}
                disabled={includedItems.length === 0}
                data-testid="button-apply-ai-quote"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Add {includedItems.length} item{includedItems.length !== 1 ? 's' : ''} to Quote
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
