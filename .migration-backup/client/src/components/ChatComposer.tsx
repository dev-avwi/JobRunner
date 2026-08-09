import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Paperclip, X, Image, Video, FileText } from "lucide-react";

interface ChatComposerProps {
  onSend: (message: string) => void;
  onSendFile?: (file: File, message?: string) => void;
  placeholder?: string;
  isSending?: boolean;
  disabled?: boolean;
  supportAttachments?: boolean;
}

export function ChatComposer({
  onSend,
  onSendFile,
  placeholder = "Type a message...",
  isSending = false,
  disabled = false,
  supportAttachments = false,
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  useEffect(() => {
    // Create preview URL for selected file
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const handleSubmit = () => {
    if (isSending || disabled) return;

    if (selectedFile && onSendFile) {
      onSendFile(selectedFile, message.trim() || undefined);
      setMessage("");
      setSelectedFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } else {
      const trimmedMessage = message.trim();
      if (trimmedMessage) {
        onSend(trimmedMessage);
        setMessage("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit file size to 100MB
      if (file.size > 100 * 1024 * 1024) {
        alert("File size must be less than 100MB");
        return;
      }
      setSelectedFile(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const getFileIcon = () => {
    if (!selectedFile) return <FileText className="w-4 h-4" />;
    if (selectedFile.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (selectedFile.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const canSend = selectedFile || message.trim();

  return (
    <div className="p-3 border-t bg-background">
      {/* File Preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
          {previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-12 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-muted-foreground/10 rounded flex items-center justify-center">
              {getFileIcon()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRemoveFile}
            className="h-8 w-8 shrink-0"
            data-testid="button-remove-attachment"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {supportAttachments && onSendFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-attachment"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending}
              className="h-11 w-11 rounded-full shrink-0"
              data-testid="button-attach-file"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          </>
        )}
        
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "Add a caption (optional)..." : placeholder}
          disabled={disabled || isSending}
          className="min-h-[44px] max-h-[120px] resize-none border-0 bg-muted focus-visible:ring-0 focus-visible:ring-offset-0 rounded-full px-4 py-3"
          rows={1}
          data-testid="input-chat-message"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!canSend || isSending || disabled}
          className="h-11 w-11 rounded-full shrink-0"
          data-testid="button-send-message"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
