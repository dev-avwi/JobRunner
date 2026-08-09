import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LockedActionProps {
  reason?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a control that the current user cannot use. Renders a non-interactive
 * version of the child with a small lock indicator and a tooltip explaining
 * why. Prefer hiding the control entirely; use this when the control must stay
 * visible (e.g. to communicate that the feature exists).
 */
export default function LockedAction({
  reason = "Your role doesn't have permission for this action",
  children,
  className,
}: LockedActionProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-disabled="true"
            className={`relative inline-flex opacity-60 pointer-events-none select-none ${className ?? ""}`}
            data-testid="locked-action"
          >
            {children}
            <span
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center border"
              aria-hidden="true"
            >
              <Lock className="h-2.5 w-2.5" />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
