import { useState } from "react";
import { 
  Sparkles, 
  Shield, 
  Lock, 
  CheckCircle2,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "jobrunner-banner-dismissed";

interface TrustBannerProps {
  compact?: boolean;
}

export default function TrustBanner({ compact = false }: TrustBannerProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  // If dismissed, show nothing or a minimal indicator
  if (isDismissed) {
    return null;
  }

  if (compact) {
    return (
      <div 
        className="flex items-center justify-between py-2 px-4 border-b text-xs"
        style={{ 
          backgroundColor: 'hsl(var(--trade) / 0.05)',
          borderColor: 'hsl(var(--trade) / 0.15)',
          color: 'hsl(var(--trade))'
        }}
        data-testid="trust-banner-compact"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Early Access - Free to use</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            <span>Bank-level security</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            <span>Your data stays yours</span>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss banner"
          data-testid="button-dismiss-banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="border p-4 relative"
      style={{ 
        borderRadius: '16px', 
        borderColor: 'hsl(var(--trade) / 0.2)',
        background: 'linear-gradient(to right, hsl(var(--trade) / 0.05), hsl(var(--trade) / 0.08))'
      }}
      data-testid="trust-banner"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss banner"
        data-testid="button-dismiss-banner"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex items-center gap-3 pr-8">
        <div 
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
        >
          <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">JobRunner</p>
            <Badge 
              className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-0"
            >
              Early Access
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Built for Australian tradies
          </p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <span>GST compliant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <span>Secure payments</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          <span>Encrypted</span>
        </div>
      </div>
    </div>
  );
}
