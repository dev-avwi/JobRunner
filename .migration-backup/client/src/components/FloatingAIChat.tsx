import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, X, Lightbulb, Check, Mail, Navigation, ArrowRight, Briefcase, FileText, Receipt, User, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function useBodyScrollLock(isLocked: boolean) {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (isLocked) {
      scrollYRef.current = window.scrollY;
      
      const scrollY = scrollYRef.current;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      const scrollY = scrollYRef.current;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      
      window.scrollTo(0, scrollY);
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isLocked]);
}

function useBottomSheetHeight() {
  const [sheetHeight, setSheetHeight] = useState(420);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const updateHeight = useCallback(() => {
    const vv = window.visualViewport;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const fullHeight = window.innerHeight;
    
    const keyboardOpen = fullHeight - viewportHeight > 150;
    setIsKeyboardOpen(keyboardOpen);
    
    if (keyboardOpen) {
      const availableHeight = viewportHeight - 80;
      setSheetHeight(Math.max(300, Math.min(availableHeight, 400)));
    } else {
      const targetHeight = Math.min(viewportHeight * 0.75, 520);
      setSheetHeight(Math.max(380, targetHeight));
    }
  }, []);

  useEffect(() => {
    updateHeight();
    
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateHeight);
      vv.addEventListener('scroll', updateHeight);
      return () => {
        vv.removeEventListener('resize', updateHeight);
        vv.removeEventListener('scroll', updateHeight);
      };
    } else {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [updateHeight]);

  return { sheetHeight, isKeyboardOpen };
}

interface AIAction {
  type: 'send_email' | 'send_sms' | 'send_invoice' | 'send_quote' | 'navigate' | 'draft_message' | 'plan_route' | 'view_job' | 'view_quote' | 'view_invoice' | 'view_client' | 'none';
  data?: any;
  confirmationRequired?: boolean;
  message?: string;
}

interface RichContentItem {
  type: 'job_link' | 'quote_link' | 'invoice_link' | 'client_link' | 'action_button';
  id: string;
  label: string;
  url?: string;
  action?: AIAction;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: AIAction;
  suggestedFollowups?: string[];
  richContent?: RichContentItem[];
}

interface FloatingAIChatProps {
  onNavigate?: (path: string) => void;
}

export default function FloatingAIChat({ onNavigate }: FloatingAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sheetHeight, isKeyboardOpen } = useBottomSheetHeight();
  const [location] = useLocation();
  
  // Hide FAB when on chat page to avoid overlapping with chat composer
  const isChatPage = location.startsWith('/chat');

  useEffect(() => {
    const handleOpenAIChat = () => setIsOpen(true);
    window.addEventListener('openAIChat', handleOpenAIChat);
    return () => window.removeEventListener('openAIChat', handleOpenAIChat);
  }, []);

  const { data: suggestionsData } = useQuery({
    queryKey: ["/api/ai/suggestions"],
    refetchInterval: 5 * 60 * 1000,
    enabled: isOpen,
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
        action: data.action,
        suggestedFollowups: data.suggestedFollowups,
        richContent: data.richContent
      };

      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: message },
        assistantMessage
      ]);
      setChatMessage("");

      if (data.action) {
        // Auto-navigate for route planning
        if (data.action.type === 'plan_route' && !data.action.confirmationRequired) {
          setTimeout(() => {
            if (onNavigate) {
              // Pass route data via URL params
              const routeData = encodeURIComponent(JSON.stringify(data.action.data.jobs || []));
              onNavigate(`/map?route=${routeData}`);
              setIsOpen(false);
            }
          }, 2000);
        } else if (data.action.type === 'navigate' && !data.action.confirmationRequired) {
          setTimeout(() => {
            if (onNavigate && data.action?.data?.path) {
              onNavigate(data.action.data.path);
              setIsOpen(false);
            }
          }, 1500);
        } else if (data.action.confirmationRequired) {
          setPendingAction(data.action);
        }
      }
    }
  });

  const executeActionMutation = useMutation({
    mutationFn: async (action: AIAction) => {
      const response = await apiRequest("POST", "/api/ai/execute-action", { action });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Done!",
          description: data.message,
        });
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', content: data.message }
        ]);
      } else {
        toast({
          title: "Couldn't complete that",
          description: data.message,
          variant: "destructive"
        });
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', content: data.message }
        ]);
      }
      setPendingAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/ai/suggestions"] });
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Give it another go in a sec",
        variant: "destructive"
      });
      setPendingAction(null);
    }
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatMutation.isPending) return;
    chatMutation.mutate(chatMessage);
  };

  const handleConfirmAction = () => {
    if (pendingAction) {
      executeActionMutation.mutate(pendingAction);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setChatHistory(prev => [
      ...prev,
      { role: 'assistant', content: "No worries, cancelled that." }
    ]);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setChatMessage(suggestion);
    inputRef.current?.focus();
  };

  const handleFollowupClick = (followup: string) => {
    setChatMessage(followup);
    setTimeout(() => {
      chatMutation.mutate(followup);
    }, 100);
  };

  const handleRichContentClick = (item: RichContentItem) => {
    if (item.type === 'action_button' && item.action) {
      if (item.action.confirmationRequired) {
        setPendingAction(item.action);
      } else {
        executeActionMutation.mutate(item.action);
      }
    } else if (item.url && onNavigate) {
      onNavigate(item.url);
      setIsOpen(false);
    }
  };

  const getRichContentIcon = (type: RichContentItem['type']) => {
    switch (type) {
      case 'job_link': return Briefcase;
      case 'quote_link': return FileText;
      case 'invoice_link': return Receipt;
      case 'client_link': return User;
      case 'action_button': return ArrowRight;
      default: return ArrowRight;
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  useBodyScrollLock(isOpen && isMobile);

  // Don't render anything when on chat page to avoid overlapping with chat composer
  if (isChatPage && !isOpen) {
    return null;
  }

  return (
    <>
      {!isOpen && !isChatPage && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 md:bottom-6 right-4 z-[60] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-shadow duration-300"
          style={{ 
            backgroundColor: 'hsl(var(--trade))',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation'
          }}
          data-testid="button-floating-ai"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
            style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
            onClick={() => setIsOpen(false)}
            onTouchMove={(e) => e.preventDefault()}
          />

          <div 
            className="fixed z-[70] bg-card border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out
                       md:bottom-24 md:right-4 md:left-auto md:w-96 md:rounded-2xl md:max-h-[500px]
                       left-0 right-0 bottom-0 rounded-t-3xl"
            style={{ 
              height: window.innerWidth >= 768 ? 'auto' : `${sheetHeight}px`,
              maxHeight: window.innerWidth >= 768 ? '500px' : `${sheetHeight}px`,
              paddingBottom: window.innerWidth >= 768 ? 0 : 'env(safe-area-inset-bottom, 0px)',
              overscrollBehavior: 'contain'
            }}
            data-testid="ai-chat-panel"
          >
            <div 
              className="flex items-center gap-3 p-4 border-b shrink-0 relative"
              style={{ backgroundColor: 'hsl(var(--trade) / 0.05)' }}
            >
              <div 
                className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center md:hidden"
                style={{ touchAction: 'none' }}
                onTouchMove={(e) => e.preventDefault()}
              >
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
              
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '1px solid hsl(var(--trade) / 0.25)'
                }}
              >
                <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">JobRunner AI</h3>
                <p className="text-xs text-muted-foreground">Your smart business mate</p>
              </div>
              {chatHistory.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs text-muted-foreground shrink-0"
                  onClick={() => setChatHistory([])}
                >
                  Clear
                </Button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                data-testid="button-close-ai-chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
            >
              {chatHistory.length === 0 ? (
                <>
                  {!isKeyboardOpen && (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground">
                        G'day! I can help with emails, invoices, jobs, and more.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Quick actions:</p>
                    </div>
                    <div className="space-y-1.5">
                      {suggestions.length > 0 ? (
                        suggestions.slice(0, isKeyboardOpen ? 2 : 4).map((suggestion: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full text-left p-3 rounded-xl text-sm transition-all border"
                            style={{
                              backgroundColor: 'hsl(var(--trade) / 0.03)',
                              borderColor: 'hsl(var(--trade) / 0.1)'
                            }}
                            data-testid={`ai-suggestion-${index}`}
                          >
                            {suggestion}
                          </button>
                        ))
                      ) : (
                        <>
                          <button
                            onClick={() => handleSuggestionClick("What needs my attention today?")}
                            className="w-full text-left p-3 rounded-xl bg-muted text-sm transition-all"
                          >
                            What needs my attention today?
                          </button>
                          {!isKeyboardOpen && (
                            <>
                              <button
                                onClick={() => handleSuggestionClick("Help me chase up overdue payments")}
                                className="w-full text-left p-3 rounded-xl bg-muted text-sm transition-all"
                              >
                                Help me chase up overdue payments
                              </button>
                              <button
                                onClick={() => handleSuggestionClick("Draft a follow-up email for a quote")}
                                className="w-full text-left p-3 rounded-xl bg-muted text-sm transition-all"
                              >
                                Draft a follow-up email for a quote
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {chatHistory.map((msg, index) => (
                    <div key={index}>
                      <div
                        className={`p-3 rounded-xl text-sm ${
                          msg.role === 'user'
                            ? 'bg-muted ml-8'
                            : 'mr-4'
                        }`}
                        style={msg.role === 'assistant' ? {
                          backgroundColor: 'hsl(var(--trade) / 0.05)',
                          border: '1px solid hsl(var(--trade) / 0.1)'
                        } : {}}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        
                        {/* Rich Content - Clickable Links and Action Buttons */}
                        {msg.role === 'assistant' && msg.richContent && msg.richContent.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.richContent.filter(item => item.type !== 'action_button').length > 0 && (
                              <div className="space-y-1.5">
                                {msg.richContent.filter(item => item.type !== 'action_button').map((item) => {
                                  const Icon = getRichContentIcon(item.type);
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => handleRichContentClick(item)}
                                      className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors"
                                      style={{
                                        backgroundColor: 'hsl(var(--trade) / 0.08)',
                                        border: '1px solid hsl(var(--trade) / 0.15)'
                                      }}
                                    >
                                      <Icon className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                                      <span className="flex-1 truncate font-medium">{item.label}</span>
                                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            
                            {/* Action Buttons */}
                            {msg.richContent.filter(item => item.type === 'action_button').length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {msg.richContent.filter(item => item.type === 'action_button').map((item) => (
                                  <Button
                                    key={item.id}
                                    size="sm"
                                    onClick={() => handleRichContentClick(item)}
                                    className="text-white"
                                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                                  >
                                    {item.type === 'action_button' && item.label.includes('Map') && (
                                      <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    {item.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {msg.role === 'assistant' && msg.action && msg.action.confirmationRequired && pendingAction && (
                        <div className="mt-2 mr-4 flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleConfirmAction}
                            disabled={executeActionMutation.isPending}
                            className="flex-1 text-white"
                            style={{ backgroundColor: 'hsl(var(--trade))' }}
                          >
                            {executeActionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                {msg.action.type === 'send_email' ? 'Send it' : 'Do it'}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelAction}
                            disabled={executeActionMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && index === chatHistory.length - 1 && !pendingAction && (
                        <div className="mt-2 mr-4 flex flex-wrap gap-1.5">
                          {msg.suggestedFollowups.slice(0, isKeyboardOpen ? 2 : 3).map((followup, i) => (
                            <button
                              key={i}
                              onClick={() => handleFollowupClick(followup)}
                              className="px-3 py-1.5 text-xs rounded-full border transition-colors"
                              style={{
                                borderColor: 'hsl(var(--trade) / 0.3)',
                                color: 'hsl(var(--trade))'
                              }}
                            >
                              {followup}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {chatMutation.isPending && (
                    <div 
                      className="p-3 rounded-xl mr-4 flex items-center gap-2"
                      style={{
                        backgroundColor: 'hsl(var(--trade) / 0.05)',
                        border: '1px solid hsl(var(--trade) / 0.1)'
                      }}
                    >
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form 
              onSubmit={handleSendMessage} 
              className="flex gap-2 p-3 border-t bg-background shrink-0"
            >
              <Input
                ref={inputRef}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask me anything..."
                disabled={chatMutation.isPending || executeActionMutation.isPending}
                className="flex-1 text-sm h-10 rounded-xl border-muted"
                data-testid="input-ai-chat"
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-xl text-white shrink-0"
                disabled={!chatMessage.trim() || chatMutation.isPending || executeActionMutation.isPending}
                style={{ backgroundColor: 'hsl(var(--trade))' }}
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
        </>
      )}
    </>
  );
}
