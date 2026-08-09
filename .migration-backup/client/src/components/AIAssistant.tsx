import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Lightbulb, ExternalLink, Briefcase, FileText, Receipt, User, Check, X, Bell, ChevronRight, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";

function ThinkingIndicator() {
  return (
    <div 
      className="p-2.5 sm:p-3 rounded-lg mr-4 sm:mr-8 flex items-center gap-2"
      style={{
        backgroundColor: 'hsl(var(--trade) / 0.05)',
        border: '1px solid hsl(var(--trade) / 0.1)'
      }}
    >
      <div className="flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" style={{ color: 'hsl(var(--trade))' }} />
      </div>
      <span className="text-xs sm:text-sm text-muted-foreground">
        Thinking
        <span className="inline-flex ml-1">
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
        </span>
      </span>
    </div>
  );
}

interface RichContentItem {
  type: 'job_link' | 'quote_link' | 'invoice_link' | 'client_link' | 'action_button';
  id: string;
  label: string;
  url?: string;
  status?: string;
  amount?: number;
}

interface AIAction {
  type: string;
  data?: any;
  confirmationRequired?: boolean;
  message?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  richContent?: RichContentItem[];
  action?: AIAction;
  suggestedFollowups?: string[];
}

interface AINotification {
  id: string;
  type: 'reminder' | 'alert' | 'suggestion' | 'update';
  title: string;
  message: string;
  entityType?: 'job' | 'quote' | 'invoice' | 'client';
  entityId?: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
  dismissed?: boolean;
}

const SUGGESTED_PROMPTS = [
  "What jobs need my attention today?",
  "Show me overdue invoices",
  "Draft a follow-up for pending quotes",
  "Give me a daily summary",
  "Who should I chase for payment?",
  "What's on my schedule this week?"
];

function EntityLink({ item, onNavigate }: { item: RichContentItem; onNavigate?: (path: string) => void }) {
  const getIcon = () => {
    switch (item.type) {
      case 'job_link': return <Briefcase className="h-3.5 w-3.5" />;
      case 'quote_link': return <FileText className="h-3.5 w-3.5" />;
      case 'invoice_link': return <Receipt className="h-3.5 w-3.5" />;
      case 'client_link': return <User className="h-3.5 w-3.5" />;
      default: return <ExternalLink className="h-3.5 w-3.5" />;
    }
  };

  const getPath = () => {
    switch (item.type) {
      case 'job_link': return `/jobs/${item.id}`;
      case 'quote_link': return `/quotes/${item.id}`;
      case 'invoice_link': return `/invoices/${item.id}`;
      case 'client_link': return `/clients/${item.id}`;
      default: return item.url || '#';
    }
  };

  const getStatusColor = () => {
    if (!item.status) return 'default';
    const status = item.status.toLowerCase();
    if (status === 'overdue' || status === 'cancelled') return 'destructive';
    if (status === 'paid' || status === 'completed' || status === 'accepted' || status === 'done') return 'default';
    if (status === 'sent' || status === 'pending' || status === 'in_progress') return 'secondary';
    return 'outline';
  };

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(getPath());
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all hover-elevate active-elevate-2"
      style={{
        backgroundColor: 'hsl(var(--primary) / 0.1)',
        border: '1px solid hsl(var(--primary) / 0.2)',
        color: 'hsl(var(--primary))'
      }}
      data-testid={`ai-entity-link-${item.type}-${item.id}`}
    >
      {getIcon()}
      <span>{item.label}</span>
      {item.status && (
        <Badge variant={getStatusColor() as any} className="ml-1 text-[10px] px-1.5 py-0">
          {item.status}
        </Badge>
      )}
      {item.amount !== undefined && (
        <span className="ml-1 font-semibold">${(item.amount / 100).toFixed(2)}</span>
      )}
      <ChevronRight className="h-3 w-3 ml-0.5 opacity-60" />
    </button>
  );
}

function ActionConfirmation({ 
  action, 
  onConfirm, 
  onCancel,
  isPending 
}: { 
  action: AIAction; 
  onConfirm: () => void; 
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div 
      className="p-3 rounded-lg border-2 mt-2"
      style={{
        backgroundColor: 'hsl(var(--trade) / 0.05)',
        borderColor: 'hsl(var(--trade) / 0.3)'
      }}
    >
      <p className="text-sm font-medium mb-2" style={{ color: 'hsl(var(--trade))' }}>
        {action.message || 'Confirm this action?'}
      </p>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={onConfirm}
          disabled={isPending}
          style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
          data-testid="button-ai-confirm-action"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Yes, do it
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onCancel}
          disabled={isPending}
          data-testid="button-ai-cancel-action"
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NotificationBadge({ notifications }: { notifications: AINotification[] }) {
  const activeNotifications = notifications.filter(n => !n.dismissed);
  if (activeNotifications.length === 0) return null;

  const highPriority = activeNotifications.filter(n => n.priority === 'high').length;

  return (
    <div className="relative">
      <Bell className="h-4 w-4" />
      <span 
        className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
        style={{
          backgroundColor: highPriority > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--trade))',
          color: 'white'
        }}
      >
        {activeNotifications.length}
      </span>
    </div>
  );
}

interface AIAssistantProps {
  onNavigate?: (path: string) => void;
  embedded?: boolean;
}

export default function AIAssistant({ onNavigate, embedded = false }: AIAssistantProps) {
  const [, setLocation] = useLocation();
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [notifications, setNotifications] = useState<AINotification[]>([]);

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      setLocation(path);
    }
  };

  const { data: userData } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const { data: businessSettings } = useQuery({
    queryKey: ["/api/business-settings"],
  });

  const userName = (userData as any)?.firstName || (businessSettings as any)?.ownerName?.split(' ')[0] || '';

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["/api/ai/suggestions"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["/api/ai/notifications"],
    refetchInterval: 2 * 60 * 1000,
  });

  const suggestions = (suggestionsData as any)?.suggestions || [];

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data, message) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        richContent: data.richContent,
        action: data.action,
        suggestedFollowups: data.suggestedFollowups
      };

      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: message },
        assistantMessage
      ]);
      setChatMessage("");

      if (data.action?.confirmationRequired) {
        setPendingAction(data.action);
      }
    }
  });

  const actionMutation = useMutation({
    mutationFn: async (action: AIAction) => {
      const response = await fetch("/api/ai/execute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action })
      });
      
      if (!response.ok) throw new Error("Failed to execute action");
      return response.json();
    },
    onSuccess: (data) => {
      setPendingAction(null);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: data.response || "Done! Action completed successfully." }
      ]);
    },
    onError: () => {
      setPendingAction(null);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: "Sorry, something went wrong. Please try again or do it manually." }
      ]);
    }
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatMutation.isPending) return;
    chatMutation.mutate(chatMessage);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setChatMessage(suggestion);
  };

  const handleConfirmAction = () => {
    if (pendingAction) {
      actionMutation.mutate(pendingAction);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setChatHistory(prev => [
      ...prev,
      { role: 'assistant', content: "No worries, cancelled that. Anything else I can help with?" }
    ]);
  };

  const renderMessageContent = (msg: ChatMessage) => {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        
        {msg.richContent && msg.richContent.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {msg.richContent.map((item, idx) => (
              <EntityLink key={idx} item={item} onNavigate={handleNavigation} />
            ))}
          </div>
        )}

        {msg.action?.confirmationRequired && pendingAction && (
          <ActionConfirmation
            action={msg.action}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
            isPending={actionMutation.isPending}
          />
        )}

        {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && !pendingAction && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.suggestedFollowups.map((followup, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="cursor-pointer text-xs"
                onClick={() => setChatMessage(followup)}
                data-testid={`ai-followup-${idx}`}
              >
                {followup}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div className={`flex-1 flex flex-col gap-3 sm:gap-4 ${embedded ? 'p-4 sm:p-6' : ''}`}>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {userName ? `G'day${userName ? ` ${userName}` : ''}! ` : ''}I can help with jobs, quotes, invoices, and more. Just ask!
        </p>

        {chatHistory.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
            </div>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setChatMessage(prompt)}
                  className="w-full text-left p-2.5 sm:p-3 rounded-lg bg-muted hover-elevate active-elevate-2 text-xs sm:text-sm transition-all"
                  data-testid={`suggested-prompt-${index}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestionsLoading ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Smart Suggestions:</p>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing your business...
            </div>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Smart Suggestions:</p>
            <div className="space-y-2">
              {suggestions.map((suggestion: string, index: number) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-2.5 sm:p-3 rounded-lg hover-elevate active-elevate-2 text-xs sm:text-sm transition-all"
                  style={{
                    backgroundColor: 'hsl(var(--trade) / 0.05)',
                    border: '1px solid hsl(var(--trade) / 0.15)'
                  }}
                  data-testid={`ai-suggestion-${index}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(chatHistory.length > 0 || chatMutation.isPending) && (
          <div className="flex-1 space-y-2 sm:space-y-3 overflow-y-auto max-h-48 sm:max-h-64">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
                  msg.role === 'user'
                    ? 'bg-muted ml-4 sm:ml-8'
                    : 'mr-4 sm:mr-8'
                }`}
                style={msg.role === 'assistant' ? {
                  backgroundColor: 'hsl(var(--trade) / 0.05)',
                  border: '1px solid hsl(var(--trade) / 0.1)'
                } : {}}
              >
                <p className="text-xs font-medium mb-1 text-muted-foreground">
                  {msg.role === 'user' ? 'You' : 'JobRunner AI'}
                </p>
                {msg.role === 'assistant' ? renderMessageContent(msg) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
              </div>
            ))}
            {chatMutation.isPending && <ThinkingIndicator />}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-2 mt-auto">
          <Input
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Ask anything..."
            disabled={chatMutation.isPending}
            className="flex-1 text-sm"
            data-testid="input-ai-chat"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!chatMessage.trim() || chatMutation.isPending}
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
            data-testid="button-send-ai-message"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
    </div>
  );

  if (embedded) {
    return (
      <div data-testid="ai-assistant">
        {content}
      </div>
    );
  }

  return (
    <Card className="flex flex-col" data-testid="ai-assistant">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <div 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ 
              backgroundColor: 'hsl(var(--trade) / 0.1)',
              border: '1px solid hsl(var(--trade) / 0.2)'
            }}
          >
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: 'hsl(var(--trade))' }} />
          </div>
          <span className="truncate">AI Assistant</span>
        </CardTitle>
        {notifications.length > 0 && <NotificationBadge notifications={notifications} />}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 sm:gap-4 p-4 sm:p-6">
        {content}
      </CardContent>
    </Card>
  );
}
