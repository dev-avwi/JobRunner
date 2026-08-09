import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ResultItem {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}

interface CalculatorResultProps {
  title: string;
  results: ResultItem[];
  quoteDescription: string;
  quoteQuantity: number;
  quoteUnit: string;
  suggestedUnitPrice?: number;
}

interface Quote {
  id: string;
  number: string;
  title: string;
  status: string;
  clientId: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
}

export default function CalculatorResult({
  title,
  results,
  quoteDescription,
  quoteQuantity,
  quoteUnit,
  suggestedUnitPrice,
}: CalculatorResultProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showAddToQuoteModal, setShowAddToQuoteModal] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [description, setDescription] = useState(quoteDescription);
  const [quantity, setQuantity] = useState(quoteQuantity.toString());
  const [unitPrice, setUnitPrice] = useState(suggestedUnitPrice?.toString() || "");
  const [addedToQuote, setAddedToQuote] = useState(false);

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
    enabled: showAddToQuoteModal,
  });

  const activeQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent");

  const addItemMutation = useMutation({
    mutationFn: async (data: { quoteId: string; item: { description: string; quantity: string; unitPrice: string } }) => {
      return apiRequest('POST', `/api/quotes/${data.quoteId}/items`, data.item);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', variables.quoteId] });
      setShowAddToQuoteModal(false);
      setAddedToQuote(true);
      toast({
        title: "Added to quote",
        description: "The calculated item has been added to your quote.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to add item",
        description: "Could not add the item to the quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddToQuote = () => {
    if (!selectedQuoteId) {
      toast({
        title: "Select a quote",
        description: "Please select a quote to add this item to.",
        variant: "destructive",
      });
      return;
    }

    addItemMutation.mutate({
      quoteId: selectedQuoteId,
      item: {
        description,
        quantity,
        unitPrice: unitPrice || "0",
      },
    });
  };

  const handleCreateNewQuote = () => {
    navigate('/quotes/new');
  };

  return (
    <>
      <Card className="mt-6" data-testid="card-calculator-result">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              {title}
            </CardTitle>
            {addedToQuote && (
              <Badge variant="outline" className="bg-success/10 text-success">
                Added to Quote
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${result.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}
                data-testid={`result-item-${index}`}
              >
                <p className="text-xs text-muted-foreground mb-1">{result.label}</p>
                <p className={`text-lg font-semibold ${result.highlight ? 'text-primary' : ''}`}>
                  {result.value}
                  {result.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{result.unit}</span>}
                </p>
              </div>
            ))}
          </div>

          <Button
            onClick={() => setShowAddToQuoteModal(true)}
            className="w-full"
            variant="brand"
            data-testid="button-add-to-quote"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add to Quote
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showAddToQuoteModal} onOpenChange={setShowAddToQuoteModal}>
        <DialogContent data-testid="dialog-add-to-quote">
          <DialogHeader>
            <DialogTitle>Add to Quote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Quote</Label>
              {activeQuotes.length > 0 ? (
                <Select value={selectedQuoteId} onValueChange={setSelectedQuoteId}>
                  <SelectTrigger data-testid="select-quote">
                    <SelectValue placeholder="Choose a quote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeQuotes.map((quote) => (
                      <SelectItem key={quote.id} value={quote.id} data-testid={`option-quote-${quote.id}`}>
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {quote.number} - {quote.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-center py-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-3">No active quotes found</p>
                  <Button variant="outline" size="sm" onClick={handleCreateNewQuote}>
                    Create New Quote
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Item description"
                rows={3}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity ({quoteUnit})</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  step="0.01"
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price ($)</Label>
                <Input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="Enter price"
                  step="0.01"
                  data-testid="input-unit-price"
                />
              </div>
            </div>

            {unitPrice && quantity && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Line Total</p>
                <p className="text-lg font-semibold">
                  ${(parseFloat(quantity) * parseFloat(unitPrice || "0")).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToQuoteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddToQuote}
              disabled={!selectedQuoteId || addItemMutation.isPending}
              variant="brand"
              data-testid="button-confirm-add"
            >
              {addItemMutation.isPending ? "Adding..." : "Add to Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
