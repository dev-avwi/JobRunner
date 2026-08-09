import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { FileInput } from "lucide-react";
import { format } from "date-fns";

interface ImportRunInfo {
  id: string;
  fileName: string;
  importedAt: string;
  ranBy?: string;
}

/**
 * Task 300: shows where an imported record came from — which file, which row,
 * and when. Renders nothing for records created in-app (no importRunId).
 */
export function ImportOriginBadge({
  importRunId,
  rowNumber,
  className,
}: {
  importRunId?: string | null;
  rowNumber?: number | null;
  className?: string;
}) {
  const { data } = useQuery<ImportRunInfo>({
    queryKey: [`/api/import/history/${importRunId}`],
    enabled: !!importRunId,
    staleTime: 5 * 60 * 1000,
  });

  if (!importRunId) return null;

  const label = data
    ? `Imported from ${data.fileName}${rowNumber ? ` (row ${rowNumber})` : ''}${data.importedAt ? ` on ${format(new Date(data.importedAt), 'd MMM yyyy')}` : ''}`
    : 'Imported record';

  return (
    <Badge
      variant="outline"
      className={`text-muted-foreground font-normal max-w-full ${className || ''}`}
      title={label}
      data-testid="badge-import-origin"
    >
      <FileInput className="h-3 w-3 mr-1 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
