import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
  testId?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  testId
}: StatCardProps) {
  return (
    <Card 
      className={cn("", className)}
      style={{ borderRadius: '14px' }}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p className={cn(
                "text-xs font-medium",
                trend.positive ? "text-success" : "text-destructive"
              )}>
                {trend.positive ? "+" : ""}{trend.value}
              </p>
            )}
          </div>
          {Icon && (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CompactCardProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  maxHeight?: string;
  testId?: string;
}

export function CompactCard({
  title,
  children,
  action,
  icon: Icon,
  className,
  maxHeight = "max-h-[300px]",
  testId
}: CompactCardProps) {
  return (
    <Card 
      className={cn(className)} 
      style={{ borderRadius: '16px' }}
      data-testid={testId}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className={cn("px-4 pb-4", maxHeight, "overflow-y-auto")}>
        {children}
      </CardContent>
    </Card>
  );
}

interface ListCardItemProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  meta?: Array<{ icon: LucideIcon; text: string }>;
  onClick?: () => void;
  className?: string;
  testId?: string;
  showChevron?: boolean;
}

export function ListCardItem({
  title,
  subtitle,
  badge,
  meta = [],
  onClick,
  className,
  testId,
  showChevron = true
}: ListCardItemProps) {
  return (
    <Card
      className={cn(
        "hover-elevate active-elevate-2",
        onClick && "cursor-pointer",
        className
      )}
      style={{ borderRadius: '14px' }}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-[15px] line-clamp-1">{title}</h4>
              {badge && <div className="flex-shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {subtitle}
              </p>
            )}
            {meta.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                {meta.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[120px]">{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {onClick && showChevron && (
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tip?: string;
  encouragement?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tip,
  encouragement
}: EmptyStateProps) {
  return (
    <Card 
      className={cn("text-center py-10 px-6", className)}
      style={{ borderRadius: '16px' }}
    >
      <CardContent className="p-0">
        <div 
          className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4"
        >
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="text-base font-semibold mb-1">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">{description}</p>
        )}
        {action && <div className="mb-4">{action}</div>}
        {tip && (
          <div className="mt-4 p-3 bg-muted/30 rounded-xl mx-auto max-w-xs">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tip:</span> {tip}
            </p>
          </div>
        )}
        {encouragement && (
          <p className="text-xs text-muted-foreground mt-3 italic">{encouragement}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface NativeListProps {
  children: ReactNode;
  className?: string;
}

export function NativeList({ children, className }: NativeListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}
