import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FileEdit, 
  Plus, 
  Loader2, 
  Trash2, 
  Send, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Clock,
  Edit,
  Eye,
  Camera,
  Image as ImageIcon,
  X,
  Package,
  Minus,
  RefreshCw,
  Wrench,
  CirclePlus
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface JobVariation {
  id: string;
  jobId: string;
  userId: string;
  number: string;
  title: string;
  description: string | null;
  reason: string | null;
  additionalAmount: string;
  gstAmount: string;
  totalAmount: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  photos: string[] | null;
  createdBy: string | null;
  createdByName: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VariationSummary {
  approvedTotal: string;
  pendingTotal: string;
  approvedCount: number;
  pendingCount: number;
  totalVariations: number;
}

type MaterialAction = 'removed' | 'replaced' | 'added' | 'modified';

interface VariationMaterial {
  id: string;
  name: string;
  quantity: string;
  action: MaterialAction;
  replacedWith?: string;
}

interface NotesWithMaterials {
  text: string;
  materials: VariationMaterial[];
}

function parseNotesWithMaterials(notes: string | null): NotesWithMaterials {
  if (!notes) return { text: '', materials: [] };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.materials)) {
      return { text: parsed.text || '', materials: parsed.materials };
    }
  } catch {}
  return { text: notes, materials: [] };
}

function serializeNotesWithMaterials(text: string, materials: VariationMaterial[]): string {
  if (materials.length === 0 && !text) return '';
  if (materials.length === 0) return text;
  return JSON.stringify({ text, materials });
}

function generateMaterialId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const ACTION_CONFIG: Record<MaterialAction, { label: string; className: string; icon: typeof Minus }> = {
  removed: { label: 'Removed', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30', icon: Minus },
  replaced: { label: 'Replaced', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', icon: RefreshCw },
  added: { label: 'Added', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30', icon: CirclePlus },
  modified: { label: 'Modified', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', icon: Wrench },
};

interface JobVariationsProps {
  jobId: string;
  canEdit?: boolean;
}

export function JobVariations({ jobId, canEdit = true }: JobVariationsProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [showViewDialog, setShowViewDialog] = useState<JobVariation | null>(null);
  
  const [editingVariation, setEditingVariation] = useState<JobVariation | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reason: '',
    additionalAmount: '',
    photos: [] as File[],
  });
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [approverName, setApproverName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [addingMaterialFor, setAddingMaterialFor] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState({ name: '', quantity: '1', action: 'added' as MaterialAction, replacedWith: '' });
  
  const { toast } = useToast();

  const { data: variations = [], isLoading } = useQuery<JobVariation[]>({
    queryKey: ['/api/jobs', jobId, 'variations'],
  });

  const { data: summary } = useQuery<VariationSummary>({
    queryKey: ['/api/jobs', jobId, 'variations', 'summary'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; reason: string; additionalAmount: string }) => {
      return apiRequest('POST', `/api/jobs/${jobId}/variations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: 'Variation created', description: 'Your variation has been saved as a draft.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create variation.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest('PATCH', `/api/variations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      setShowEditDialog(false);
      setEditingVariation(null);
      resetForm();
      toast({ title: 'Variation updated', description: 'Changes have been saved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update variation.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/variations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      setShowDeleteConfirm(null);
      toast({ title: 'Variation deleted', description: 'The variation has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete variation.', variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/variations/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      toast({ title: 'Variation sent', description: 'The variation has been sent to the client.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to send variation.', variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approvedByName }: { id: string; approvedByName: string }) => {
      return apiRequest('POST', `/api/variations/${id}/approve`, { approvedByName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      setShowApproveDialog(null);
      setApproverName('');
      toast({ title: 'Variation approved', description: 'The variation has been approved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to approve variation.', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      return apiRequest('POST', `/api/variations/${id}/reject`, { rejectionReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      setShowRejectDialog(null);
      setRejectionReason('');
      toast({ title: 'Variation rejected', description: 'The variation has been rejected.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to reject variation.', variant: 'destructive' });
    },
  });

  const addMaterialMutation = useMutation({
    mutationFn: async ({ variationId, material }: { variationId: string; material: VariationMaterial }) => {
      const variation = variations.find(v => v.id === variationId);
      if (!variation) throw new Error('Variation not found');
      const parsed = parseNotesWithMaterials(variation.notes);
      const updatedMaterials = [...parsed.materials, material];
      const newNotes = serializeNotesWithMaterials(parsed.text, updatedMaterials);
      return apiRequest('PATCH', `/api/variations/${variationId}`, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      setAddingMaterialFor(null);
      setMaterialForm({ name: '', quantity: '1', action: 'added', replacedWith: '' });
      toast({ title: 'Material added', description: 'Material linked to variation.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to add material.', variant: 'destructive' });
    },
  });

  const removeMaterialMutation = useMutation({
    mutationFn: async ({ variationId, materialId }: { variationId: string; materialId: string }) => {
      const variation = variations.find(v => v.id === variationId);
      if (!variation) throw new Error('Variation not found');
      const parsed = parseNotesWithMaterials(variation.notes);
      const updatedMaterials = parsed.materials.filter(m => m.id !== materialId);
      const newNotes = serializeNotesWithMaterials(parsed.text, updatedMaterials);
      return apiRequest('PATCH', `/api/variations/${variationId}`, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'variations'] });
      toast({ title: 'Material removed', description: 'Material unlinked from variation.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to remove material.', variant: 'destructive' });
    },
  });

  const handleAddMaterial = (variationId: string) => {
    if (!materialForm.name.trim()) {
      toast({ title: 'Error', description: 'Material name is required.', variant: 'destructive' });
      return;
    }
    const material: VariationMaterial = {
      id: generateMaterialId(),
      name: materialForm.name.trim(),
      quantity: materialForm.quantity || '1',
      action: materialForm.action,
      ...(materialForm.action === 'replaced' && materialForm.replacedWith ? { replacedWith: materialForm.replacedWith.trim() } : {}),
    };
    addMaterialMutation.mutate({ variationId, material });
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', reason: '', additionalAmount: '', photos: [] });
    photoPreviews.forEach(url => URL.revokeObjectURL(url));
    setPhotoPreviews([]);
  };

  const openEditDialog = (variation: JobVariation) => {
    setEditingVariation(variation);
    setFormData({
      title: variation.title,
      description: variation.description || '',
      reason: variation.reason || '',
      additionalAmount: variation.additionalAmount,
      photos: [],
    });
    setPhotoPreviews([]);
    setShowEditDialog(true);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadPhotosForVariation = async (variationId: string, photos: File[]) => {
    for (const photo of photos) {
      try {
        const base64 = await fileToBase64(photo);
        await apiRequest('POST', `/api/jobs/${jobId}/photos`, {
          fileName: photo.name,
          fileBase64: base64,
          mimeType: photo.type,
          category: 'general',
          caption: `Variation photo`,
        });
      } catch (err) {
        console.error('Failed to upload variation photo:', err);
      }
    }
    if (photos.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'Title is required.', variant: 'destructive' });
      return;
    }
    const { photos, ...variationData } = formData;
    createMutation.mutate(variationData, {
      onSuccess: async (response: any) => {
        if (photos.length > 0) {
          let variationId = '';
          try {
            const data = await response.json();
            variationId = data?.id || '';
          } catch {}
          await uploadPhotosForVariation(variationId, photos);
          toast({ title: 'Photos uploaded', description: `${photos.length} photo(s) uploaded for this variation.` });
        }
      },
    });
  };

  const handleUpdate = async () => {
    if (!editingVariation || !formData.title.trim()) {
      toast({ title: 'Error', description: 'Title is required.', variant: 'destructive' });
      return;
    }
    const { photos, ...variationData } = formData;
    updateMutation.mutate({ id: editingVariation.id, data: variationData }, {
      onSuccess: async () => {
        if (photos.length > 0) {
          await uploadPhotosForVariation(editingVariation.id, photos);
          toast({ title: 'Photos uploaded', description: `${photos.length} photo(s) uploaded for this variation.` });
        }
      },
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const isNegative = num < 0;
    const formatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(Math.abs(num));
    return isNegative ? `-${formatted}` : formatted;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Sent</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card data-testid="card-job-variations">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileEdit className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            Variations / Change Orders
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
              data-testid="button-add-variation"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Variation
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (summary.approvedCount > 0 || summary.pendingCount > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Approved</span>
              </div>
              <div className="text-lg font-semibold">{formatCurrency(summary.approvedTotal)}</div>
              <div className="text-xs text-muted-foreground">{summary.approvedCount} variation{summary.approvedCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Pending</span>
              </div>
              <div className="text-lg font-semibold">{formatCurrency(summary.pendingTotal)}</div>
              <div className="text-xs text-muted-foreground">{summary.pendingCount} variation{summary.pendingCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : variations.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 bg-muted/50">
              <FileEdit className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">No variations yet</p>
            <p className="text-xs text-muted-foreground/70">
              Add a variation to track scope changes and additional work
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {variations.map((variation) => (
              <div
                key={variation.id}
                className="p-3 rounded-lg border bg-card"
                data-testid={`variation-card-${variation.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{variation.number}</span>
                    {getStatusBadge(variation.status)}
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${parseFloat(variation.totalAmount) < 0 ? 'text-red-500' : ''}`}>
                      {formatCurrency(variation.totalAmount)}
                    </div>
                    <div className="text-xs text-muted-foreground">inc. GST</div>
                  </div>
                </div>
                
                <h4 className="font-medium mb-1">{variation.title}</h4>
                {variation.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{variation.description}</p>
                )}
                
                {(() => {
                  const { text: notesText, materials } = parseNotesWithMaterials(variation.notes);
                  return (
                    <>
                    {notesText && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{notesText}</p>
                    )}
                    {materials.length > 0 ? (
                    <div className="mb-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Package className="h-3 w-3" />
                        Materials
                      </div>
                      <div className="space-y-1">
                        {materials.map((mat) => {
                          const config = ACTION_CONFIG[mat.action];
                          const ActionIcon = config.icon;
                          return (
                            <div key={mat.id} className="flex items-center gap-2 group/mat">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.className} border`}>
                                <ActionIcon className="h-2.5 w-2.5 mr-0.5" />
                                {config.label}
                              </Badge>
                              <span className="text-xs">
                                {mat.name}
                                {mat.action === 'replaced' && mat.replacedWith && (
                                  <span className="text-muted-foreground"> → {mat.replacedWith}</span>
                                )}
                              </span>
                              {mat.quantity && mat.quantity !== '1' && (
                                <span className="text-xs text-muted-foreground">x{mat.quantity}</span>
                              )}
                              {canEdit && variation.status === 'draft' && (
                                <button
                                  type="button"
                                  className="invisible group-hover/mat:visible ml-auto text-muted-foreground/50 hover:text-destructive"
                                  onClick={() => removeMaterialMutation.mutate({ variationId: variation.id, materialId: mat.id })}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                    </>
                  );
                })()}

                {addingMaterialFor === variation.id && (
                  <div className="mb-3 p-2 rounded-md border bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        value={materialForm.name}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Material name"
                        className="flex-1 min-w-[120px]"
                      />
                      <Input
                        value={materialForm.quantity}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, quantity: e.target.value }))}
                        placeholder="Qty"
                        type="number"
                        min="1"
                        className="w-16"
                      />
                      <Select
                        value={materialForm.action}
                        onValueChange={(val) => setMaterialForm(prev => ({ ...prev, action: val as MaterialAction }))}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="added">Added</SelectItem>
                          <SelectItem value="removed">Removed</SelectItem>
                          <SelectItem value="replaced">Replaced</SelectItem>
                          <SelectItem value="modified">Modified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {materialForm.action === 'replaced' && (
                      <Input
                        value={materialForm.replacedWith}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, replacedWith: e.target.value }))}
                        placeholder="Replaced with..."
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAddMaterial(variation.id)}
                        disabled={addMaterialMutation.isPending || !materialForm.name.trim()}
                      >
                        {addMaterialMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3 mr-1" />
                        )}
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddingMaterialFor(null);
                          setMaterialForm({ name: '', quantity: '1', action: 'added', replacedWith: '' });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>
                    {format(new Date(variation.createdAt), 'dd MMM yyyy')}
                    {variation.createdByName && ` by ${variation.createdByName}`}
                  </span>
                  {variation.status === 'approved' && variation.approvedAt && (
                    <span className="text-green-600 dark:text-green-400">
                      Approved {format(new Date(variation.approvedAt), 'dd MMM')}
                      {variation.approvedByName && ` by ${variation.approvedByName}`}
                    </span>
                  )}
                  {variation.status === 'rejected' && variation.rejectedAt && (
                    <span className="text-red-500">
                      Rejected {format(new Date(variation.rejectedAt), 'dd MMM')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {variation.status === 'draft' && canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(variation)}
                        data-testid={`button-edit-variation-${variation.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddingMaterialFor(addingMaterialFor === variation.id ? null : variation.id);
                          setMaterialForm({ name: '', quantity: '1', action: 'added', replacedWith: '' });
                        }}
                      >
                        <Package className="h-3 w-3 mr-1" />
                        Material
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(variation.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-variation-${variation.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => sendMutation.mutate(variation.id)}
                        disabled={sendMutation.isPending}
                        data-testid={`button-send-variation-${variation.id}`}
                      >
                        {sendMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Send to Client
                      </Button>
                    </>
                  )}
                  
                  {variation.status === 'sent' && canEdit && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setShowApproveDialog(variation.id)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        data-testid={`button-approve-variation-${variation.id}`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRejectDialog(variation.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-reject-variation-${variation.id}`}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  
                  {(variation.status === 'approved' || variation.status === 'rejected') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowViewDialog(variation)}
                      data-testid={`button-view-variation-${variation.id}`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  )}
                </div>

                {variation.status === 'rejected' && variation.rejectionReason && (
                  <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      <strong>Reason:</strong> {variation.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Variation
              </DialogTitle>
              <DialogDescription>
                Create a new variation or change order for additional work.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Additional bathroom tiling"
                  data-testid="input-variation-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the additional work..."
                  rows={3}
                  data-testid="input-variation-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Change</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why is this change needed?"
                  rows={2}
                  data-testid="input-variation-reason"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Additional Amount (AUD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.additionalAmount}
                    onChange={(e) => setFormData({ ...formData, additionalAmount: e.target.value })}
                    placeholder="0.00"
                    className="pl-9"
                    data-testid="input-variation-amount"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use negative for credits</p>
              </div>
              <div className="space-y-2">
                <Label>Photos</Label>
                <div className="space-y-2">
                  {photoPreviews.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {photoPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img src={preview} alt={`Photo ${index + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                            onClick={() => {
                              const newPhotos = [...formData.photos];
                              newPhotos.splice(index, 1);
                              setFormData({ ...formData, photos: newPhotos });
                              const newPreviews = [...photoPreviews];
                              URL.revokeObjectURL(newPreviews[index]);
                              newPreviews.splice(index, 1);
                              setPhotoPreviews(newPreviews);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length > 0) {
                            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
                            const previews = files.map(f => URL.createObjectURL(f));
                            setPhotoPreviews(prev => [...prev, ...previews]);
                          }
                        };
                        input.click();
                      }}
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Camera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length > 0) {
                            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
                            const previews = files.map(f => URL.createObjectURL(f));
                            setPhotoPreviews(prev => [...prev, ...previews]);
                          }
                        };
                        input.click();
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Gallery
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Variation'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { setShowEditDialog(false); setEditingVariation(null); resetForm(); } }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Variation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Additional bathroom tiling"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the additional work..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reason">Reason for Change</Label>
                <Textarea
                  id="edit-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why is this change needed?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Additional Amount (AUD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    value={formData.additionalAmount}
                    onChange={(e) => setFormData({ ...formData, additionalAmount: e.target.value })}
                    placeholder="0.00"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Photos</Label>
                <div className="space-y-2">
                  {photoPreviews.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {photoPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img src={preview} alt={`Photo ${index + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                            onClick={() => {
                              const newPhotos = [...formData.photos];
                              newPhotos.splice(index, 1);
                              setFormData({ ...formData, photos: newPhotos });
                              const newPreviews = [...photoPreviews];
                              URL.revokeObjectURL(newPreviews[index]);
                              newPreviews.splice(index, 1);
                              setPhotoPreviews(newPreviews);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length > 0) {
                            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
                            const previews = files.map(f => URL.createObjectURL(f));
                            setPhotoPreviews(prev => [...prev, ...previews]);
                          }
                        };
                        input.click();
                      }}
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Camera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length > 0) {
                            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
                            const previews = files.map(f => URL.createObjectURL(f));
                            setPhotoPreviews(prev => [...prev, ...previews]);
                          }
                        };
                        input.click();
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Gallery
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingVariation(null); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => { if (!open) setShowDeleteConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Variation?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The variation will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showDeleteConfirm && deleteMutation.mutate(showDeleteConfirm)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!showApproveDialog} onOpenChange={(open) => { if (!open) { setShowApproveDialog(null); setApproverName(''); } }}>
          <DialogContent className="sm:max-w-[350px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Approve Variation
              </DialogTitle>
              <DialogDescription>
                Enter the name of the person approving this variation.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="approver-name">Approved By</Label>
              <Input
                id="approver-name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Client's name"
                className="mt-2"
                data-testid="input-approver-name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowApproveDialog(null); setApproverName(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => showApproveDialog && approveMutation.mutate({ id: showApproveDialog, approvedByName: approverName })}
                disabled={approveMutation.isPending || !approverName.trim()}
                className="bg-green-500 hover:bg-green-600"
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showRejectDialog} onOpenChange={(open) => { if (!open) { setShowRejectDialog(null); setRejectionReason(''); } }}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Reject Variation
              </DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting this variation.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rejection-reason">Reason</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Why is this variation being rejected?"
                rows={3}
                className="mt-2"
                data-testid="input-rejection-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowRejectDialog(null); setRejectionReason(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => showRejectDialog && rejectMutation.mutate({ id: showRejectDialog, rejectionReason })}
                disabled={rejectMutation.isPending}
                variant="destructive"
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Variation'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showViewDialog} onOpenChange={(open) => { if (!open) setShowViewDialog(null); }}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5" />
                Variation Details
              </DialogTitle>
            </DialogHeader>
            {showViewDialog && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{showViewDialog.number}</span>
                  {getStatusBadge(showViewDialog.status)}
                </div>
                
                <div>
                  <h4 className="font-semibold text-lg">{showViewDialog.title}</h4>
                  {showViewDialog.description && (
                    <p className="text-sm text-muted-foreground mt-1">{showViewDialog.description}</p>
                  )}
                </div>
                
                {showViewDialog.reason && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Reason for Change</Label>
                    <p className="text-sm">{showViewDialog.reason}</p>
                  </div>
                )}
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Additional Amount</span>
                    <span className="font-medium">{formatCurrency(showViewDialog.additionalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>GST</span>
                    <span>{formatCurrency(showViewDialog.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="font-medium">Total</span>
                    <span className="font-semibold text-lg">{formatCurrency(showViewDialog.totalAmount)}</span>
                  </div>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{format(new Date(showViewDialog.createdAt), 'dd MMM yyyy, h:mm a')}</span>
                  </div>
                  {showViewDialog.createdByName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created by</span>
                      <span>{showViewDialog.createdByName}</span>
                    </div>
                  )}
                  {showViewDialog.sentAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sent</span>
                      <span>{format(new Date(showViewDialog.sentAt), 'dd MMM yyyy, h:mm a')}</span>
                    </div>
                  )}
                  {showViewDialog.approvedAt && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Approved</span>
                      <span>{format(new Date(showViewDialog.approvedAt), 'dd MMM yyyy, h:mm a')}</span>
                    </div>
                  )}
                  {showViewDialog.approvedByName && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Approved by</span>
                      <span>{showViewDialog.approvedByName}</span>
                    </div>
                  )}
                  {showViewDialog.rejectedAt && (
                    <div className="flex justify-between text-red-500">
                      <span>Rejected</span>
                      <span>{format(new Date(showViewDialog.rejectedAt), 'dd MMM yyyy, h:mm a')}</span>
                    </div>
                  )}
                </div>
                
                {showViewDialog.rejectionReason && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <Label className="text-xs text-red-600 dark:text-red-400">Rejection Reason</Label>
                    <p className="text-sm text-red-600 dark:text-red-400">{showViewDialog.rejectionReason}</p>
                  </div>
                )}

                {(() => {
                  const { text: notesText, materials } = parseNotesWithMaterials(showViewDialog.notes);
                  return (
                    <>
                    {notesText && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Notes</Label>
                        <p className="text-sm">{notesText}</p>
                      </div>
                    )}
                    {materials.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Package className="h-4 w-4" />
                        Materials
                      </div>
                      <div className="space-y-1.5">
                        {materials.map((mat) => {
                          const config = ACTION_CONFIG[mat.action];
                          const ActionIcon = config.icon;
                          return (
                            <div key={mat.id} className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.className} border`}>
                                <ActionIcon className="h-2.5 w-2.5 mr-0.5" />
                                {config.label}
                              </Badge>
                              <span className="text-sm">
                                {mat.name}
                                {mat.action === 'replaced' && mat.replacedWith && (
                                  <span className="text-muted-foreground"> → {mat.replacedWith}</span>
                                )}
                              </span>
                              {mat.quantity && mat.quantity !== '1' && (
                                <span className="text-sm text-muted-foreground">x{mat.quantity}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                    </>
                  );
                })()}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
