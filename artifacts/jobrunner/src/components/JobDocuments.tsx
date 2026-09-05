import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { FileText, Upload, Plus, Loader2, Trash2, Download, Eye, File, FileImage, FileSpreadsheet, FileArchive, Layers } from 'lucide-react';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
interface JobDocument {
  id: string;
  jobId: string;
  userId: string;
  phaseId?: string | null;
  phaseLabel?: string | null;
  title: string;
  documentType: 'quote' | 'invoice' | 'other';
  fileName: string;
  fileUrl: string | null;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface JobPhaseOption {
  id: string;
  phaseCode: string;
  name: string;
}
interface JobDocumentsProps {
  jobId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  phases?: JobPhaseOption[];
  /** Pre-select a phase in the upload dialog */
  defaultPhaseId?: string;
}

export function JobDocuments({ jobId, canUpload = true, canDelete = false, phases = [], defaultPhaseId }: JobDocumentsProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<'quote' | 'invoice' | 'other'>('other');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; mimeType?: string; fileName?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery<JobDocument[]>({
    queryKey: ['/api/jobs', jobId, 'documents'],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, title, documentType, phaseId }: { file: File; title: string; documentType: string; phaseId?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('documentType', documentType);
      if (phaseId) formData.append('phaseId', phaseId);

      const response = await fetch(`/api/jobs/${jobId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'documents'] });
      setShowUploadDialog(false);
      setSelectedFile(null);
      setTitle('');
      setDocumentType('other');
      setSelectedPhaseId('');
      toast({
        title: 'Document uploaded',
        description: 'Your document has been uploaded successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload document.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/jobs/${jobId}/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'documents'] });
      setDeleteDocId(null);
      toast({
        title: 'Document deleted',
        description: 'The document has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete document.',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'application/zip', 'application/x-zip-compressed',
        'application/octet-stream',
      ];
      const allowedExtensions = ['.pdf','.jpg','.jpeg','.png','.gif','.webp','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv','.zip'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
        toast({
          title: 'Invalid file type',
          description: 'Supported types: PDF, images, Word, Excel, PowerPoint, text, CSV, ZIP.',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 100MB.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !title.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide a title and select a file.',
        variant: 'destructive',
      });
      return;
    }
    uploadMutation.mutate({ file: selectedFile, title: title.trim(), documentType, phaseId: selectedPhaseId || undefined });
  };

  const openUploadDialog = () => {
    setShowUploadDialog(true);
    setSelectedFile(null);
    setTitle('');
    setDocumentType('other');
    setSelectedPhaseId(defaultPhaseId || '');
  };

  const getDocumentIcon = (mimeType: string, fileName?: string) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-5 w-5 text-blue-500" />;
    }
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileName?.match(/\.(xls|xlsx|csv)$/i)
    ) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    }
    if (
      mimeType === 'application/zip' ||
      mimeType === 'application/x-zip-compressed' ||
      fileName?.match(/\.zip$/i)
    ) {
      return <FileArchive className="h-5 w-5 text-yellow-600" />;
    }
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'quote':
        return 'secondary';
      case 'invoice':
        return 'default';
      default:
        return 'outline';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Build phase filter options from both the phases prop and documents that have phase data
  const phasesWithDocs = phases.filter(p => documents.some(d => d.phaseId === p.id));
  const hasPhaseFilter = phasesWithDocs.length > 0 || documents.some(d => d.phaseId);

  const filteredDocuments = phaseFilter === 'all'
    ? documents
    : phaseFilter === 'none'
      ? documents.filter(d => !d.phaseId)
      : documents.filter(d => d.phaseId === phaseFilter);

  return (
    <>
      <Card data-testid="card-uploaded-documents">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              Uploaded Documents
            </CardTitle>
            {canUpload && (
              <Button
                onClick={openUploadDialog}
                size="sm"
                variant="outline"
                data-testid="button-add-document"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Phase filter chips */}
          {hasPhaseFilter && documents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setPhaseFilter('all')}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  phaseFilter === 'all'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                All ({documents.length})
              </button>
              <button
                onClick={() => setPhaseFilter('none')}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  phaseFilter === 'none'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                General ({documents.filter(d => !d.phaseId).length})
              </button>
              {phases.map(p => {
                const count = documents.filter(d => d.phaseId === p.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPhaseFilter(p.id)}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      phaseFilter === p.id
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Layers className="h-3 w-3" />
                    {p.phaseCode} — {p.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="space-y-2">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`document-item-${doc.id}`}
                >
                  <div className="flex-shrink-0">
                    {getDocumentIcon(doc.mimeType, doc.fileName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{doc.title}</span>
                      <Badge variant={getTypeBadgeVariant(doc.documentType)} className="text-xs">
                        {doc.documentType}
                      </Badge>
                      {doc.phaseLabel && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary/8 text-primary">
                          <Layers className="h-2.5 w-2.5" />
                          {doc.phaseLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatFileSize(doc.fileSize)} &middot; {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {doc.fileUrl && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewDoc({ url: doc.fileUrl!, title: doc.title, mimeType: doc.mimeType, fileName: doc.fileName })}
                          title="Preview"
                          data-testid={`button-preview-document-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.fileUrl!;
                            link.download = doc.fileName;
                            link.click();
                          }}
                          title="Download"
                          data-testid={`button-download-document-${doc.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDocId(doc.id)}
                        title="Delete"
                        data-testid={`button-delete-document-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{phaseFilter !== 'all' ? 'No documents for this filter' : 'No documents uploaded'}</p>
              {phaseFilter === 'all' && (
                <p className="text-xs mt-1">Upload quotes, invoices, or other documents</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <input
                type="file"
                id="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                className="hidden"
                data-testid="input-file-upload"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                data-testid="dropzone-file-upload"
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    {getDocumentIcon(selectedFile.type)}
                    <span className="text-sm truncate">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(selectedFile.size)})
                    </span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Click to select a file</p>
                    <p className="text-xs mt-1">PDF, images, Word, Excel, PowerPoint, CSV, ZIP up to 100MB</p>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Supplier Quote - Materials"
                data-testid="input-document-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Document Type</Label>
              <Select value={documentType} onValueChange={(v: 'quote' | 'invoice' | 'other') => setDocumentType(v)}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {phases.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="phase">Phase (optional)</Label>
                <Select value={selectedPhaseId || 'none'} onValueChange={(v) => setSelectedPhaseId(v === 'none' ? '' : v)}>
                  <SelectTrigger data-testid="select-document-phase">
                    <SelectValue placeholder="No specific phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific phase</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.phaseCode} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !title.trim() || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-document"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewDoc && (
        <DocumentPreviewModal
          open={!!previewDoc}
          onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}
          title={previewDoc.title}
          url={previewDoc.url}
          mimeType={previewDoc.mimeType}
          fileName={previewDoc.fileName}
        />
      )}
    </>
  );
}
