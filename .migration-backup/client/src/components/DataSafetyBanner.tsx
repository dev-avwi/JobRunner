import { Shield, Lock, Cloud, CheckCircle2 } from "lucide-react";

interface DataSafetyBannerProps {
  compact?: boolean;
}

export default function DataSafetyBanner({ compact = false }: DataSafetyBannerProps) {
  if (compact) {
    return (
      <div 
        className="flex items-center gap-2 text-xs text-muted-foreground py-2"
        data-testid="data-safety-compact"
      >
        <Shield className="h-3 w-3 text-green-600" />
        <span>Your data is encrypted and backed up daily</span>
      </div>
    );
  }

  return (
    <div 
      className="bg-muted/30 rounded-lg p-4 border border-border/50"
      data-testid="data-safety-banner"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h4 className="text-sm font-medium">Your Data is Safe</h4>
          <p className="text-xs text-muted-foreground">Bank-level security protects your business</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Encrypted</p>
            <p className="text-[10px] text-muted-foreground">256-bit SSL encryption</p>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Backed Up</p>
            <p className="text-[10px] text-muted-foreground">Automatic daily backups</p>
          </div>
        </div>
        
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Australian Hosted</p>
            <p className="text-[10px] text-muted-foreground">Data stays in Australia</p>
          </div>
        </div>
      </div>
    </div>
  );
}
