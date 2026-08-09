import { useTradeContext } from "@/hooks/useTradeContext";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type UseFormReturn, Controller } from "react-hook-form";
import { Settings2 } from "lucide-react";

interface TradeCustomFieldsFormProps {
  form: UseFormReturn<any>;
  fieldPrefix?: string;
  showHeader?: boolean;
}

export default function TradeCustomFieldsForm({ 
  form, 
  fieldPrefix = "customFields",
  showHeader = true
}: TradeCustomFieldsFormProps) {
  const { customFields, trade, terminology } = useTradeContext();

  if (!customFields || customFields.length === 0) {
    return null;
  }

  const renderField = (field: typeof customFields[0]) => {
    const fieldName = `${fieldPrefix}.${field.id}`;
    // Use 'name' property from catalog (not 'label')
    const fieldLabel = field.name;
    
    switch (field.type) {
      case 'select':
        return (
          <Controller
            key={field.id}
            control={form.control}
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {fieldLabel}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <Select 
                  onValueChange={formField.onChange} 
                  value={formField.value || ""}
                >
                  <FormControl>
                    <SelectTrigger data-testid={`select-${field.id}`}>
                      <SelectValue placeholder={field.placeholder || `Select ${fieldLabel.toLowerCase()}`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'number':
        return (
          <Controller
            key={field.id}
            control={form.control}
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {fieldLabel}
                  {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={field.placeholder || `Enter ${fieldLabel.toLowerCase()}`}
                    {...formField}
                    onChange={(e) => formField.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    value={formField.value ?? ""}
                    data-testid={`input-${field.id}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'checkbox':
        // Catalog uses 'checkbox' type for boolean/toggle fields
        return (
          <Controller
            key={field.id}
            control={form.control}
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>{fieldLabel}</FormLabel>
                  {field.placeholder && (
                    <FormDescription className="text-xs">{field.placeholder}</FormDescription>
                  )}
                </div>
                <FormControl>
                  <Switch
                    checked={formField.value ?? false}
                    onCheckedChange={formField.onChange}
                    data-testid={`switch-${field.id}`}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        );

      case 'date':
        return (
          <Controller
            key={field.id}
            control={form.control}
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {fieldLabel}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    placeholder={field.placeholder || `Select ${fieldLabel.toLowerCase()}`}
                    {...formField}
                    value={formField.value ?? ""}
                    data-testid={`input-${field.id}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      
      case 'text':
      default:
        return (
          <Controller
            key={field.id}
            control={form.control}
            name={fieldName}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>
                  {fieldLabel}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder={field.placeholder || `Enter ${fieldLabel.toLowerCase()}`}
                    {...formField}
                    value={formField.value ?? ""}
                    data-testid={`input-${field.id}`}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  const content = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {customFields.map(renderField)}
    </div>
  );

  if (!showHeader) {
    return content;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          {`${trade?.name || 'Trade'} Details`}
          {trade && (
            <Badge variant="secondary" className="text-xs font-normal">
              {customFields.length} field{customFields.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

export function getCustomFieldsDefaultValues(customFields: { id: string; type: string; defaultValue?: any }[]) {
  const defaults: Record<string, any> = {};
  
  for (const field of customFields) {
    if (field.defaultValue !== undefined) {
      defaults[field.id] = field.defaultValue;
    } else {
      switch (field.type) {
        case 'checkbox':
          defaults[field.id] = false;
          break;
        case 'number':
          defaults[field.id] = undefined;
          break;
        default:
          defaults[field.id] = "";
      }
    }
  }
  
  return defaults;
}
