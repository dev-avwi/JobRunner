import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  Search, 
  Users, 
  Briefcase, 
  FileText, 
  Receipt,
  Calendar,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  type: 'job' | 'client' | 'quote' | 'invoice';
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  amount?: number;
  status?: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Fetch search results
  const { data: results = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/search', searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    setSearchQuery("");
    
    // Navigate directly to the detail view of the selected item
    switch (result.type) {
      case 'job':
        setLocation(`/jobs/${result.id}`);
        break;
      case 'client':
        setLocation(`/clients/${result.id}`);
        break;
      case 'quote':
        setLocation(`/quotes/${result.id}`);
        break;
      case 'invoice':
        setLocation(`/invoices/${result.id}`);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'job': return Briefcase;
      case 'client': return Users;
      case 'quote': return FileText;
      case 'invoice': return Receipt;
      default: return Search;
    }
  };

  const getGroupLabel = (type: string) => {
    switch (type) {
      case 'job': return 'Jobs';
      case 'client': return 'Clients';
      case 'quote': return 'Quotes';
      case 'invoice': return 'Invoices';
      default: return 'Results';
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-muted';
    const lower = status.toLowerCase();
    if (lower.includes('completed') || lower.includes('paid')) return 'bg-green-500/20 text-green-700 dark:text-green-400';
    if (lower.includes('progress')) return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
    if (lower.includes('sent')) return 'bg-purple-500/20 text-purple-700 dark:text-purple-400';
    if (lower.includes('pending') || lower.includes('draft')) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
    if (lower.includes('overdue')) return 'bg-red-500/20 text-red-700 dark:text-red-400';
    return 'bg-muted';
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search jobs, clients, quotes, invoices..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
        data-testid="input-global-search"
      />
      <CommandList>
        {searchQuery.length >= 2 && (
          <>
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Searching...
              </div>
            )}
            
            {!isLoading && results.length === 0 && (
              <CommandEmpty>
                <div className="py-6 text-center">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-40 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">No results found</p>
                  <p className="text-xs text-muted-foreground">
                    Try searching with different keywords
                  </p>
                </div>
              </CommandEmpty>
            )}

            {!isLoading && results.length > 0 && (
              <>
                {Object.entries(groupedResults).map(([type, items]) => {
                  const Icon = getIcon(type);
                  return (
                    <CommandGroup key={type} heading={getGroupLabel(type)}>
                      {items.map((result) => (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          value={`${result.title} ${result.subtitle || ''}`}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center justify-between gap-3 py-3"
                          data-testid={`search-result-${result.type}-${result.id}`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-muted flex-shrink-0 mt-0.5">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {result.title}
                              </div>
                              {result.subtitle && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {result.subtitle}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {result.date && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {result.date}
                                  </div>
                                )}
                                {result.amount !== undefined && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(result.amount)}
                                  </div>
                                )}
                                {result.status && (
                                  <Badge 
                                    variant="secondary"
                                    className={`text-xs px-2 py-0 ${getStatusColor(result.status)}`}
                                  >
                                    {result.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </>
        )}
        
        {searchQuery.length < 2 && (
          <div className="py-6 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium mb-1">Quick search</p>
            <p className="text-xs">
              Type at least 2 characters to search across jobs, clients, quotes, and invoices
            </p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
