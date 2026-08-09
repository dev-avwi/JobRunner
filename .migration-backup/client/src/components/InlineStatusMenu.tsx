import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import StatusBadge from "./StatusBadge";

export type DocType = "quote" | "invoice";

interface StatusOption {
  value: string;
  label: string;
}

const QUOTE_TRANSITIONS: Record<string, StatusOption[]> = {
  draft: [
    { value: "sent", label: "Mark Sent" },
    { value: "accepted", label: "Mark Accepted" },
    { value: "declined", label: "Mark Declined" },
  ],
  sent: [
    { value: "accepted", label: "Mark Accepted" },
    { value: "declined", label: "Mark Declined" },
    { value: "draft", label: "Move to Draft" },
  ],
  accepted: [
    { value: "draft", label: "Move to Draft" },
  ],
  declined: [
    { value: "draft", label: "Move to Draft" },
    { value: "sent", label: "Mark Sent" },
  ],
  rejected: [
    { value: "draft", label: "Move to Draft" },
    { value: "sent", label: "Mark Sent" },
  ],
};

const INVOICE_TRANSITIONS: Record<string, StatusOption[]> = {
  draft: [
    { value: "sent", label: "Mark Sent" },
    { value: "paid", label: "Mark Paid" },
    { value: "cancelled", label: "Mark Cancelled" },
  ],
  sent: [
    { value: "paid", label: "Mark Paid" },
    { value: "cancelled", label: "Mark Cancelled" },
    { value: "draft", label: "Move to Draft" },
  ],
  overdue: [
    { value: "paid", label: "Mark Paid" },
    { value: "cancelled", label: "Mark Cancelled" },
  ],
  paid: [],
  cancelled: [
    { value: "draft", label: "Move to Draft" },
  ],
};

export interface InlineStatusMenuProps {
  type: DocType;
  status: string;
  /** Disable transitions (e.g. for locked/paid invoices, archived rows). */
  disabled?: boolean;
  onSelect: (nextStatus: string) => void;
  testIdPrefix?: string;
}

export default function InlineStatusMenu({
  type,
  status,
  disabled,
  onSelect,
  testIdPrefix,
}: InlineStatusMenuProps) {
  const map = type === "quote" ? QUOTE_TRANSITIONS : INVOICE_TRANSITIONS;
  const options = map[status] ?? [];
  const hasOptions = options.length > 0 && !disabled;
  const prefix = testIdPrefix || `${type}-status-${status}`;

  if (!hasOptions) {
    return <StatusBadge status={status} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md hover-elevate active-elevate-2"
          data-testid={`${prefix}-trigger`}
          aria-label={`Change ${type} status from ${status}`}
        >
          <StatusBadge status={status} />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">Change status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(opt.value);
            }}
            data-testid={`${prefix}-set-${opt.value}`}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
