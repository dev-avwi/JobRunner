import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CardListSkeletonProps {
  count?: number;
  className?: string;
  /** Render as compact rows (smaller padding/heights). */
  compact?: boolean;
  "data-testid"?: string;
}

/**
 * Reusable skeleton for card-based lists (jobs, quotes, invoices, clients).
 * Mirrors the visual rhythm of the real cards: avatar circle + two text lines + amount/CTA.
 */
export function CardListSkeleton({
  count = 4,
  className,
  compact = false,
  "data-testid": testId,
}: CardListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid={testId}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} style={{ borderRadius: "14px" }}>
          <CardContent className={cn(compact ? "p-3" : "p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-9 w-16 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  "data-testid"?: string;
}

/** Reusable skeleton for table-style list views. */
export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
  "data-testid": testId,
}: TableSkeletonProps) {
  return (
    <div className={cn("rounded-md border overflow-hidden", className)} data-testid={testId}>
      <div className="border-b bg-muted/30 p-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 flex gap-4">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4 flex-1", c === 0 && "max-w-[35%]")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
