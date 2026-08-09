import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Star, Sparkles, Package, DollarSign, Check, ChevronDown, ChevronUp, Copy, GripVertical } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuoteLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  optionId?: string;
}

interface QuoteOption {
  id?: string;
  name: string;
  description?: string;
  items: QuoteLineItem[];
  subtotal: number;
  gstAmount: number;
  total: number;
  isRecommended: boolean;
  sortOrder: number;
}

interface MultiOptionQuoteEditorProps {
  quoteId?: string;
  onSave?: (options: QuoteOption[]) => void;
  initialOptions?: QuoteOption[];
  className?: string;
}

const GST_RATE = 0.10;

export function MultiOptionQuoteEditor({ quoteId, onSave, initialOptions, className }: MultiOptionQuoteEditorProps) {
  const { toast } = useToast();
  const [options, setOptions] = useState<QuoteOption[]>(initialOptions || []);
  const [activeTab, setActiveTab] = useState('0');
  const [isMultiOption, setIsMultiOption] = useState(initialOptions ? initialOptions.length > 1 : false);

  // Initialize with a default option if none exist
  useEffect(() => {
    if (options.length === 0) {
      setOptions([createEmptyOption('Standard Quote', 0)]);
    }
  }, []);

  const createEmptyOption = (name: string, sortOrder: number): QuoteOption => ({
    name,
    description: '',
    items: [],
    subtotal: 0,
    gstAmount: 0,
    total: 0,
    isRecommended: sortOrder === 0,
    sortOrder
  });

  const createEmptyLineItem = (): QuoteLineItem => ({
    description: '',
    quantity: 1,
    unitPrice: 0,
    total: 0
  });

  const calculateOptionTotals = (items: QuoteLineItem[]): { subtotal: number; gstAmount: number; total: number } => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const gstAmount = subtotal * GST_RATE;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const addOption = () => {
    const newOption = createEmptyOption(`Option ${options.length + 1}`, options.length);
    setOptions([...options, newOption]);
    setActiveTab(String(options.length));
    setIsMultiOption(true);
  };

  const removeOption = (index: number) => {
    if (options.length <= 1) {
      toast({ title: "Cannot remove", description: "At least one option is required", variant: "destructive" });
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (parseInt(activeTab) >= index) {
      setActiveTab(String(Math.max(0, parseInt(activeTab) - 1)));
    }
    if (newOptions.length <= 1) {
      setIsMultiOption(false);
    }
  };

  const duplicateOption = (index: number) => {
    const original = options[index];
    const duplicate: QuoteOption = {
      ...original,
      id: undefined,
      name: `${original.name} (Copy)`,
      isRecommended: false,
      sortOrder: options.length,
      items: original.items.map(item => ({ ...item, id: undefined }))
    };
    setOptions([...options, duplicate]);
    setActiveTab(String(options.length));
  };

  const updateOption = (index: number, updates: Partial<QuoteOption>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    setOptions(newOptions);
  };

  const setRecommended = (index: number) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      isRecommended: i === index
    }));
    setOptions(newOptions);
  };

  const addLineItem = (optionIndex: number) => {
    const option = options[optionIndex];
    const newItems = [...option.items, createEmptyLineItem()];
    const totals = calculateOptionTotals(newItems);
    updateOption(optionIndex, { items: newItems, ...totals });
  };

  const updateLineItem = (optionIndex: number, itemIndex: number, updates: Partial<QuoteLineItem>) => {
    const option = options[optionIndex];
    const newItems = [...option.items];
    newItems[itemIndex] = { ...newItems[itemIndex], ...updates };
    
    // Recalculate item total
    const item = newItems[itemIndex];
    item.total = item.quantity * item.unitPrice;
    
    const totals = calculateOptionTotals(newItems);
    updateOption(optionIndex, { items: newItems, ...totals });
  };

  const removeLineItem = (optionIndex: number, itemIndex: number) => {
    const option = options[optionIndex];
    const newItems = option.items.filter((_, i) => i !== itemIndex);
    const totals = calculateOptionTotals(newItems);
    updateOption(optionIndex, { items: newItems, ...totals });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(options);
    }
    toast({ title: "Options saved", description: `${options.length} option(s) saved successfully` });
  };

  return (
    <Card className={cn("border-2", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Package className="h-4 w-4" />
            </div>
            Quote Options
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch 
                id="multi-option"
                checked={isMultiOption}
                onCheckedChange={(checked) => {
                  setIsMultiOption(checked);
                  if (checked && options.length === 1) {
                    addOption();
                  }
                }}
                data-testid="switch-multi-option"
              />
              <Label htmlFor="multi-option" className="text-sm">Multi-option</Label>
            </div>
            {isMultiOption && (
              <Button variant="outline" size="sm" onClick={addOption} data-testid="button-add-option">
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isMultiOption ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex overflow-x-auto">
              {options.map((option, index) => (
                <TabsTrigger 
                  key={index} 
                  value={String(index)}
                  className="flex items-center gap-2 min-w-fit"
                  data-testid={`tab-option-${index}`}
                >
                  {option.isRecommended && <Star className="h-3 w-3 text-amber-500" />}
                  {option.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {options.map((option, optionIndex) => (
              <TabsContent key={optionIndex} value={String(optionIndex)} className="mt-4 space-y-4">
                <OptionEditor
                  option={option}
                  optionIndex={optionIndex}
                  totalOptions={options.length}
                  onUpdateOption={(updates) => updateOption(optionIndex, updates)}
                  onAddLineItem={() => addLineItem(optionIndex)}
                  onUpdateLineItem={(itemIndex, updates) => updateLineItem(optionIndex, itemIndex, updates)}
                  onRemoveLineItem={(itemIndex) => removeLineItem(optionIndex, itemIndex)}
                  onSetRecommended={() => setRecommended(optionIndex)}
                  onDuplicate={() => duplicateOption(optionIndex)}
                  onRemove={() => removeOption(optionIndex)}
                  formatCurrency={formatCurrency}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <OptionEditor
            option={options[0]}
            optionIndex={0}
            totalOptions={1}
            onUpdateOption={(updates) => updateOption(0, updates)}
            onAddLineItem={() => addLineItem(0)}
            onUpdateLineItem={(itemIndex, updates) => updateLineItem(0, itemIndex, updates)}
            onRemoveLineItem={(itemIndex) => removeLineItem(0, itemIndex)}
            onSetRecommended={() => {}}
            onDuplicate={() => {}}
            onRemove={() => {}}
            formatCurrency={formatCurrency}
            showHeader={false}
          />
        )}

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button onClick={handleSave} data-testid="button-save-options">
            <Check className="h-4 w-4 mr-2" />
            Save Options
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface OptionEditorProps {
  option: QuoteOption;
  optionIndex: number;
  totalOptions: number;
  onUpdateOption: (updates: Partial<QuoteOption>) => void;
  onAddLineItem: () => void;
  onUpdateLineItem: (itemIndex: number, updates: Partial<QuoteLineItem>) => void;
  onRemoveLineItem: (itemIndex: number) => void;
  onSetRecommended: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  formatCurrency: (amount: number) => string;
  showHeader?: boolean;
}

function OptionEditor({
  option,
  optionIndex,
  totalOptions,
  onUpdateOption,
  onAddLineItem,
  onUpdateLineItem,
  onRemoveLineItem,
  onSetRecommended,
  onDuplicate,
  onRemove,
  formatCurrency,
  showHeader = true
}: OptionEditorProps) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label>Option Name</Label>
            <Input
              value={option.name}
              onChange={(e) => onUpdateOption({ name: e.target.value })}
              placeholder="e.g., Basic Package"
              className="mt-1"
              data-testid={`input-option-name-${optionIndex}`}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label>Description (optional)</Label>
            <Input
              value={option.description || ''}
              onChange={(e) => onUpdateOption({ description: e.target.value })}
              placeholder="Brief description of this option"
              className="mt-1"
              data-testid={`input-option-description-${optionIndex}`}
            />
          </div>
          <div className="flex gap-2 pt-6">
            <Button
              variant={option.isRecommended ? "default" : "outline"}
              size="sm"
              onClick={onSetRecommended}
              className={option.isRecommended ? "bg-amber-500 hover:bg-amber-600" : ""}
              data-testid={`button-set-recommended-${optionIndex}`}
            >
              <Star className="h-4 w-4 mr-1" />
              {option.isRecommended ? 'Recommended' : 'Set Recommended'}
            </Button>
            <Button variant="outline" size="sm" onClick={onDuplicate} data-testid={`button-duplicate-${optionIndex}`}>
              <Copy className="h-4 w-4" />
            </Button>
            {totalOptions > 1 && (
              <Button variant="outline" size="sm" onClick={onRemove} className="text-destructive" data-testid={`button-remove-option-${optionIndex}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Line Items</Label>
          <Button variant="outline" size="sm" onClick={onAddLineItem} data-testid={`button-add-line-item-${optionIndex}`}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>

        {option.items.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Package className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">No items yet. Click "Add Item" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>
            
            {option.items.map((item, itemIndex) => (
              <div 
                key={itemIndex}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border bg-card"
                data-testid={`line-item-${optionIndex}-${itemIndex}`}
              >
                <div className="col-span-5">
                  <Input
                    value={item.description}
                    onChange={(e) => onUpdateLineItem(itemIndex, { description: e.target.value })}
                    placeholder="Item description"
                    className="h-9"
                    data-testid={`input-item-description-${optionIndex}-${itemIndex}`}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onUpdateLineItem(itemIndex, { quantity: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="1"
                    className="h-9 text-center"
                    data-testid={`input-item-quantity-${optionIndex}-${itemIndex}`}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => onUpdateLineItem(itemIndex, { unitPrice: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    className="h-9 text-right"
                    data-testid={`input-item-price-${optionIndex}-${itemIndex}`}
                  />
                </div>
                <div className="col-span-2 text-right font-medium text-sm">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveLineItem(itemIndex)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    data-testid={`button-remove-item-${optionIndex}-${itemIndex}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(option.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">GST (10%)</span>
          <span className="font-medium">{formatCurrency(option.gstAmount)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(option.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default MultiOptionQuoteEditor;
