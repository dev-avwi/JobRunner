import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, Check, X } from "lucide-react";

interface ObjectUploaderProps {
  maxFileSize?: number;
  onGetUploadParameters?: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  /**
   * When provided, the file is POSTed (multipart, field "file") directly to this
   * server endpoint instead of doing a browser->GCS signed PUT. The endpoint must
   * respond with JSON `{ objectPath }`, which is passed to onComplete. This avoids
   * GCS CORS/DNS failures for small uploads like logos.
   */
  uploadEndpoint?: string;
  onComplete?: (uploadUrl: string) => void;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management with drag and drop support.
 */
export function ObjectUploader({
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  uploadEndpoint,
  onComplete,
  buttonClassName,
  children,
  accept = "image/*",
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (file.size > maxFileSize) {
      setError(`File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const finishSuccess = (resultUrl: string) => {
    setUploadComplete(true);
    setUploadProgress(100);
    onComplete?.(resultUrl);
    setTimeout(() => {
      setShowModal(false);
      resetModal();
    }, 1500);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    // Direct server-side upload mode (no browser->GCS PUT, avoids CORS/DNS issues).
    if (uploadEndpoint) {
      try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let objectPath = '';
            try {
              objectPath = JSON.parse(xhr.responseText || '{}').objectPath || '';
            } catch {}
            if (!objectPath) {
              setError('Upload succeeded but the server returned no file path.');
              setUploading(false);
              return;
            }
            finishSuccess(objectPath);
          } else {
            const detail = (xhr.responseText || '').slice(0, 200);
            console.error('[Upload] Server upload failed', { status: xhr.status, response: detail });
            setError(`Upload failed (status ${xhr.status}). ${detail || 'Please try again.'}`);
            setUploading(false);
          }
        };

        xhr.onerror = () => {
          console.error('[Upload] Network error during server upload', { uploadEndpoint });
          setError('Upload failed: could not reach the server. Check your connection and try again.');
          setUploading(false);
        };

        const formData = new FormData();
        formData.append('file', selectedFile);
        xhr.open('POST', uploadEndpoint);
        xhr.send(formData);
      } catch (err) {
        setError('Upload failed. Please try again.');
        setUploading(false);
      }
      return;
    }

    if (!onGetUploadParameters) {
      setError('Upload is not configured.');
      setUploading(false);
      return;
    }

    try {
      // Get upload parameters
      const { method, url } = await onGetUploadParameters();

      // Upload the file
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          finishSuccess(url);
        } else {
          const detail = (xhr.responseText || '').slice(0, 200);
          console.error('[Upload] GCS PUT failed', {
            status: xhr.status,
            statusText: xhr.statusText,
            response: detail,
          });
          setError(
            `Upload failed (status ${xhr.status}${xhr.statusText ? ' ' + xhr.statusText : ''}). ${detail || 'No response body.'}`
          );
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        console.error('[Upload] Network error during GCS PUT', { url });
        setError('Upload failed: network error reaching storage. This is usually a CORS or DNS issue.');
        setUploading(false);
      };

      xhr.open(method, url);
      const body = new Blob([await selectedFile.arrayBuffer()], { type: selectedFile.type || 'application/octet-stream' });
      xhr.send(body);

    } catch (err) {
      setError('Failed to get upload URL. Please try again.');
      setUploading(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);
    setError(null);
  };

  const handleClose = () => {
    if (!uploading) {
      setShowModal(false);
      resetModal();
    }
  };

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName} data-testid="button-upload">
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {!selectedFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept={accept}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">
                    Maximum file size: {Math.round(maxFileSize / 1024 / 1024)}MB
                  </p>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium" data-testid="text-filename">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {!uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} data-testid="progress-upload" />
                    <p className="text-sm text-center text-muted-foreground">
                      {uploadComplete ? 'Upload complete!' : `Uploading... ${uploadProgress}%`}
                    </p>
                  </div>
                )}

                {uploadComplete && (
                  <div className="flex items-center justify-center text-green-600">
                    <Check className="h-5 w-5 mr-2" />
                    <span>Upload successful!</span>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 text-sm text-center" data-testid="text-error">
                    {error}
                  </div>
                )}

                {!uploading && !uploadComplete && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleUpload} 
                      className="flex-1"
                      data-testid="button-start-upload"
                    >
                      Upload File
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}