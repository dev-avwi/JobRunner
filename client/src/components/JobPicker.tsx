import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, MapPin, XCircle, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const JOB_STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  pending: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: 'Pending', dot: 'bg-amber-500' },
  scheduled: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', label: 'Scheduled', dot: 'bg-blue-500' },
  in_progress: { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', label: 'In Progress', dot: 'bg-orange-500' },
  done: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: 'Done', dot: 'bg-green-500' },
  invoiced: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', label: 'Invoiced', dot: 'bg-purple-500' },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-800/40', text: 'text-gray-500 dark:text-gray-400', label: 'Cancelled', dot: 'bg-gray-400' },
};

export function getJobStatusStyle(status: string) {
  return JOB_STATUS_STYLES[status] || JOB_STATUS_STYLES.pending;
}

interface JobPickerProps {
  value: string;
  onChange: (jobId: string) => void;
  onJobSelected?: (job: any) => void;
  label?: string | null;
  placeholder?: string;
  /** Filter which jobs appear. Default: everything except cancelled. */
  filterJobs?: (job: any) => boolean;
  /** Allow clearing the selected job. Default true. */
  clearable?: boolean;
  className?: string;
}

export default function JobPicker({
  value,
  onChange,
  onJobSelected,
  label = "Link to Job",
  placeholder = "Search jobs by title, address, or client...",
  filterJobs,
  clearable = true,
  className,
}: JobPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: jobs = [] } = useQuery<any[]>({ queryKey: ["/api/jobs"] });

  const activeJobs = jobs.filter((j: any) => (filterJobs ? filterJobs(j) : j.status !== 'cancelled'));
  const filtered = activeJobs.filter((j: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return j.title?.toLowerCase().includes(q) || j.address?.toLowerCase().includes(q) || j.clientName?.toLowerCase().includes(q);
  });

  const selectedJob = jobs.find((j: any) => j.id === value);
  const selectedStyle = selectedJob ? getJobStatusStyle(selectedJob.status) : null;

  return (
    <div className={cn("space-y-1.5", className)} data-testid="job-picker">
      {label !== null && (
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
          <LinkIcon className="w-3 h-3" /> {label}
        </Label>
      )}
      {selectedJob ? (
        <div className={cn("flex items-center gap-3 p-2.5 rounded-md border", selectedStyle?.bg)}>
          <div className={cn("w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0", selectedStyle?.bg)}>
            <Briefcase className={cn("w-4 h-4", selectedStyle?.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedJob.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {selectedJob.address && <span className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{selectedJob.address}</span>}
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0", selectedStyle?.bg, selectedStyle?.text)}>
                {selectedStyle?.label}
              </span>
            </div>
          </div>
          {clearable && (
            <Button size="icon" variant="ghost" onClick={() => { onChange(""); }} data-testid="button-clear-job">
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-8 pr-8"
            data-testid="input-job-search"
          />
          <Briefcase className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          {open && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  <Briefcase className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                  {search ? "No jobs matching your search" : "No active jobs"}
                </div>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b bg-muted/30 sticky top-0">
                    {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : `${filtered.length} active job${filtered.length !== 1 ? 's' : ''}`}
                  </div>
                  {filtered.slice(0, 15).map((job: any) => {
                    const style = getJobStatusStyle(job.status);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm hover-elevate flex items-center gap-3 border-b last:border-b-0 border-border/40"
                        onClick={() => {
                          onChange(job.id);
                          onJobSelected?.(job);
                          setSearch("");
                          setOpen(false);
                        }}
                        data-testid={`job-option-${job.id}`}
                      >
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", style.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate flex-1">{job.title}</p>
                            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap", style.bg, style.text)}>
                              {style.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {job.address && <span className="truncate flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{job.address}</span>}
                            {job.clientName && <span className="truncate flex-shrink-0">{job.clientName}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
