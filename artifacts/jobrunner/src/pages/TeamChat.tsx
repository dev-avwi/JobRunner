import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatComposer } from "@/components/ChatComposer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, Loader2, Pin, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface TeamChatMessage {
  id: string;
  businessOwnerId: string;
  senderId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
}

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

export default function TeamChatPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: messages = [], isLoading } = useQuery<TeamChatMessage[]>({
    queryKey: ['/api/team-chat'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/team-chat', {
        message,
        messageType: 'text',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const pinMessageMutation = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team-chat/${messageId}/pin`, { pinned });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
      toast({
        title: "Message updated",
        description: "Pin status has been changed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to pin message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest('DELETE', `/api/team-chat/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-chat'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (messages.length > 0 && scrollRef.current && !showPinnedOnly) {
      const latestMessageId = messages[messages.length - 1]?.id;
      if (latestMessageId !== lastMessageRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        lastMessageRef.current = latestMessageId;
      }
    }
  }, [messages, showPinnedOnly]);

  const handleSend = (message: string) => {
    sendMessageMutation.mutate(message);
  };

  const handlePin = (messageId: string, pinned: boolean) => {
    pinMessageMutation.mutate({ messageId, pinned });
  };

  const handleDelete = (messageId: string) => {
    deleteMessageMutation.mutate(messageId);
  };

  const pinnedMessages = messages.filter(m => m.isPinned);
  const displayMessages = showPinnedOnly ? pinnedMessages : messages;

  const isBusinessOwner = currentUser && messages.length > 0 
    ? messages[0]?.businessOwnerId === currentUser.id 
    : true;

  return (
    <div className="flex flex-col h-full" data-testid="team-chat-page">
      <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/dashboard')}
          className="md:hidden"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Team Chat</h1>
        </div>
        <Badge variant="secondary" className="ml-auto text-xs">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </Badge>
      </div>

      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-muted/50 border-b">
          <Button
            variant={showPinnedOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className="gap-2"
            data-testid="button-toggle-pinned"
          >
            <Pin className="w-4 h-4" />
            {pinnedMessages.length} Pinned
          </Button>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">
                {showPinnedOnly ? "No pinned messages" : "No messages yet"}
              </p>
              <p className="text-xs mt-1">
                {showPinnedOnly 
                  ? "Pin important messages to see them here" 
                  : "Start chatting with your team"}
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-1 group">
              {displayMessages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id}
                  message={msg.message}
                  messageType={msg.messageType}
                  senderId={msg.senderId}
                  senderName={msg.senderName}
                  senderAvatar={msg.senderAvatar}
                  isCurrentUser={currentUser ? msg.senderId === currentUser.id : false}
                  isAnnouncement={msg.isAnnouncement}
                  isPinned={msg.isPinned}
                  attachmentUrl={msg.attachmentUrl}
                  attachmentName={msg.attachmentName}
                  createdAt={msg.createdAt}
                  onDelete={handleDelete}
                  onPin={isBusinessOwner ? handlePin : undefined}
                  canPin={isBusinessOwner}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        <ChatComposer
          onSend={handleSend}
          placeholder="Message your team..."
          isSending={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
}
