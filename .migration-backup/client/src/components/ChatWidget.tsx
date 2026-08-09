import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  Send, 
  Minimize2,
  Maximize2,
  MessageCircle,
  Check,
  CheckCheck,
  ArrowRight,
  Briefcase,
  Loader2,
  Users,
  Eye,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface JobChatMessage {
  id: string;
  jobId: string;
  userId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isSystemMessage?: boolean;
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

interface JobChatParticipants {
  participants: Participant[];
  jobTitle: string;
  participantCount: number;
}

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: User | null;
  jobId?: string;
  jobTitle?: string;
  mode?: 'direct' | 'job';
}

export function ChatWidget({ isOpen, onClose, targetUser, jobId, jobTitle, mode = 'direct' }: ChatWidgetProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newMessage, setNewMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    enabled: isOpen,
  });

  // Direct messages query
  const { data: directMessages = [], refetch: refetchDirect, isLoading: loadingDirect } = useQuery<DirectMessage[]>({
    queryKey: ['/api/direct-messages', targetUser?.id],
    enabled: isOpen && mode === 'direct' && !!targetUser && !isMinimized,
  });

  // Job chat messages query
  const { data: jobMessages = [], refetch: refetchJob, isLoading: loadingJob } = useQuery<JobChatMessage[]>({
    queryKey: ['/api/jobs', jobId, 'chat'],
    enabled: isOpen && mode === 'job' && !!jobId && !isMinimized,
  });

  // Job chat participants - who can see these messages
  const { data: participantsData } = useQuery<JobChatParticipants>({
    queryKey: ['/api/jobs', jobId, 'chat', 'participants'],
    enabled: isOpen && mode === 'job' && !!jobId,
  });

  // Direct message mutation
  const sendDirectMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!targetUser) throw new Error("No user selected");
      return apiRequest('POST', `/api/direct-messages/${targetUser.id}`, { content: message });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages', targetUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/direct-messages/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
  });

  // Job chat mutation
  const sendJobMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!jobId) throw new Error("No job selected");
      const response = await apiRequest('POST', `/api/jobs/${jobId}/chat`, { 
        message, 
        messageType: 'text' 
      });
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'chat'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/unread-counts'] });
    },
  });

  const isLoading = mode === 'direct' ? loadingDirect : loadingJob;
  const isSending = mode === 'direct' ? sendDirectMutation.isPending : sendJobMutation.isPending;

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [directMessages, jobMessages, isOpen, isMinimized]);

  // Polling effect with proper cleanup
  useEffect(() => {
    const shouldPoll = isOpen && !isMinimized && (
      (mode === 'direct' && !!targetUser) || 
      (mode === 'job' && !!jobId)
    );
    
    if (!shouldPoll) return;
    
    const refetch = mode === 'direct' ? refetchDirect : refetchJob;
    const interval = setInterval(() => refetch(), 30000);
    return () => clearInterval(interval);
  }, [isOpen, mode, targetUser, jobId, isMinimized, refetchDirect, refetchJob]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'd MMM');
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown';
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    if (mode === 'direct') {
      sendDirectMutation.mutate(newMessage.trim());
    } else {
      sendJobMutation.mutate(newMessage.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenFullChat = () => {
    if (mode === 'direct' && targetUser) {
      setLocation(`/chat?to=${targetUser.id}&type=direct`);
    } else if (mode === 'job' && jobId) {
      setLocation(`/jobs/${jobId}?tab=chat`);
    } else {
      setLocation('/chat');
    }
    onClose();
  };

  const canChat = mode === 'direct' ? !!targetUser : !!jobId;

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-[60] transition-all duration-300 ease-in-out",
        "bottom-20 right-4 md:bottom-4 md:right-4",
        "w-[calc(100%-2rem)] max-w-sm",
        isMinimized ? "h-14" : "h-[60vh] max-h-[500px]"
      )}
      data-testid="chat-widget"
    >
      <div className="h-full bg-background border rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-3 border-b bg-muted/30 flex items-center gap-3">
          {mode === 'direct' && targetUser ? (
            <UserAvatar
              className="h-8 w-8 shrink-0"
              fallbackClassName="text-xs"
              user={{ id: targetUser.id, firstName: targetUser.firstName, lastName: targetUser.lastName, email: targetUser.email, photoUrl: targetUser.profileImageUrl }}
            />
          ) : mode === 'job' ? (
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <Briefcase className="h-4 w-4 text-amber-600" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {mode === 'direct' && targetUser 
                ? getUserDisplayName(targetUser) 
                : jobTitle || 'Quick Chat'}
            </p>
            {mode === 'direct' && targetUser?.email ? (
              <p className="text-xs text-muted-foreground truncate">Private message</p>
            ) : mode === 'job' && participantsData ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>Visible to {participantsData.participantCount} {participantsData.participantCount === 1 ? 'person' : 'people'}</span>
              </p>
            ) : mode === 'job' ? (
              <p className="text-xs text-muted-foreground">Job Chat</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(!isMinimized)}
              data-testid="button-minimize"
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              data-testid="button-close-widget"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Participants Banner - Who can see these messages */}
            {mode === 'job' && participantsData && participantsData.participants.length > 0 && (
              <div className="shrink-0 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-blue-800 dark:text-blue-300 font-medium">Who can see:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {participantsData.participants.map((p, i) => (
                      <span key={p.id} className="inline-flex items-center">
                        <span className="text-blue-700 dark:text-blue-400">
                          {p.name.split(' ')[0]}
                        </span>
                        <span className="text-blue-500 dark:text-blue-500 ml-0.5">
                          ({p.role})
                        </span>
                        {i < participantsData.participants.length - 1 && (
                          <span className="text-blue-400 dark:text-blue-600 mx-1">•</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !canChat ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-4">
                  <MessageCircle className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select a conversation to start chatting</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleOpenFullChat}
                    className="mt-2"
                  >
                    Open Messages <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ) : mode === 'direct' ? (
                // Direct Messages View
                directMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-4">
                    <p className="text-sm text-muted-foreground mb-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send a message to start the conversation</p>
                  </div>
                ) : (
                  <>
                    {directMessages.map((msg) => {
                      const isOwn = msg.senderId === currentUser?.id;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={cn(
                              "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                              <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                                {formatTime(msg.createdAt)}
                              </span>
                              {isOwn && (
                                msg.isRead 
                                  ? <CheckCheck className={`h-2.5 w-2.5 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
                                  : <Check className={`h-2.5 w-2.5 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )
              ) : (
                // Job Chat View
                jobMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-4">
                    <p className="text-sm text-muted-foreground mb-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send a message about this job</p>
                  </div>
                ) : (
                  <>
                    {jobMessages.map((msg) => {
                      const isOwn = msg.userId === currentUser?.id;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {!isOwn && (
                            <UserAvatar
                              className="h-6 w-6 mr-2 shrink-0"
                              fallbackClassName="text-[10px]"
                              user={{ id: msg.userId || msg.senderName, name: msg.senderName, photoUrl: msg.senderAvatar }}
                            />
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                              isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}
                          >
                            {!isOwn && (
                              <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                            <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'}`}>
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )
              )}
            </div>

            {/* Input */}
            {canChat && (
              <div className="shrink-0 p-3 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    placeholder={mode === 'direct' ? "Type a message..." : "Message about this job..."}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 h-9 text-sm"
                    data-testid="input-widget-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    size="icon"
                    className="h-9 w-9"
                    data-testid="button-widget-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenFullChat}
                  className="w-full mt-2 text-xs h-7"
                >
                  Open Full Chat <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ChatWidgetTriggerProps {
  onClick: () => void;
  unreadCount?: number;
}

export function ChatWidgetTrigger({ onClick, unreadCount = 0 }: ChatWidgetTriggerProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-24 right-4 md:bottom-4 md:right-4 z-[59] h-14 w-14 rounded-full shadow-lg"
      data-testid="button-chat-trigger"
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <Badge 
          className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 bg-destructive text-destructive-foreground"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
