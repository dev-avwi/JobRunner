import { useEffect, useState } from "react";
import { WifiOff, Cloud, RefreshCw, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNetwork } from "@/contexts/NetworkContext";
import { cn } from "@/lib/utils";

export default function OfflineIndicator() {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncResult, sync } = useNetwork();
  const { toast } = useToast();
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  useEffect(() => {
    if (lastSyncResult && lastSyncResult.success && lastSyncResult.synced > 0) {
      setShowSuccess(true);
      toast({
        title: "Synced successfully",
        description: `${lastSyncResult.synced} item${lastSyncResult.synced > 1 ? "s" : ""} synced to the cloud.`,
      });
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult, toast]);

  useEffect(() => {
    if (isOnline && wasOffline) {
      toast({
        title: "Back online",
        description: pendingSyncCount > 0 
          ? "Syncing your changes now..." 
          : "You're connected to the internet.",
      });
      setWasOffline(false);
    }
  }, [isOnline, wasOffline, pendingSyncCount, toast]);

  const shouldShow = !isOnline || isSyncing || pendingSyncCount > 0 || showSuccess;

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50",
        "transition-all duration-300 ease-out",
        shouldShow ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      role="status"
      aria-live="polite"
      data-testid="offline-indicator"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg border",
          "backdrop-blur-sm",
          !isOnline
            ? "bg-orange-500/95 text-white border-orange-600"
            : isSyncing
            ? "bg-blue-500/95 text-white border-blue-600"
            : showSuccess
            ? "bg-green-500/95 text-white border-green-600"
            : "bg-card/95 text-foreground border-border"
        )}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">You're offline</span>
            {pendingSyncCount > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-white/20 text-white border-transparent text-xs"
                data-testid="badge-pending-sync-count"
              >
                {pendingSyncCount} pending
              </Badge>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            <span className="text-sm font-medium">Syncing changes...</span>
            {pendingSyncCount > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-white/20 text-white border-transparent text-xs"
                data-testid="badge-syncing-count"
              >
                {pendingSyncCount}
              </Badge>
            )}
          </>
        ) : showSuccess ? (
          <>
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">All changes synced</span>
          </>
        ) : pendingSyncCount > 0 ? (
          <>
            <Cloud className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              {pendingSyncCount} change{pendingSyncCount > 1 ? "s" : ""} waiting
            </span>
            <button
              onClick={() => sync()}
              className="text-xs underline hover:no-underline ml-1"
              data-testid="button-sync-now"
            >
              Sync now
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
