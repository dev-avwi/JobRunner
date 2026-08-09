import { useFormContext } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Phone, Mail, Plus, Check, Search } from "lucide-react";
import { useClients } from "@/hooks/use-clients";
import { useState } from "react";

interface ClientStepProps {
  fieldName?: string;
}

export default function ClientStep({ fieldName = "clientId" }: ClientStepProps) {
  const form = useFormContext();
  const { data: clients = [], isLoading } = useClients();
  const [searchQuery, setSearchQuery] = useState("");
  
  const selectedClientId = form.watch(fieldName);

  const filteredClients = (clients as any[]).filter((client) => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone?.includes(searchQuery)
  );

  const handleSelectClient = (clientId: string) => {
    form.setValue(fieldName, clientId, { shouldValidate: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 min-h-[48px]"
          style={{ borderRadius: '12px' }}
          data-testid="input-search-clients"
        />
      </div>

      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <Card 
            className="overflow-hidden"
            style={{ borderRadius: '16px' }}
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No clients match your search" : "No clients yet"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-[48px]"
                style={{ borderRadius: '12px' }}
                onClick={() => window.location.href = '/clients?action=new'}
                data-testid="button-add-client"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Client
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client: any) => {
            const isSelected = selectedClientId === client.id;
            return (
              <Card
                key={client.id}
                className={`overflow-hidden cursor-pointer transition-all active:scale-[0.99] ${
                  isSelected ? 'ring-2' : ''
                }`}
                style={{ 
                  borderRadius: '16px',
                  borderColor: isSelected ? 'hsl(var(--trade))' : undefined,
                  backgroundColor: isSelected ? 'hsl(var(--trade) / 0.05)' : undefined,
                  boxShadow: isSelected ? '0 0 0 2px hsl(var(--trade) / 0.3)' : undefined
                }}
                onClick={() => handleSelectClient(client.id)}
                data-testid={`client-card-${client.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ 
                        backgroundColor: isSelected 
                          ? 'hsl(var(--trade) / 0.2)' 
                          : 'hsl(var(--muted))' 
                      }}
                    >
                      {client.businessName ? (
                        <Building2 
                          className="h-6 w-6" 
                          style={{ color: isSelected ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))' }}
                        />
                      ) : (
                        <User 
                          className="h-6 w-6" 
                          style={{ color: isSelected ? 'hsl(var(--trade))' : 'hsl(var(--muted-foreground))' }}
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{client.name}</h3>
                        {isSelected && (
                          <Badge 
                            className="bg-green-500/10 text-green-600 border-green-500/20 flex-shrink-0"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        )}
                      </div>
                      
                      {client.businessName && (
                        <p className="text-sm text-muted-foreground truncate">{client.businessName}</p>
                      )}
                      
                      <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                        {client.phone && (
                          <span className="flex items-center gap-1 truncate">
                            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{client.phone}</span>
                          </span>
                        )}
                        {client.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      
      {form.formState.errors[fieldName] && (
        <p className="text-sm text-destructive">Please select a client to continue</p>
      )}
    </div>
  );
}
