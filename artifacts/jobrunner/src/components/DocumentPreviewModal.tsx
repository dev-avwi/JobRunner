import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, AlertTriangle, FileText } from 'lucide-react';

export interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Document title shown in the header */
  title: string;
  /** Signed URL to the file */
  url: string;
  /** MIME type of the file — determines which renderer to use */
  mimeType?: string | null;
  /** Original file name used for the download fallback */
  fileName?: string;
}

type DocKind = 'pdf' | 'image' | 'office' | 'other';

function getDocumentKind(mimeType?: string | null): DocKind {
  if (!mimeType) return 'other';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) return 'office';
  return 'other';
}

function officeLabel(mimeType?: string | null): string {
  if (!mimeType) return 'Office file';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'Word document';
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return 'Excel spreadsheet';
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) return 'PowerPoint presentation';
  return 'Office file';
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  title,
  url,
  mimeType,
  fileName,
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const kind = getDocumentKind(mimeType);

  // Reset viewer state each time the modal is opened
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(false);
    }
  }, [open, url]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName ?? title;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const renderViewer = () => {
    // Error state (only relevant for PDF/image where load can fail)
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-16">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-medium text-foreground">Could not load the document</p>
          <p className="text-xs text-center max-w-xs">
            The file may be unavailable or in an unsupported format.
          </p>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download instead
          </Button>
        </div>
      );
    }

    if (kind === 'pdf') {
      // The browser fetches directly from the signed object-storage URL.
      // No third-party service sees the URL or the document content.
      return (
        <>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            src={url}
            title={title}
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        </>
      );
    }

    if (kind === 'image') {
      return (
        <div className="flex items-center justify-center h-full overflow-auto p-4 bg-checkerboard">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <img
            src={url}
            alt={title}
            className="max-w-full max-h-full object-contain"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        </div>
      );
    }

    if (kind === 'office') {
      // Office files cannot be rendered in-browser without routing them through an external
      // service that would receive the signed URL. Instead, offer an immediate download.
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-16">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            In-browser preview is not available for {officeLabel(mimeType)}s
          </p>
          <p className="text-xs text-center max-w-xs text-muted-foreground">
            Download the file to open it in your desktop app.
          </p>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download file
          </Button>
        </div>
      );
    }

    // Unsupported format
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-16">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Preview not available for this file type</p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download file
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0 gap-2">
          <DialogTitle className="text-sm font-semibold truncate flex-1 min-w-0">{title}</DialogTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {renderViewer()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
