import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  LayoutGrid, 
  List,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => any;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  renderCard?: (row: T, index: number) => React.ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  pageSize?: number;
  showViewToggle?: boolean;
  defaultView?: "table" | "cards";
  stickyHeader?: boolean;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  renderCard,
  isLoading = false,
  emptyMessage = "No data found",
  emptyIcon,
  pageSize = 10,
  showViewToggle = true,
  defaultView = "table",
  stickyHeader = false,
  getRowId,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<"table" | "cards">(defaultView);

  const getValue = (row: T, column: ColumnDef<T>) => {
    if (column.accessorFn) {
      return column.accessorFn(row);
    }
    if (column.accessorKey) {
      return (row as any)[column.accessorKey];
    }
    return null;
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const aVal = getValue(a, column);
      const bVal = getValue(b, column);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, columns]);

  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-pulse flex space-x-4 w-full">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                  <div className="h-4 bg-muted rounded w-4/6"></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            {emptyIcon && <div className="mb-4 text-muted-foreground">{emptyIcon}</div>}
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showViewToggle && renderCard && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border bg-muted p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("cards")}
              className={cn(
                "h-8 px-3 rounded-md",
                viewMode === "cards" && "bg-background shadow-sm"
              )}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("table")}
              className={cn(
                "h-8 px-3 rounded-md",
                viewMode === "table" && "bg-background shadow-sm"
              )}
              data-testid="button-view-table"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {viewMode === "cards" && renderCard ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedData.map((row, index) => (
            <div key={getRowId ? getRowId(row) : index}>
              {renderCard(row, currentPage * pageSize + index)}
            </div>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className={cn(stickyHeader && "sticky top-0 bg-card z-10")}>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={cn(
                        column.className,
                        column.hideOnMobile && "hidden md:table-cell",
                        column.sortable && "cursor-pointer select-none"
                      )}
                      onClick={() => column.sortable && handleSort(column.id)}
                    >
                      <div className="flex items-center">
                        {column.header}
                        {column.sortable && getSortIcon(column.id)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, rowIndex) => (
                  <TableRow
                    key={getRowId ? getRowId(row) : rowIndex}
                    className={cn(
                      onRowClick && "cursor-pointer hover:bg-muted/50 active:bg-muted"
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    data-testid={`table-row-${getRowId ? getRowId(row) : rowIndex}`}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.className,
                          column.hideOnMobile && "hidden md:table-cell"
                        )}
                      >
                        {column.cell ? column.cell(row) : getValue(row, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to{" "}
            {Math.min((currentPage + 1) * pageSize, sortedData.length)} of{" "}
            {sortedData.length}
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ 
  status, 
  variant = "default" 
}: { 
  status: string; 
  variant?: "default" | "success" | "warning" | "destructive" | "outline" | "secondary";
}) {
  const statusStyles: Record<string, { variant: typeof variant; label: string }> = {
    pending: { variant: "outline", label: "Pending" },
    in_progress: { variant: "secondary", label: "In Progress" },
    scheduled: { variant: "secondary", label: "Scheduled" },
    done: { variant: "default", label: "Completed" },
    completed: { variant: "default", label: "Completed" },
    draft: { variant: "outline", label: "Draft" },
    sent: { variant: "secondary", label: "Sent" },
    accepted: { variant: "default", label: "Accepted" },
    declined: { variant: "destructive", label: "Declined" },
    expired: { variant: "destructive", label: "Expired" },
    paid: { variant: "default", label: "Paid" },
    overdue: { variant: "destructive", label: "Overdue" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };

  const style = statusStyles[status] || { variant: "outline", label: status };

  return (
    <Badge variant={style.variant as any} className="text-xs">
      {style.label}
    </Badge>
  );
}
