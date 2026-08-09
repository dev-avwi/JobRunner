import { useState } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  User, 
  ChevronRight,
  CheckCircle,
  Calendar,
  DollarSign,
  Briefcase,
  Receipt,
  Signature,
  Search,
  X,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

interface AcceptedQuote {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  subtotal: string;
  gstAmount: string;
  total: string;
  notes?: string;
  terms?: string;
  validUntil?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  depositRequired?: boolean;
  depositPercent?: number;
  depositAmount?: string;
  depositPaid?: boolean;
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  job?: {
    id: string;
    title: string;
    status: string;
  } | null;
  lineItems: LineItem[];
  hasInvoice: boolean;
}

interface AcceptedQuotePickerProps {
  onSelectQuote: (quote: AcceptedQuote) => void;
  selectedQuoteId?: string;
}

export default function AcceptedQuotePicker({ onSelectQuote, selectedQuoteId }: AcceptedQuotePickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: allQuotes = [], isLoading } = useQuery<AcceptedQuote[]>({
    queryKey: ["/api/quotes/accepted"],
    queryFn: async () => {
      const res = await fetch("/api/quotes/accepted", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch accepted quotes");
      return res.json();
    },
    staleTime: 30000,
  });

  // Filter quotes by search term
  const quotes = allQuotes.filter(quote => {
    if (!searchTerm.trim()) return true;
    
    const search = searchTerm.toLowerCase();
    const matchesNumber = quote.number.toLowerCase().includes(search);
    const matchesTitle = quote.title.toLowerCase().includes(search);
    const matchesClient = quote.client?.name.toLowerCase().includes(search);
    const matchesJob = quote.job?.title.toLowerCase().includes(search);
    
    return matchesNumber || matchesTitle || matchesClient || matchesJob;
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm">Loading accepted quotes...</span>
        </div>
      </Card>
    );
  }

  if (allQuotes.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No accepted quotes found.</p>
          <p className="text-xs mt-1">Once a client accepts a quote, it will appear here to create an invoice.</p>
        </div>
      </Card>
    );
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD',
      minimumFractionDigits: 2 
    }).format(num);
  };

  return (
    <Card className="overflow-hidden" data-testid="accepted-quotes-picker">
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Create Invoice from Accepted Quote
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select an accepted quote to generate an invoice
        </p>
      </div>
      
      {/* Search Input */}
      <div className="px-3 py-2 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by quote number, title, or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm"
            data-testid="input-quote-search"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-quote-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <ScrollArea className="h-64">
        <div className="p-2 space-y-2">
          {quotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {searchTerm ? (
                <p>No quotes matching "{searchTerm}"</p>
              ) : (
                <p>No accepted quotes found</p>
              )}
            </div>
          ) : quotes.map((quote) => (
            <button
              key={quote.id}
              onClick={() => onSelectQuote(quote)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedQuoteId === quote.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
              data-testid={`quote-picker-item-${quote.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm text-primary">#{quote.number}</span>
                    <span className="font-medium text-sm truncate max-w-[150px]">{quote.title}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />
                      Accepted
                    </Badge>
                    {quote.depositPaid && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        <DollarSign className="h-2.5 w-2.5 mr-1" />
                        Deposit Paid
                      </Badge>
                    )}
                    {quote.hasInvoice && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-500/50 text-amber-600">
                        <Receipt className="h-2.5 w-2.5 mr-1" />
                        Has Invoice
                      </Badge>
                    )}
                  </div>
                  
                  {quote.client && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{quote.client.name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(quote.total)}
                    </span>
                    {quote.lineItems.length > 0 && (
                      <span>{quote.lineItems.length} item{quote.lineItems.length > 1 ? 's' : ''}</span>
                    )}
                    {quote.acceptedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Accepted {format(new Date(quote.acceptedAt), 'MMM d')}
                      </span>
                    )}
                  </div>

                  {quote.acceptedBy && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Signature className="h-3 w-3" />
                      <span>Signed by {quote.acceptedBy}</span>
                    </div>
                  )}

                  {quote.job && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Briefcase className="h-3 w-3" />
                      <span className="truncate">Job: {quote.job.title}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  {selectedQuoteId === quote.id ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
