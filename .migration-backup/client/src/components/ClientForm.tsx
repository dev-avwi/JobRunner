import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  CheckCircle2,
  Lightbulb,
  Loader2,
  ArrowRight
} from "lucide-react";
import AddressAutocomplete from "@/components/ui/address-autocomplete";

const phoneRegex = /^(\+?61|0)[2-478]\d{8}$|^(\+?61|0)4\d{8}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clientFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string()
    .optional()
    .refine(val => !val || emailRegex.test(val), "Please enter a valid email address"),
  phone: z.string()
    .optional()
    .refine(val => !val || phoneRegex.test(val.replace(/\s/g, '')), "Please enter a valid Australian phone number (e.g., 0412 345 678)"),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  onSubmit?: (clientId: string) => void;
  onCancel?: () => void;
}

export default function ClientForm({ onSubmit, onCancel }: ClientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  const watchedName = form.watch("name");
  const watchedEmail = form.watch("email");
  const watchedPhone = form.watch("phone");

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return await response.json() as { id: string; name: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client Added",
        description: `${data.name} has been added to your clients. You can now create quotes and jobs for them.`,
      });
      if (onSubmit) onSubmit(data.id);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: ClientFormData) => {
    if (data.address && !addressConfirmed) {
      toast({ title: "Please select an address", description: "Tap an address from the suggestions to confirm it", variant: "destructive" });
      return;
    }
    await createClientMutation.mutateAsync(data);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 4) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 4)} ${numbers.slice(4)}`;
    return `${numbers.slice(0, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7, 10)}`;
  };

  return (
    <PageShell data-testid="page-client-form">
      <PageHeader
        title="Add New Client"
        subtitle="Save client details for quick quoting and invoicing"
        action={
          <Button variant="outline" onClick={onCancel} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        }
      />

      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20 lg:hidden mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">What Happens Next</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-background rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1 text-xs font-bold">1</div>
              <p className="text-[10px] text-muted-foreground">Client saved</p>
            </div>
            <div className="p-2 bg-background rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1 text-xs font-bold">2</div>
              <p className="text-[10px] text-muted-foreground">Auto-fill quotes</p>
            </div>
            <div className="p-2 bg-background rounded-lg">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1 text-xs font-bold">3</div>
              <p className="text-[10px] text-muted-foreground">Track history</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Client Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Client Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g., John Smith or ABC Constructions"
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          This name will appear on quotes and invoices
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Email Address
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              placeholder="client@example.com"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            For sending quotes and invoices directly
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              placeholder="0412 345 678"
                              onChange={(e) => field.onChange(formatPhone(e.target.value))}
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            For SMS reminders and quick calls
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Job Site Address
                        </FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ''}
                            onChange={field.onChange}
                            onConfirmedChange={(confirmed) => setAddressConfirmed(confirmed)}
                            placeholder="Start typing an address..."
                            data-testid="input-address"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Auto-fills when creating jobs - tap to open in Maps
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Notes
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Any helpful info about this client (e.g., access codes, parking, preferences)"
                            className="min-h-[80px]"
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Private notes only you can see
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={createClientMutation.isPending}
                  className="flex-1 text-white"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  data-testid="button-save"
                >
                  {createClientMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding Client...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Add Client
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                What Happens Next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">Client is saved</p>
                  <p className="text-xs text-muted-foreground">
                    Details stored securely in your account
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">Create quotes fast</p>
                  <p className="text-xs text-muted-foreground">
                    Client details auto-fill on new quotes
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">Track job history</p>
                  <p className="text-xs text-muted-foreground">
                    See all jobs, quotes, and invoices for this client
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {watchedName && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: 'hsl(var(--trade))' }}
                    >
                      {watchedName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{watchedName || "Client Name"}</p>
                      {watchedEmail && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {watchedEmail}
                        </p>
                      )}
                    </div>
                  </div>
                  {watchedPhone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {watchedPhone}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  How this client will appear in your list
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Your data is secure</p>
                  <p>Client details are encrypted and stored in Australia. Only you can access them.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
