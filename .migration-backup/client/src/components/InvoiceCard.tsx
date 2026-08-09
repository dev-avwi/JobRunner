import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, User, Calendar, CreditCard, ChevronRight, MoreVertical, Archive, RotateCcw, Trash2, Copy } from "lucide-react";
import StatusBadge from "./StatusBadge";
import XeroRibbon from "./XeroRibbon";
import InlineStatusMenu from "./InlineStatusMenu";

interface InvoiceCardProps {
  id: string;
  number: string;
  client: string;
  jobTitle: string;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | string;
  sentAt?: string;
  paidAt?: string;
  dueDate?: string;
  xeroInvoiceId?: string;
  isXeroImport?: boolean;
  isArchived?: boolean;
  isLocked?: boolean;
  onViewClick?: (id: string) => void;
  onSendClick?: (id: string) => void;
  onCreatePaymentLink?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
  onStatusChange?: (id: string, nextStatus: string) => void;
  onDuplicate?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function InvoiceCard({ 
  id, 
  number, 
  client, 
  jobTitle, 
  total, 
  status, 
  sentAt,
  paidAt,
  dueDate,
  xeroInvoiceId,
  isXeroImport,
  isArchived,
  onViewClick, 
  onSendClick,
  onCreatePaymentLink,
  onMarkPaid,
  onStatusChange,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
  isLocked,
}: InvoiceCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer relative overflow-visible"
      style={{ borderRadius: '14px' }}
      onClick={() => onViewClick?.(id)}
      data-testid={`invoice-card-${id}`}
    >
      {(isXeroImport || xeroInvoiceId) && <XeroRibbon size="sm" />}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
              >
                <FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[15px]">{number}</h3>
                  {onStatusChange && !isArchived ? (
                    <InlineStatusMenu
                      type="invoice"
                      status={status}
                      disabled={status === 'paid' || isLocked}
                      onSelect={(next) => onStatusChange(id, next)}
                      testIdPrefix={`invoice-status-${id}`}
                    />
                  ) : (
                    <StatusBadge status={status} />
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{client}</span>
                </div>
              </div>
            </div>

            <div className="pl-12 space-y-1.5">
              <p className="text-sm font-medium line-clamp-1">{jobTitle}</p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {sentAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Sent {sentAt}</span>
                  </div>
                )}
                {paidAt && (
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    <span>Paid {paidAt}</span>
                  </div>
                )}
                {dueDate && status !== 'paid' && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className={status === 'overdue' ? 'text-destructive' : ''}>
                      Due {dueDate}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: 'hsl(var(--trade))' }}>
                {formatCurrency(total)}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {status === 'draft' && (
                <Button 
                  size="xl"
                  onClick={(e) => { e.stopPropagation(); onSendClick?.(id); }}
                  data-testid={`button-send-invoice-${id}`}
                >
                  Send
                </Button>
              )}
              
              {(status === 'sent' || status === 'overdue') && (
                <Button 
                  variant="outline"
                  size="xl"
                  onClick={(e) => { e.stopPropagation(); onMarkPaid?.(id); }}
                  data-testid={`button-mark-paid-${id}`}
                >
                  Paid
                </Button>
              )}

              {(onArchive || onUnarchive || onDelete || onDuplicate) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-invoice-card-actions-${id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    {!isArchived && onDuplicate && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(id); }} data-testid={`menu-duplicate-invoice-${id}`}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                    )}
                    {!isArchived && onArchive && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(id); }} data-testid={`menu-archive-invoice-${id}`}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    {isArchived && onUnarchive && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnarchive(id); }} data-testid={`menu-unarchive-invoice-${id}`}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                        className="text-destructive focus:text-destructive"
                        data-testid={`menu-delete-invoice-${id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
