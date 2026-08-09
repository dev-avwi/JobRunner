import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className={`flex-1 w-full min-w-0 ${className}`}>
      {children}
    </div>
  );
}
