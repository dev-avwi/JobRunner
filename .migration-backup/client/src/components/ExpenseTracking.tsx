import JobPicker from "@/components/JobPicker";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Calendar as CalendarIcon, DollarSign, Receipt, Plus, Trash2,
  TrendingUp, TrendingDown, Camera, Loader2, Briefcase, Search,
  AlertCircle, ChevronRight, MoreVertical, Tag
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const expenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const expenseSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  jobId: z.string().optional(),
  amount: z.string().min(1, "Amount is required").regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
  gstAmount: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().optional(),
  receiptUrl: z.string().optional(),
  receiptNumber: z.string().optional(),
  expenseDate: z.date(),
  isBillable: z.boolean().default(true),
});

type ExpenseCategoryForm = z.infer<typeof expenseCategorySchema>;
type ExpenseForm = z.infer<typeof expenseSchema>;

export function ExpenseTracking() {
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedJob, setSelectedJob] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedReceiptUrl, setScannedReceiptUrl] = useState<string | null>(null);
  const [preselectedJobId, setPreselectedJobId] = useState<string | undefined>();
  const { toast } = useToast();

  const handleScanReceipt = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsScanning(true);
      setShowExpenseDialog(true);

      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          setScannedReceiptUrl(base64);

          try {
            const response = await apiRequest("POST", "/api/expenses/scan-receipt", {
              image: base64,
            });

            const result = await response.json();

            if (result.total) {
              const totalStr = String(result.total);
              expenseForm.setValue("amount", totalStr);
              const gst = result.gst ? String(result.gst) : (parseFloat(totalStr) * 0.1).toFixed(2);
              expenseForm.setValue("gstAmount", gst);
            }
            if (result.vendor) {
              expenseForm.setValue("vendor", result.vendor);
            }
            if (result.lineItems && result.lineItems.length > 0) {
              const desc = result.lineItems.map((item: any) => item.description).filter(Boolean).join(", ");
              if (desc) {
                expenseForm.setValue("description", desc);
              }
            }
            if (result.date) {
              expenseForm.setValue("expenseDate", new Date(result.date));
            }
            expenseForm.setValue("receiptUrl", base64);

            toast({ title: "Receipt scanned", description: "Fields pre-filled from receipt. Review and save." });
          } catch (err: any) {
            toast({ title: "Scan failed", description: err.message || "Could not read receipt. Fill in manually.", variant: "destructive" });
          } finally {
            setIsScanning(false);
          }
        };
        reader.readAsDataURL(file);
      } catch {
        setIsScanning(false);
        toast({ title: "Error", description: "Failed to read file", variant: "destructive" });
      }
    };
    input.click();
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/expense-categories"],
  }) as { data: any[] };

  const { data: expenses = [] } = useQuery({
    queryKey: ["/api/expenses", selectedCategory, selectedJob],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.append('categoryId', selectedCategory);
      if (selectedJob && selectedJob !== 'all') params.append('jobId', selectedJob);
      const res = await apiRequest('GET', `/api/expenses?${params.toString()}`);
      return res.json();
    },
  }) as { data: any[] };

  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  }) as { data: any[] };

  const { data: expenseReport } = useQuery({
    queryKey: ["/api/reports/expenses", selectedPeriod],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/reports/expenses?period=${selectedPeriod}&groupBy=category`);
      return res.json();
    },
  }) as { data: any };

  const categoryForm = useForm<ExpenseCategoryForm>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      categoryId: "",
      jobId: undefined,
      amount: "",
      gstAmount: "",
      description: "",
      vendor: "",
      receiptUrl: "",
      receiptNumber: "",
      expenseDate: new Date(),
      isBillable: true,
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: ExpenseCategoryForm) => apiRequest("POST", "/api/expense-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"], exact: false });
      setShowCategoryDialog(false);
      categoryForm.reset();
      toast({ title: "Success", description: "Expense category created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseForm) => apiRequest("POST", "/api/expenses", {
      ...data,
      expenseDate: data.expenseDate.toISOString(),
      amount: data.amount,
      gstAmount: data.gstAmount || "0.00",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/expenses"], exact: false });
      setShowExpenseDialog(false);
      setScannedReceiptUrl(null);
      setPreselectedJobId(undefined);
      expenseForm.reset();
      toast({ title: "Success", description: "Expense recorded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record expense", variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/expenses"], exact: false });
      toast({ title: "Success", description: "Expense deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete expense", variant: "destructive" });
    },
  });

  const handleAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    const gstAmount = (amount * 0.1).toFixed(2);
    expenseForm.setValue("gstAmount", gstAmount);
  };

  const openExpenseDialogForJob = (jobId: string) => {
    setPreselectedJobId(jobId);
    expenseForm.reset();
    expenseForm.setValue("jobId", jobId);
    expenseForm.setValue("expenseDate", new Date());
    setShowExpenseDialog(true);
  };

  const totalExpenses = Array.isArray(expenses) ? expenses.reduce((sum: number, expense: any) => sum + parseFloat(expense.amount || "0"), 0) : 0;
  const monthlyTotal = expenseReport?.summary?.totalAmount || 0;
  const monthlyCount = expenseReport?.summary?.totalExpenses || 0;

  const activeJobs = Array.isArray(jobs)
    ? jobs.filter((j: any) => j.status === 'in_progress' || j.status === 'scheduled' || j.status === 'pending')
    : [];

  const jobExpenseCounts: Record<string, { count: number; total: number }> = {};
  if (Array.isArray(expenses)) {
    expenses.forEach((exp: any) => {
      if (exp.jobId) {
        if (!jobExpenseCounts[exp.jobId]) jobExpenseCounts[exp.jobId] = { count: 0, total: 0 };
        jobExpenseCounts[exp.jobId].count += 1;
        jobExpenseCounts[exp.jobId].total += parseFloat(exp.amount || "0");
      }
    });
  }

  const filteredExpenses = Array.isArray(expenses) ? expenses.filter((exp: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (exp.description && exp.description.toLowerCase().includes(q)) ||
      (exp.vendor && exp.vendor.toLowerCase().includes(q)) ||
      (exp.categoryName && exp.categoryName.toLowerCase().includes(q)) ||
      (exp.jobTitle && exp.jobTitle.toLowerCase().includes(q))
    );
  }) : [];

  const groupExpensesByDate = (exps: any[]) => {
    const groups: Record<string, any[]> = {};
    exps.forEach((exp) => {
      const dateKey = format(new Date(exp.expenseDate), "d MMM yyyy");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(exp);
    });
    return Object.entries(groups).sort(([a], [b]) =>
      new Date(b).getTime() - new Date(a).getTime()
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track costs across all your jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanReceipt}
            disabled={isScanning}
            data-testid="button-scan-receipt"
          >
            <Camera className="h-4 w-4 mr-1.5" />
            Scan Receipt
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setPreselectedJobId(undefined);
              expenseForm.reset();
              expenseForm.setValue("expenseDate", new Date());
              setShowExpenseDialog(true);
            }}
            data-testid="button-add-expense"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Record Expense
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Overview</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl md:text-4xl font-bold" data-testid="text-total-expenses">
              ${totalExpenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-muted-foreground">total recorded</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded-full bg-green-500/15 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                </div>
                <span className="text-xs text-muted-foreground">This Month</span>
              </div>
              <p className="text-lg font-bold" data-testid="text-monthly-expenses">
                ${monthlyTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{monthlyCount} expense{monthlyCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Tag className="h-3 w-3 text-blue-500" />
                </div>
                <span className="text-xs text-muted-foreground">Categories</span>
              </div>
              <p className="text-lg font-bold" data-testid="text-category-count">
                {Array.isArray(categories) ? categories.length : 0}
              </p>
              <p className="text-xs text-muted-foreground">tracking</p>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded-full bg-amber-500/15 flex items-center justify-center">
                  <Briefcase className="h-3 w-3 text-amber-500" />
                </div>
                <span className="text-xs text-muted-foreground">Active Jobs</span>
              </div>
              <p className="text-lg font-bold">{activeJobs.length}</p>
              <p className="text-xs text-muted-foreground">with costs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">By Job</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-expenses"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]" data-testid="filter-category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {Array.isArray(categories) && categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger className="w-[150px]" data-testid="filter-job">
                  <SelectValue placeholder="Job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All jobs</SelectItem>
                  {Array.isArray(jobs) && jobs.map((job: any) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(selectedCategory || selectedJob) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSelectedCategory(undefined); setSelectedJob(undefined); }}
                  data-testid="button-clear-filters"
                  title="Clear filters"
                >
                  <AlertCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
          </p>

          {filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">No expenses yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Record your first expense or scan a receipt to get started
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleScanReceipt}>
                    <Camera className="h-4 w-4 mr-1.5" />
                    Scan Receipt
                  </Button>
                  <Button size="sm" onClick={() => { expenseForm.reset(); expenseForm.setValue("expenseDate", new Date()); setShowExpenseDialog(true); }}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Record Expense
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupExpensesByDate(filteredExpenses).map(([dateLabel, dateExpenses]) => (
                <div key={dateLabel}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{dateLabel}</p>
                  <Card>
                    <CardContent className="p-0 divide-y">
                      {dateExpenses.map((expense: any) => (
                        <div
                          key={expense.id}
                          className="flex items-center gap-3 p-3 md:p-4 hover-elevate"
                          data-testid={`expense-${expense.id}`}
                        >
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{expense.description}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {expense.vendor && (
                                <span className="text-xs text-muted-foreground">{expense.vendor}</span>
                              )}
                              {expense.categoryName && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{expense.categoryName}</Badge>
                              )}
                              {expense.jobTitle && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{expense.jobTitle}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">
                              ${parseFloat(expense.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </p>
                            {expense.gstAmount && expense.gstAmount !== "0.00" && (
                              <p className="text-[10px] text-muted-foreground">
                                incl. ${parseFloat(expense.gstAmount).toFixed(2)} GST
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteExpenseMutation.mutate(expense.id)}
                                disabled={deleteExpenseMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Jobs — tap to log an expense
          </p>
          {activeJobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">No active jobs</p>
                <p className="text-sm text-muted-foreground">
                  Jobs that are in progress or scheduled will appear here so you can quickly log expenses against them
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {activeJobs.map((job: any) => {
                  const stats = jobExpenseCounts[job.id];
                  return (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-3 md:p-4 hover-elevate cursor-pointer"
                      onClick={() => openExpenseDialogForJob(job.id)}
                      data-testid={`job-expense-${job.id}`}
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{job.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {job.clientName && (
                            <span className="text-xs text-muted-foreground">{job.clientName}</span>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {job.status === 'in_progress' ? 'In Progress' : job.status === 'scheduled' ? 'Scheduled' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0 mr-1">
                        {stats ? (
                          <>
                            <p className="font-semibold text-sm">
                              ${stats.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{stats.count} expense{stats.count !== 1 ? 's' : ''}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">No expenses</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {Array.isArray(jobs) && jobs.filter((j: any) => j.status === 'completed').length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-6">
                Completed Jobs
              </p>
              <Card>
                <CardContent className="p-0 divide-y">
                  {jobs.filter((j: any) => j.status === 'completed').slice(0, 5).map((job: any) => {
                    const stats = jobExpenseCounts[job.id];
                    return (
                      <div
                        key={job.id}
                        className="flex items-center gap-3 p-3 md:p-4 hover-elevate cursor-pointer opacity-75"
                        onClick={() => openExpenseDialogForJob(job.id)}
                      >
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{job.title}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Completed</Badge>
                        </div>
                        <div className="text-right shrink-0 mr-1">
                          {stats ? (
                            <p className="font-semibold text-sm">
                              ${stats.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">--</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spending Breakdown</p>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px]" data-testid="select-report-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-4 md:p-6">
              {expenseReport && expenseReport.summary ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl md:text-3xl font-bold">
                        ${(expenseReport.summary.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total Spent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl md:text-3xl font-bold">{expenseReport.summary.totalExpenses || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">Transactions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl md:text-3xl font-bold">
                        ${(expenseReport.summary.averageExpense || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Average</p>
                    </div>
                  </div>

                  {expenseReport.grouped && Object.keys(expenseReport.grouped).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">By Category</p>
                      <div className="space-y-2">
                        {Object.entries(expenseReport.grouped).map(([category, data]: [string, any]) => {
                          const pct = expenseReport.summary.totalAmount > 0
                            ? ((data.total || 0) / expenseReport.summary.totalAmount) * 100
                            : 0;
                          return (
                            <div key={category} className="flex items-center gap-3 p-3 rounded-md border">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-sm">{category}</p>
                                  <p className="font-semibold text-sm">
                                    ${(data.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary rounded-full h-1.5 transition-all"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-[10px] text-muted-foreground">{data.count || 0} expense{(data.count || 0) !== 1 ? 's' : ''}</p>
                                  <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium mb-1">No data for this period</p>
                  <p className="text-sm text-muted-foreground">Record some expenses and check back</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {Array.isArray(categories) ? categories.length : 0} categor{(Array.isArray(categories) ? categories.length : 0) === 1 ? 'y' : 'ies'}
            </p>
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-category">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Expense Category</DialogTitle>
                  <DialogDescription>
                    Add a new category to organize your expenses
                  </DialogDescription>
                </DialogHeader>
                <Form {...categoryForm}>
                  <form onSubmit={categoryForm.handleSubmit((data) => createCategoryMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={categoryForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Materials, Fuel, Tools" {...field} data-testid="input-category-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={categoryForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe what this category covers..." {...field} data-testid="input-category-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setShowCategoryDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createCategoryMutation.isPending} data-testid="button-save-category">
                        {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {!Array.isArray(categories) || categories.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Tag className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">No categories yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up categories like Materials, Fuel, Tools, Subcontractors
                </p>
                <Button size="sm" onClick={() => setShowCategoryDialog(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Category
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {categories.map((category: any) => (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 p-3 md:p-4 hover-elevate"
                    data-testid={`category-${category.id}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{category.name}</p>
                      {category.description && (
                        <p className="text-xs text-muted-foreground truncate">{category.description}</p>
                      )}
                    </div>
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showExpenseDialog} onOpenChange={(open) => {
        setShowExpenseDialog(open);
        if (!open) {
          setScannedReceiptUrl(null);
          setIsScanning(false);
          setPreselectedJobId(undefined);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>
              {preselectedJobId
                ? `Adding expense for: ${jobs.find((j: any) => j.id === preselectedJobId)?.title || 'Job'}`
                : 'Add a business expense'}
            </DialogDescription>
          </DialogHeader>
          {isScanning && (
            <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Reading receipt...</p>
                <p className="text-xs text-muted-foreground">AI is extracting details from your receipt</p>
              </div>
            </div>
          )}
          {scannedReceiptUrl && !isScanning && (
            <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
              <img src={scannedReceiptUrl} alt="Scanned receipt" className="h-12 w-12 rounded-md object-cover" />
              <div>
                <p className="text-sm font-medium">Receipt attached</p>
                <p className="text-xs text-muted-foreground">Review the pre-filled fields below</p>
              </div>
            </div>
          )}
          <Form {...expenseForm}>
            <form onSubmit={expenseForm.handleSubmit((data) => createExpenseMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={expenseForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(categories) && categories.length > 0 ? (
                            categories.map((category: any) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-2 text-sm text-muted-foreground">
                              No categories — create one first
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job (Optional)</FormLabel>
                      <FormControl>
                        <JobPicker
                          value={field.value === "none" ? "" : (field.value || "")}
                          onChange={(jobId) => field.onChange(jobId || "none")}
                          label={null}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={expenseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="What was this expense for?" {...field} data-testid="input-expense-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={expenseForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (AUD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleAmountChange(e.target.value);
                          }}
                          data-testid="input-expense-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="gstAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-expense-gst" readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Bunnings" {...field} data-testid="input-expense-vendor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={expenseForm.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full pl-3 text-left font-normal"
                              data-testid="button-expense-date"
                            >
                              {field.value ? format(field.value, "dd MMM yyyy") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={expenseForm.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt #</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} data-testid="input-expense-receipt" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {!scannedReceiptUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                  data-testid="button-scan-receipt-inline"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {isScanning ? "Reading receipt..." : "Scan Receipt to Auto-Fill"}
                </Button>
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowExpenseDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createExpenseMutation.isPending} data-testid="button-save-expense">
                  {createExpenseMutation.isPending ? "Recording..." : "Record Expense"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
