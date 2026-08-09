import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  maxWidth?: "default" | "wide" | "full";
}

export function PageShell({ 
  children, 
  className,
  maxWidth = "full",
  ...rest
}: PageShellProps) {
  const maxWidthClasses = {
    default: "max-w-[1600px]",
    wide: "max-w-[1920px]",
    full: "max-w-full"
  };

  return (
    <div 
      className={cn(
        "w-full px-4 sm:px-5 md:px-6 lg:px-8 py-5 sm:py-6 section-gap pb-28 md:pb-6",
        maxWidthClasses[maxWidth],
        maxWidth !== "full" && "mx-auto",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  leading?: ReactNode;
  className?: string;
  size?: "default" | "large";
}

export function PageHeader({ 
  title, 
  subtitle, 
  action,
  leading,
  className,
  size = "default"
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {leading && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              {leading}
            </div>
          )}
          <div>
            <h1 className={cn(
              size === "large" ? "ios-title" : "text-[28px] sm:text-[32px] font-bold tracking-tight leading-tight"
            )}>{title}</h1>
            {subtitle && (
              <p className="ios-caption mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function SectionTitle({ children, className, icon }: SectionTitleProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {icon && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
             style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
          {icon}
        </div>
      )}
      <p className="ios-label">{children}</p>
    </div>
  );
}

interface SectionGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function SectionGrid({ 
  children, 
  columns = 2,
  className 
}: SectionGridProps) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <div className={cn(
      "grid gap-3",
      colClasses[columns],
      className
    )}>
      {children}
    </div>
  );
}

interface KPIGridProps {
  children: ReactNode;
  className?: string;
}

export function KPIGrid({ children, className }: KPIGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-2 lg:grid-cols-4 gap-3",
      className
    )}>
      {children}
    </div>
  );
}

interface WidgetsGridProps {
  children: ReactNode;
  className?: string;
}

export function WidgetsGrid({ children, className }: WidgetsGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-2 gap-4",
      className
    )}>
      {children}
    </div>
  );
}

interface ContentGridProps {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export function ContentGrid({ children, columns = 2, className }: ContentGridProps) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2"
  };

  return (
    <div className={cn(
      "grid gap-4",
      colClasses[columns],
      className
    )}>
      {children}
    </div>
  );
}

interface FeedListProps {
  children: ReactNode;
  className?: string;
}

export function FeedList({ children, className }: FeedListProps) {
  return (
    <div className={cn("feed-gap", className)}>
      {children}
    </div>
  );
}
