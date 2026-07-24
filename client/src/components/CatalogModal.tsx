import { useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLineItemCatalog } from "@/hooks/use-templates";
import { type LineItemCatalog } from "@shared/schema";

interface CatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectItem: (item: any) => void;
  tradeType?: string;
}

export default function CatalogModal({ open, onOpenChange, onSelectItem, tradeType }: CatalogModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  // Set filter to user's trade type by default when available
  useEffect(() => {
    if (tradeType && selectedCategory === "") {
      setSelectedCategory(tradeType);
    }
  }, [tradeType]);
  
  const { data: catalogItems = [], isLoading } = useLineItemCatalog(tradeType);
  
  // Get unique trade types for filtering  
  const tradeTypes = Array.from(new Set(catalogItems.map(item => item.tradeType).filter(Boolean)));
  
  // Filter items based on search and trade type
  const filteredItems = catalogItems.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item as any).itemCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTradeType = selectedCategory === "" || selectedCategory === "all" || item.tradeType === selectedCategory;
    
    return matchesSearch && matchesTradeType;
  });
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };
  
  const handleSelectItem = (item: any) => {
    onSelectItem(item);
    // Note: Parent component handles closing the modal to avoid React state batching issues
    setSearchTerm("");
    setSelectedCategory("");
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-catalog-modal">
        <DialogHeader>
          <DialogTitle>Browse Service Catalog</DialogTitle>
          <DialogDescription>
            Select from common services to quickly add to your line items
          </DialogDescription>
        </DialogHeader>
        
        {/* Search and Filter Controls */}
        <div className="flex gap-4 p-4 border-b">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-catalog-search"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48" data-testid="select-catalog-trade-type">
              <SelectValue placeholder="Filter by trade type" />
            </SelectTrigger>
            <SelectContent>
              {/* Show user's trade first if they have one */}
              {tradeType && (
                <SelectItem value={tradeType}>
                  {tradeType.charAt(0).toUpperCase() + tradeType.slice(1)} (My Trade)
                </SelectItem>
              )}
              <SelectItem value="all">All Trade Types</SelectItem>
              {/* Show other trades, excluding user's trade to avoid duplication */}
              {tradeTypes
                .filter(trade => trade !== tradeType)
                .map((trade) => (
                <SelectItem key={trade || 'unknown'} value={trade || "unknown"}>
                  {trade ? trade.charAt(0).toUpperCase() + trade.slice(1) : 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Catalog Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading catalog items...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-muted-foreground mb-2">
                {searchTerm || selectedCategory ? "No items match your filters" : "No catalog items available"}
              </div>
              {(searchTerm || selectedCategory) && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => handleSelectItem(item)}
                  data-testid={`card-catalog-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-sm">{item.name}</h3>
                      {(item as any).itemCode && (
                        <p className="text-xs text-muted-foreground font-mono">{(item as any).itemCode}</p>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item);
                        }}
                        data-testid={`button-add-item-${item.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {item.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">
                        {formatCurrency(parseFloat((item as any).unitPrice || "0"))}
                        <span className="text-muted-foreground font-normal">/{item.unit}</span>
                      </div>
                      
                      <Badge variant="secondary" className="text-xs">
                        {item.tradeType}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}