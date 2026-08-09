import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getSessionToken, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Users, Phone, Mail, MapPin, Briefcase, LayoutGrid, List, MoreVertical, FileText, MessageCircle, Trash2, Download, Building2, Star, CalendarPlus, Clock, DollarSign, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { CardListSkeleton } from "@/components/ui/list-skeletons";
import KPIBox from "./KPIBox";
import { useClients, useDeleteClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { useUndoableMutation } from "@/hooks/use-undoable-mutation";
import ClientCard from "./ClientCard";
import { cn } from "@/lib/utils";


interface ClientsListProps {
  onCreateClient?: () => void;
  onViewClient?: (id: string) => void;
  onCreateJobForClient?: (id: string) => void;
  onCallClient?: (phone: string) => void;
  onEmailClient?: (email: string) => void;
  onSmsClient?: (clientId: string, phone: string) => void;
}

export default function ClientsList({
  onCreateClient,
  onViewClient,
  onCreateJobForClient,
  onCallClient,
  onEmailClient,
  onSmsClient
}: ClientsListProps) {
  const searchParams = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const { data = [], isLoading = true } = useClients() ?? {};
  const clients = Array.isArray(data) ? data : [];
  const deleteClient = useDeleteClient();
  const { toast } = useToast();

  // Deferred undoable delete: actual DELETE only fires after the 8s window.
  // We optimistically remove from the cache so the row disappears instantly; Undo restores it.
  const undoableDeleteClient = useUndoableMutation<{ id: string; name: string }>({
    mode: "deferred",
    forward: ({ id }) => deleteClient.mutateAsync(id),
    successTitle: ({ name }) => "Client deleted",
    successDescription: ({ name }) => `${name} will be permanently removed`,
    undoTitle: ({ name }) => `${name} restored`,
    errorTitle: () => "Failed to delete client",
    invalidateKeys: [["/api/clients"], ["/api/clients/segments"]],
    optimistic: ({ id }) => {
      const key = ["/api/clients"];
      const current = (queryClient.getQueryData(key) as any[]) ?? [];
      queryClient.setQueryData(key, current.filter((c) => c.id !== id));
    },
  });

  const { data: segments } = useQuery<Record<string, any>>({
    queryKey: ['/api/clients/segments'],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch('/api/clients/segments', { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) return {};
      return res.json();
    }
  });

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ['/api/clients/tags'],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch('/api/clients/tags', { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const handleDeleteClick = (client: { id: string; name: string }) => {
    undoableDeleteClient.trigger(client);
  };

  const tableColumns: ColumnDef<any>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sortable: true,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      sortable: true,
      cell: (row) =>
        row.email ? (
          <a
            href={`mailto:${row.email}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.email}
          </a>
        ) : (
          "—"
        ),
    },
    {
      id: "phone",
      header: "Phone",
      accessorKey: "phone",
      sortable: true,
      hideOnMobile: true,
      cell: (row) =>
        row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.phone}
          </a>
        ) : (
          "—"
        ),
    },
    {
      id: "address",
      header: "Address",
      accessorKey: "address",
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {row.address || "—"}
        </span>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      hideOnMobile: true,
      cell: (row) => {
        const tags: string[] = Array.isArray(row.tags) ? row.tags : [];
        return tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-10",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-client-table-actions-${row.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
            <DropdownMenuItem onClick={() => onViewClient?.(row.id)}>
              <Users className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateJobForClient?.(row.id)}>
              <Briefcase className="h-4 w-4 mr-2" />
              Create Job
            </DropdownMenuItem>
            {row.phone && (
              <DropdownMenuItem onClick={() => onCallClient?.(row.phone)}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </DropdownMenuItem>
            )}
            {row.phone && (
              <DropdownMenuItem onClick={() => onSmsClient?.(row.id, row.phone)}>
                <MessageCircle className="h-4 w-4 mr-2" />
                SMS
              </DropdownMenuItem>
            )}
            {row.email && (
              <DropdownMenuItem onClick={() => onEmailClient?.(row.email)}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteClick({ id: row.id, name: row.name })}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    if (filterParam) {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const filteredClients = clients.filter((client: any) => {
    const name = client.name ? client.name.toLowerCase() : '';
    const email = client.email ? client.email.toLowerCase() : '';
    const phone = client.phone || '';
    const address = client.address ? client.address.toLowerCase() : '';
    const tags: string[] = Array.isArray(client.tags) ? client.tags : [];
    const search = searchTerm.toLowerCase();
    
    const matchesSearch = name.includes(search) ||
           email.includes(search) ||
           phone.includes(search) ||
           address.includes(search) ||
           tags.some(t => t.toLowerCase().includes(search));

    let matchesFilter = true;
    switch (activeFilter) {
      case 'all': break;
      case 'residential': matchesFilter = client.clientType === 'residential'; break;
      case 'commercial': matchesFilter = client.clientType === 'commercial'; break;
      case 'strata': matchesFilter = client.clientType === 'strata'; break;
      case 'insurance': matchesFilter = client.clientType === 'insurance'; break;
      case 'government': matchesFilter = client.clientType === 'government'; break;
      case 'vip': matchesFilter = tags.some(t => t.toLowerCase() === 'vip'); break;
      case 'no_recent_jobs': matchesFilter = Array.isArray(segments?.noRecentJobIds) && segments.noRecentJobIds.includes(client.id); break;
      case 'outstanding_balance': matchesFilter = Array.isArray(segments?.outstandingBalanceIds) && segments.outstandingBalanceIds.includes(client.id); break;
      case 'has_tags': matchesFilter = tags.length > 0; break;
      case 'with_email': matchesFilter = !!client.email; break;
      case 'with_phone': matchesFilter = !!client.phone; break;
      case 'with_address': matchesFilter = !!client.address; break;
      default: break;
    }

    const matchesTag = !activeTagFilter || tags.includes(activeTagFilter);
    
    return matchesSearch && matchesFilter && matchesTag;
  });

  return (
    <PageShell data-testid="clients-list">
      {/* Header */}
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} total`}
        action={
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex rounded-lg border bg-muted p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "h-8 px-3 rounded-md",
                  viewMode === "cards" && "bg-background shadow-sm"
                )}
                data-testid="button-clients-view-cards"
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
                data-testid="button-clients-view-table"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant="outline"
              size="icon"
              onClick={() => window.open('/api/export/clients', '_blank')}
              data-testid="button-export-clients"
              style={{ borderRadius: '12px' }}
              title="Export Clients to CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button 
              onClick={onCreateClient} 
              data-testid="button-create-client"
              className="text-white font-medium"
              style={{ backgroundColor: 'hsl(var(--trade))', borderRadius: '12px' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Button>
          </div>
        }
      />

      {/* Search */}
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search clients by name, email, phone, tag..."
      />

      {/* Smart Segment Chips */}
      <FilterChips 
        chips={[
          { id: 'all', label: 'All', count: segments?.all ?? clients.length, icon: <Users className="h-3 w-3" /> },
          { id: 'residential', label: 'Residential', count: segments?.residential, icon: <Users className="h-3 w-3" /> },
          { id: 'commercial', label: 'Commercial', count: segments?.commercial, icon: <Building2 className="h-3 w-3" /> },
          { id: 'vip', label: 'VIP', count: segments?.vip, icon: <Star className="h-3 w-3" /> },
          { id: 'no_recent_jobs', label: 'Inactive 6mo+', count: segments?.no_recent_jobs, icon: <Clock className="h-3 w-3" /> },
          { id: 'outstanding_balance', label: 'Outstanding', count: segments?.outstanding_balance, icon: <DollarSign className="h-3 w-3" /> },
        ]}
        activeId={activeFilter}
        onSelect={(id) => { setActiveFilter(id); setActiveTagFilter(null); }}
      />

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {allTags.slice(0, 12).map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setActiveTagFilter(activeTagFilter === tag ? null : tag);
                setActiveFilter('all');
              }}
              className={cn(
                "inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium transition-colors border",
                activeTagFilter === tag
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover-elevate"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border rounded-md p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-8 w-12 bg-muted rounded" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <KPIBox
              icon={Users}
              title="Total Clients"
              value={(segments?.all ?? clients.length).toString()}
              onClick={() => { setActiveFilter('all'); setActiveTagFilter(null); }}
            />
            <KPIBox
              icon={Building2}
              title="Commercial"
              value={(segments?.commercial ?? 0).toString()}
              onClick={() => { setActiveFilter('commercial'); setActiveTagFilter(null); }}
            />
            <KPIBox
              icon={Star}
              title="VIP"
              value={(segments?.vip ?? 0).toString()}
              onClick={() => { setActiveFilter('vip'); setActiveTagFilter(null); }}
            />
            <KPIBox
              icon={DollarSign}
              title="Outstanding"
              value={(segments?.outstanding_balance ?? 0).toString()}
              onClick={() => { setActiveFilter('outstanding_balance'); setActiveTagFilter(null); }}
            />
          </>
        )}
      </div>

      {/* Recent Clients */}
      <Card>
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-base font-semibold">Recent Clients</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                <div className="animate-pulse text-xs">Loading...</div>
              </div>
            ) : clients.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto">
                <div className="space-y-2 pr-2">
                  {clients.slice(0, 5).map((client: any) => (
                    <div 
                      key={client.id}
                      className="flex items-start gap-2 text-xs hover-elevate p-2 rounded cursor-pointer"
                      onClick={() => onViewClient?.(client.id)}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {client.phone || client.email || 'No contact info'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No clients yet</p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Clients List - Table or Card View */}
      {isLoading ? (
        <CardListSkeleton count={4} data-testid="clients-loading" />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description={
            searchTerm 
              ? "Try adjusting your search terms"
              : "Save client details once, use them everywhere. Makes quoting and invoicing a breeze."
          }
          action={
            !searchTerm && (
              <Button 
                onClick={onCreateClient}
                style={{ borderRadius: '12px' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            )
          }
          tip={!searchTerm ? "Client details auto-fill into quotes and invoices" : undefined}
          encouragement={!searchTerm ? "Start with your most frequent customer" : undefined}
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredClients}
          columns={tableColumns}
          onRowClick={(row) => onViewClient?.(row.id)}
          isLoading={isLoading}
          pageSize={15}
          showViewToggle={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="space-y-3" data-testid="clients-list-card">
          {filteredClients.map((client: any) => (
            <ClientCard
              key={client.id}
              {...client}
              onView={() => onViewClient?.(client.id)}
              onCreateJob={() => onCreateJobForClient?.(client.id)}
              onCall={() => onCallClient?.(client.phone)}
              onEmail={() => onEmailClient?.(client.email)}
              onDelete={() => handleDeleteClick({ id: client.id, name: client.name })}
            />
          ))}
        </div>
      )}

    </PageShell>
  );
}