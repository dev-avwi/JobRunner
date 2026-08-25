import { ReactNode } from "react";

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = "", ...rest }: PageShellProps) {
  return (
    <div className={`flex-1 w-full min-w-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}
