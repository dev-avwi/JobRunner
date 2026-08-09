import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChatMessage } from "./ChatMessage";
import { ChatComposer } from "./ChatComposer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Loader2, User, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JobChatMessage {
  id: string;
  jobId: string;
  userId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isSystemMessage?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface JobChatParticipants {
  participants: Participant[];
  jobTitle: string;
  participantCount: number;
  client?: ClientInfo | null;
}

interface JobChatProps {
  jobId: string;
  currentUserId: string;
  className?: string;
}

export function JobChat({ jobId, currentUserId, className }: JobChatProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);

  const { data: messages = [], isLoading } = useQuery<JobChatMessage[]>({
    queryKey: ['/api/jobs', jobId, 'chat'],
  });

  // Job chat participants - who can see these messages
  const { data: participantsData } = useQuery<JobChatParticipants>({
    queryKey: ['/api/jobs', jobId, 'chat', 'participants'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/chat`, {
        message,
        messageType: 'text',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'chat'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('DELETE', `/api/jobs/${jobId}/chat/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'chat'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, message }: { file: File; message?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (message) {
        formData.append('message', message);
      }
      const response = await fetch(`/api/jobs/${jobId}/chat/upload`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'chat'] });
      toast({
        title: "Attachment sent",
        description: "Your file has been uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to upload file",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      const latestMessageId = messages[messages.length - 1]?.id;
      if (latestMessageId !== lastMessageRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        lastMessageRef.current = latestMessageId;
      }
    }
  }, [messages]);

  const handleSend = (message: string) => {
    sendMessageMutation.mutate(message);
  };

  const handleSendFile = (file: File, message?: string) => {
    uploadFileMutation.mutate({ file, message });
  };

  const handleDelete = (messageId: string) => {
    deleteMessageMutation.mutate(messageId);
  };

  return (
    <Card className={className} data-testid="job-chat-container">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">Messages</CardTitle>
      </CardHeader>
      
      {/* Client Banner - Subtle version */}
      {participantsData?.client && (
        <div className="mx-4 mb-2 px-2.5 py-1.5 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2 flex-wrap">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Client:</span>
            <span className="text-xs font-medium">
              {participantsData.client.name}
            </span>
            {participantsData.client.phone && (
              <a 
                href={`tel:${participantsData.client.phone}`}
                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                data-testid="client-phone-link"
              >
                <Phone className="h-2.5 w-2.5" />
                {participantsData.client.phone}
              </a>
            )}
            {participantsData.client.email && (
              <a 
                href={`mailto:${participantsData.client.email}`}
                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                data-testid="client-email-link"
              >
                <Mail className="h-2.5 w-2.5" />
                {participantsData.client.email}
              </a>
            )}
          </div>
        </div>
      )}
      
      <CardContent className="p-0">
        <div className="flex flex-col h-[320px]">
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageCircle className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs mt-0.5">Send a message to get things moving</p>
              </div>
            ) : (
              <div className="py-3 space-y-0.5 group">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    id={msg.id}
                    message={msg.message}
                    messageType={msg.messageType}
                    senderId={msg.userId}
                    senderName={msg.senderName}
                    senderAvatar={msg.senderAvatar}
                    isCurrentUser={msg.userId === currentUserId}
                    isSystemMessage={msg.isSystemMessage}
                    attachmentUrl={msg.attachmentUrl}
                    attachmentName={msg.attachmentName}
                    createdAt={msg.createdAt}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
          
          <ChatComposer
            onSend={handleSend}
            onSendFile={handleSendFile}
            placeholder="Message about this job..."
            isSending={sendMessageMutation.isPending || uploadFileMutation.isPending}
            supportAttachments={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}
