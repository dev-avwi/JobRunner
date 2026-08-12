import { useState } from "react";
import { Search, Plus, Tag, Wrench, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { type PriceListItem } from "@shared/schema";

interface PriceListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectItem: (item: PriceListItem, appliedPrice: number) => void;
  tradeType?: string;
  materialMarkupPct?: number;
}

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  service: Wrench,
  material: Package,
  equipment: Tag,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  service: "Service",
  material: "Material",
  equipment: "Equipment",
};

export default function PriceListModal({ open, onOpenChange, onSelectItem, tradeType, materialMarkupPct = 0 }: PriceListModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: priceListItems = [], isLoading } = useQuery<PriceListItem[]>({
    queryKey: ["/api/price-list-items"],
    enabled: open,
  });

  const activeItems = priceListItems.filter(item => item.isActive !== false);

  // Items are relevant to the user's trade if: no trade set on item, item matches user trade, or user has no trade set
  const tradeRelevantItems = tradeType
    ? activeItems.filter(item => !item.tradeType || item.tradeType === tradeType || item.tradeType === "general")
    : activeItems;

  // Items from other trades (shown at the bottom when user has a trade type set)
  const otherTradeItems = tradeType
    ? activeItems.filter(item => item.tradeType && item.tradeType !== tradeType && item.tradeType !== "general")
    : [];

  const allRelevantItems = [...tradeRelevantItems, ...otherTradeItems];

  const filteredItems = allRelevantItems.filter(item => {
    const matchesSearch = searchTerm === "" ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesType = selectedType === "all" || item.itemType === selectedType;
    return matchesSearch && matchesType;
  });

  // Group by category
  const grouped: Record<string, PriceListItem[]> = {};
  filteredItems.forEach(item => {
    const cat = item.category || "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const categoryKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "General") return -1;
    if (b === "General") return 1;
    return a.localeCompare(b);
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);

  const getAppliedPrice = (item: PriceListItem): number => {
    const base = parseFloat(String(item.unitPrice)) || 0;
    if (item.itemType === "material" && materialMarkupPct > 0) {
      return base * (1 + materialMarkupPct / 100);
    }
    return base;
  };

  const handleSelectItem = (item: PriceListItem) => {
    const appliedPrice = getAppliedPrice(item);
    onSelectItem(item, appliedPrice);
    setSearchTerm("");
    setSelectedType("all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-price-list-modal">
        <DialogHeader>
          <DialogTitle>Add from Price List</DialogTitle>
          <DialogDescription>
            Select a saved service or material to add to your line items
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filter Controls */}
        <div className="flex gap-4 p-4 border-b">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search price list..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-price-list-search"
              autoFocus
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40" data-testid="select-price-list-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="service">Services</SelectItem>
              <SelectItem value="material">Materials</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Tag className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">No price list items yet</p>
              <p className="text-sm text-muted-foreground">
                Add services and materials in Settings &rarr; Templates &rarr; Price List
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-muted-foreground mb-2">No items match your filters</div>
              <Button
                variant="outline"
                onClick={() => { setSearchTerm(""); setSelectedType("all"); }}
                data-testid="button-clear-price-list-filters"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {categoryKeys.map(category => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {grouped[category].map(item => {
                      const Icon = ITEM_TYPE_ICONS[item.itemType] || Tag;
                      const appliedPrice = getAppliedPrice(item);
                      const hasMarkup = item.itemType === "material" && materialMarkupPct > 0;
                      return (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleSelectItem(item)}
                          data-testid={`card-price-list-item-${item.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <h4 className="font-medium text-sm truncate">{item.name}</h4>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="shrink-0 h-7 w-7"
                                onClick={e => { e.stopPropagation(); handleSelectItem(item); }}
                                data-testid={`button-add-price-list-item-${item.id}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {item.description && (
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                {item.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {ITEM_TYPE_LABELS[item.itemType] || item.itemType}
                                </Badge>
                                {item.tradeType && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {item.tradeType}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm">{formatCurrency(appliedPrice)}/{item.unit || "each"}</p>
                                {hasMarkup && (
                                  <p className="text-xs text-muted-foreground">
                                    +{materialMarkupPct}% markup
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
