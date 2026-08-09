import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Send, 
  MessageSquare,
  User,
  Search,
  Users
} from "lucide-react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { useSearch, useLocation } from "wouter";
import type { User as UserType, DirectMessage } from "@shared/schema";

interface DirectMessageWithUser extends DirectMessage {
  sender?: UserType;
  recipient?: UserType;
}

interface Conversation {
  otherUser: UserType;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

export default function DirectMessages() {
  const [selectedConversation, setSelectedConversation] = useState<UserType | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/direct-messages/conversations"],
  });

  const { data: teamMembers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<DirectMessageWithUser[]>({
    queryKey: ["/api/direct-messages", selectedConversation?.id],
    enabled: !!selectedConversation,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      return apiRequest("POST", `/api/direct-messages/${selectedConversation.id}`, { content: message });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages/conversations"] });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedConversation) {
      const interval = setInterval(() => {
        refetchMessages();
      }, 3000);
      return () => clearInterval(interval);
    }
    return;
  }, [selectedConversation, refetchMessages]);

  // Handle deep-link navigation with ?to=userId query param
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const targetUserId = params.get('to');
    
    if (targetUserId && !selectedConversation) {
      // First check existing conversations
      const existingConvo = conversations.find(c => c.otherUser.id === targetUserId);
      if (existingConvo) {
        setSelectedConversation(existingConvo.otherUser);
        // Clear the query param after handling
        setLocation('/messages', { replace: true });
        return;
      }
      
      // Check team members to start a new conversation
      const member = teamMembers.find((m: any) => m.userId === targetUserId || m.memberId === targetUserId);
      if (member) {
        // Create a minimal user object to start the conversation
        setSelectedConversation({
          id: targetUserId,
          email: (member as any).email || '',
          firstName: (member as any).firstName || (member as any).name?.split(' ')[0],
          lastName: (member as any).lastName || (member as any).name?.split(' ').slice(1).join(' '),
          profileImageUrl: (member as any).profileImageUrl || null,
        } as UserType);
        setLocation('/messages', { replace: true });
      }
    }
  }, [searchString, conversations, teamMembers, selectedConversation, setLocation]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (date: Date | string) => {
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, "h:mm a");
    }
    if (isYesterday(d)) {
      return `Yesterday ${format(d, "h:mm a")}`;
    }
    return format(d, "d MMM h:mm a");
  };

  const formatLastSeen = (date: Date | string | null) => {
    if (!date) return "Never";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const getInitials = (user: UserType) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "?";
  };

  const getUserDisplayName = (user: UserType) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    return user.email || "Unknown User";
  };

  const filteredTeamMembers = teamMembers.filter(member => {
    const displayName = getUserDisplayName(member).toLowerCase();
    const email = (member.email || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return displayName.includes(term) || email.includes(term);
  });

  const existingConversationIds = new Set(conversations.map(c => c.otherUser.id));
  const availableNewContacts = filteredTeamMembers.filter(m => !existingConversationIds.has(m.id));

  if (selectedConversation) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversation(null)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <UserAvatar
            className="h-10 w-10"
            user={{
              id: selectedConversation.id,
              firstName: selectedConversation.firstName,
              lastName: selectedConversation.lastName,
              email: selectedConversation.email,
              photoUrl: selectedConversation.profileImageUrl,
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate" data-testid="text-conversation-name">
              {getUserDisplayName(selectedConversation)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {selectedConversation.email}
            </p>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No messages yet</p>
                <p className="text-sm text-muted-foreground">Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.senderId !== selectedConversation.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${message.id}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {message.createdAt ? formatMessageTime(message.createdAt) : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background sticky bottom-0">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              size="icon"
              data-testid="button-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <h1 className="text-xl font-semibold mb-3" data-testid="text-page-title">Direct Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="divide-y">
            {conversations.length === 0 && availableNewContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-medium">No team members</p>
                <p className="text-sm text-muted-foreground">
                  Add team members first to start messaging
                </p>
              </div>
            ) : (
              <>
                {conversations
                  .filter(conv => {
                    if (!searchTerm) return true;
                    const displayName = getUserDisplayName(conv.otherUser).toLowerCase();
                    const email = (conv.otherUser.email || "").toLowerCase();
                    const term = searchTerm.toLowerCase();
                    return displayName.includes(term) || email.includes(term);
                  })
                  .map((conversation) => (
                    <div
                      key={conversation.otherUser.id}
                      className="flex items-center gap-3 p-4 hover-elevate cursor-pointer"
                      onClick={() => setSelectedConversation(conversation.otherUser)}
                      data-testid={`conversation-${conversation.otherUser.id}`}
                    >
                      <UserAvatar
                        className="h-12 w-12"
                        user={{
                          id: conversation.otherUser.id,
                          firstName: conversation.otherUser.firstName,
                          lastName: conversation.otherUser.lastName,
                          email: conversation.otherUser.email,
                          photoUrl: conversation.otherUser.profileImageUrl,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium truncate">
                            {getUserDisplayName(conversation.otherUser)}
                          </p>
                          {conversation.lastMessage?.createdAt && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatMessageTime(conversation.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMessage?.content || "No messages yet"}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <Badge size="sm" className="flex-shrink-0">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                {availableNewContacts.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">Start New Conversation</p>
                    </div>
                    {availableNewContacts.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-4 hover-elevate cursor-pointer"
                        onClick={() => setSelectedConversation(member)}
                        data-testid={`new-conversation-${member.id}`}
                      >
                        <UserAvatar
                          className="h-12 w-12"
                          user={{
                            id: member.id,
                            firstName: member.firstName,
                            lastName: member.lastName,
                            email: member.email,
                            photoUrl: member.profileImageUrl,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {getUserDisplayName(member)}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
