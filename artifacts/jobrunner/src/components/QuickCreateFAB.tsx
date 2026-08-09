import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/can";
import { 
  Star,
  X,
  Briefcase, 
  FileText, 
  DollarSign, 
  Users,
  Sparkles,
  CreditCard
} from "lucide-react";

interface QuickCreateFABProps {
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onCreateClient?: () => void;
  onOpenAIAssistant?: () => void;
  onCollectPayment?: () => void;
}

export default function QuickCreateFAB({
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onCreateClient,
  onOpenAIAssistant,
  onCollectPayment,
}: QuickCreateFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const { can } = useCan();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside as any);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as any);
    };
  }, [isOpen]);

  const quickActions = [
    {
      label: "New Job",
      icon: Briefcase,
      onClick: onCreateJob,
      color: 'hsl(var(--trade))',
      bgColor: 'hsl(var(--trade) / 0.12)',
      allowed: can("job.create"),
    },
    {
      label: "New Quote",
      icon: FileText,
      onClick: onCreateQuote,
      color: 'hsl(217, 91%, 60%)',
      bgColor: 'hsl(217, 91%, 60% / 0.12)',
      allowed: can("quote.create"),
    },
    {
      label: "New Invoice",
      icon: DollarSign,
      onClick: onCreateInvoice,
      color: 'hsl(142, 76%, 36%)',
      bgColor: 'hsl(142, 76%, 36% / 0.12)',
      allowed: can("invoice.create"),
    },
    {
      label: "New Client",
      icon: Users,
      onClick: onCreateClient,
      color: 'hsl(262, 83%, 58%)',
      bgColor: 'hsl(262, 83%, 58% / 0.12)',
      allowed: can("client.create"),
    },
  ].filter(a => a.onClick && a.allowed);

  const secondaryActions = [
    {
      label: "AI Assistant",
      icon: Sparkles,
      onClick: onOpenAIAssistant,
      variant: "outline" as const,
      color: 'hsl(var(--trade))',
      allowed: true,
    },
    {
      label: "Collect Payment",
      icon: CreditCard,
      onClick: onCollectPayment,
      variant: "outline" as const,
      color: 'hsl(142, 76%, 36%)',
      allowed: can("payment.collect"),
    },
  ].filter(a => a.onClick && a.allowed);

  if (quickActions.length === 0 && secondaryActions.length === 0) {
    return null;
  }

  const handleAction = (action: (() => void) | undefined) => {
    if (action) {
      action();
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop overlay - visible on mobile/tablet only */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[58] xl:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Closed FAB button - visible on mobile and tablet only (< 1280px), hidden on desktop */}
      {!isOpen && (
        <div 
          className="fixed z-[59] bottom-[168px] right-4 xl:hidden"
          data-testid="fab-container"
        >
          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:shadow-xl active:scale-95"
            style={{ 
              backgroundColor: 'hsl(var(--trade))',
              WebkitTapHighlightColor: 'transparent'
            }}
            data-testid="fab-quick-create"
          >
            <Star className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Open popup - centered on screen for mobile/tablet, hidden on desktop */}
      {isOpen && (
        <div 
          ref={popupRef}
          className="fixed z-[59] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 xl:hidden"
          data-testid="fab-container-open"
        >
          <div 
            className="bg-card border rounded-2xl shadow-2xl p-5 w-80 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            data-testid="quick-create-popup"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--trade) / 0.12)' }}
                >
                  <Star className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Quick Create
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleAction(action.onClick)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover-elevate transition-all"
                  style={{ backgroundColor: action.bgColor }}
                  data-testid={`quick-create-${action.label.toLowerCase().replace(' ', '-')}`}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: action.bgColor }}
                  >
                    <action.icon className="h-6 w-6" style={{ color: action.color }} />
                  </div>
                  <span className="text-[11px] font-medium text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>

            {secondaryActions.length > 0 && (
              <div className="flex gap-2 pt-2 border-t">
                {secondaryActions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.variant}
                    size="sm"
                    onClick={() => handleAction(action.onClick)}
                    className="flex-1 gap-2"
                    style={{ 
                      borderColor: `${action.color}40`,
                      color: action.color
                    }}
                    data-testid={`quick-create-${action.label.toLowerCase().replace(' ', '-')}`}
                  >
                    <action.icon className="h-4 w-4" />
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
