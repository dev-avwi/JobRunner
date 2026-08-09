import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LandingShellProps {
  children: ReactNode;
  className?: string;
  /** Set to false for the rare row that draws its own padding (e.g. edge-to-edge hero gradient). */
  padded?: boolean;
}

/**
 * Shared max-width container for the public landing page.
 *
 * Replaces the repeated `max-w-[1600px] mx-auto px-5 lg:px-8` literal that
 * appeared in eight places. Single source of truth so a future width change
 * (or a global gutter tweak) is a one-line edit instead of search-and-replace.
 */
export function LandingShell({ children, className, padded = true }: LandingShellProps) {
  return (
    <div
      className={cn(
        "max-w-[1600px] mx-auto",
        padded && "px-5 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
