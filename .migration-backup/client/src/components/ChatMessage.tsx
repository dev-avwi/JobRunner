import { formatDistanceToNow, format } from "date-fns";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pin, Trash2, AlertCircle, FileText, Info } from "lucide-react";

interface ChatMessageProps {
  id: string;
  message: string;
  messageType?: string;
  senderId?: string | null;
  senderName: string;
  senderAvatar?: string | null;
  isCurrentUser: boolean;
  isSystemMessage?: boolean;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt: string | Date;
  onDelete?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  canPin?: boolean;
}

export function ChatMessage({
  id,
  message,
  messageType = 'text',
  senderId,
  senderName,
  senderAvatar,
  isCurrentUser,
  isSystemMessage,
  isAnnouncement,
  isPinned,
  attachmentUrl,
  attachmentName,
  createdAt,
  onDelete,
  onPin,
  canPin,
}: ChatMessageProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const timeOnly = format(new Date(createdAt), 'h:mm a');

  if (isSystemMessage) {
    return (
      <div className="flex justify-center py-2" data-testid={`chat-message-system-${id}`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full text-sm text-muted-foreground">
          <Info className="w-4 h-4" />
          <span>{message}</span>
          <span className="text-xs opacity-70">{timeAgo}</span>
        </div>
      </div>
    );
  }

  if (isAnnouncement) {
    return (
      <div className="py-2" data-testid={`chat-message-announcement-${id}`}>
        <div className="bg-primary/10 border-l-4 border-primary rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{senderName}</span>
                <Badge variant="secondary" className="text-xs">Announcement</Badge>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
              <p className="text-sm">{message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 py-0.5 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
      data-testid={`chat-message-${id}`}
    >
      {!isCurrentUser && (
        <UserAvatar
          className="w-7 h-7 shrink-0"
          fallbackClassName="text-[10px]"
          user={{ id: senderId || senderName, name: senderName, photoUrl: senderAvatar }}
        />
      )}
      
      <div className={`flex flex-col max-w-[80%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        {!isCurrentUser && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">{senderName}</span>
            <span className="text-[10px] text-muted-foreground/70">{timeAgo}</span>
            {isPinned && <Pin className="w-2.5 h-2.5 text-primary" />}
          </div>
        )}
        
        <div
          className={`rounded-2xl px-3 py-1.5 ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted/60 rounded-bl-sm'
          }`}
        >
          {messageType === 'image' && attachmentUrl && (
            <div className="mb-1.5">
              <img
                src={attachmentUrl}
                alt={attachmentName || 'Attached image'}
                className="max-w-full rounded-lg max-h-48 object-cover"
              />
            </div>
          )}
          
          {messageType === 'file' && attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mb-1.5 p-2 bg-background/20 rounded-lg hover:bg-background/30"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm underline">{attachmentName || 'Download file'}</span>
            </a>
          )}
          
          <div className="flex items-end gap-2">
            <p className="text-sm whitespace-pre-wrap break-words">{message}</p>
            {isCurrentUser && (
              <span className="text-[10px] opacity-70 whitespace-nowrap shrink-0">{timeOnly}</span>
            )}
          </div>
        </div>
        
        {(isCurrentUser || canPin) && (
          <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPin && onPin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onPin(id, !isPinned)}
                data-testid={`button-pin-${id}`}
              >
                <Pin className={`w-2.5 h-2.5 ${isPinned ? 'text-primary' : ''}`} />
              </Button>
            )}
            {isCurrentUser && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => onDelete(id)}
                data-testid={`button-delete-${id}`}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
