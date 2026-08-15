import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  AlertTriangle,
  Package,
  PackageOpen,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Tag,
  ShoppingCart,
  History,
  ChevronLeft,
  Wrench,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Briefcase,
  BarChart3,
  Gauge,
  Route,
  ChevronDown,
  Send,
  Mail,
  X,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type {
  InventoryItem,
  InventoryCategory,
  InventoryTransaction,
  Supplier,
  PurchaseOrder,
  Equipment,
  EquipmentCategory,
  EquipmentMaintenance,
} from "@shared/schema";

type Section = "stock" | "equipment";
type StockTab = "items" | "categories" | "low-stock" | "purchase-orders";
type EquipmentTab = "all" | "available" | "in_use" | "maintenance" | "utilisation";
type SortField = "name" | "currentStock" | "costPrice" | "sellPrice";
type SortDir = "asc" | "desc";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-primary/10 text-primary",
  sent: "bg-info/10 text-info",
  partial: "bg-primary/10 text-primary",
  received: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const equipmentStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Available", className: "bg-success/10 text-success" },
  available: { label: "Available", className: "bg-success/10 text-success" },
  in_use: { label: "In Use", className: "bg-primary/10 text-primary" },
  maintenance: { label: "Maintenance", className: "bg-warning/10 text-warning" },
  retired: { label: "Retired", className: "bg-muted text-muted-foreground" },
  sold: { label: "Sold", className: "bg-muted text-muted-foreground" },
};

function formatAUD(value: string | number | null | undefined): string {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num);
}

function EquipmentStatusBadge({ status }: { status: string }) {
  const config = equipmentStatusConfig[status] || equipmentStatusConfig.active;
  return <Badge variant="secondary" className={config.className}>{config.label}</Badge>;
}

export default function InventoryPage({ initialSection }: { initialSection?: Section }) {
  const [section, setSection] = useState<Section>(initialSection || "stock");
  const [location] = useLocation();

  useEffect(() => {
    if (location === "/equipment") {
      setSection("equipment");
    }
  }, [location]);

  return (
    <PageShell>
      <PageHeader
        title="Inventory & Equipment"
        subtitle="Manage stock, materials, tools, and assets"
        leading={<PackageOpen className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
      />

      <div className="feed-card overflow-x-auto no-scrollbar mb-4">
        <div className="p-1.5">
          <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="stock" className="gap-1.5">
                <Package className="h-4 w-4" />
                Stock & Materials
              </TabsTrigger>
              <TabsTrigger value="equipment" className="gap-1.5">
                <Wrench className="h-4 w-4" />
                Equipment & Assets
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {section === "stock" ? <StockSection /> : <EquipmentSection />}
    </PageShell>
  );
}

function StockSection() {
  const [activeTab, setActiveTab] = useState<StockTab>("items");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);

  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const [showPODialog, setShowPODialog] = useState(false);

  const { toast } = useToast();

  const { data: items = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/inventory/categories"],
  });

  const { data: lowStockItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/low-stock"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: transactions = [] } = useQuery<InventoryTransaction[]>({
    queryKey: ["/api/inventory/items", selectedItem?.id, "transactions"],
    enabled: !!selectedItem,
  });

  const createItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inventory/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setShowItemDialog(false);
      setEditingItem(null);
      toast({ title: "Item created" });
    },
    onError: () => toast({ title: "Failed to create item", variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/inventory/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setShowItemDialog(false);
      setEditingItem(null);
      toast({ title: "Item updated" });
    },
    onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      setSelectedItem(null);
      toast({ title: "Item deleted" });
    },
    onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inventory/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      setShowCategoryDialog(false);
      setEditingCategory(null);
      toast({ title: "Category created" });
    },
    onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
  });

  const createTransactionMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      apiRequest("POST", `/api/inventory/items/${itemId}/transactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      if (selectedItem) {
        queryClient.invalidateQueries({
          queryKey: ["/api/inventory/items", selectedItem.id, "transactions"],
        });
      }
      setShowAdjustDialog(false);
      setAdjustItem(null);
      toast({ title: "Stock adjusted" });
    },
    onError: () => toast({ title: "Failed to adjust stock", variant: "destructive" }),
  });

  const createPOMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/purchase-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setShowPODialog(false);
      toast({ title: "Purchase order created" });
    },
    onError: () => toast({ title: "Failed to create purchase order", variant: "destructive" }),
  });

  const updatePOStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/purchase-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase order updated" });
    },
    onError: () => toast({ title: "Failed to update purchase order", variant: "destructive" }),
  });

  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        categoryFilter === "all" || item.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "currentStock")
        cmp = (a.currentStock ?? 0) - (b.currentStock ?? 0);
      else if (sortField === "costPrice")
        cmp = parseFloat(a.costPrice || "0") - parseFloat(b.costPrice || "0");
      else if (sortField === "sellPrice")
        cmp = parseFloat(a.sellPrice || "0") - parseFloat(b.sellPrice || "0");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    return categories.find((c) => c.id === categoryId)?.name || "Unknown";
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId) return "N/A";
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  if (selectedItem) {
    return (
      <>
        <ItemDetailView
          item={selectedItem}
          transactions={transactions}
          getCategoryName={getCategoryName}
          getSupplierName={getSupplierName}
          onBack={() => setSelectedItem(null)}
          onEdit={() => {
            setEditingItem(selectedItem);
            setShowItemDialog(true);
          }}
          onDelete={() => deleteItemMutation.mutate(selectedItem.id)}
          onAdjust={() => {
            setAdjustItem(selectedItem);
            setShowAdjustDialog(true);
          }}
        />
        <AdjustStockDialog
          open={showAdjustDialog}
          onOpenChange={setShowAdjustDialog}
          item={adjustItem}
          isPending={createTransactionMutation.isPending}
          onSubmit={(data) => {
            if (adjustItem) {
              createTransactionMutation.mutate({ itemId: adjustItem.id, data });
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div />
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "items" && (
            <Button onClick={() => { setEditingItem(null); setShowItemDialog(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          )}
          {activeTab === "categories" && (
            <Button onClick={() => { setEditingCategory(null); setShowCategoryDialog(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Category
            </Button>
          )}
          {activeTab === "purchase-orders" && (
            <Button onClick={() => setShowPODialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> New PO
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StockTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="low-stock">
            Low Stock
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs">
                {lowStockItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "items" && (
        <ItemsTab
          items={filteredItems}
          categories={categories}
          isLoading={itemsLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          sortField={sortField}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          getCategoryName={getCategoryName}
          onSelectItem={setSelectedItem}
          onAddItem={() => { setEditingItem(null); setShowItemDialog(true); }}
        />
      )}

      {activeTab === "categories" && (
        <CategoriesTab
          categories={categories}
          isLoading={categoriesLoading}
          items={items}
          onAdd={() => { setEditingCategory(null); setShowCategoryDialog(true); }}
          onEdit={(cat) => { setEditingCategory(cat); setShowCategoryDialog(true); }}
        />
      )}

      {activeTab === "low-stock" && (
        <LowStockTab
          items={lowStockItems}
          getCategoryName={getCategoryName}
          onSelectItem={setSelectedItem}
          onAdjust={(item) => {
            setAdjustItem(item);
            setShowAdjustDialog(true);
          }}
        />
      )}

      {activeTab === "purchase-orders" && (
        <PurchaseOrdersTab
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          isLoading={posLoading}
          getSupplierName={getSupplierName}
          onAdd={() => setShowPODialog(true)}
          onUpdateStatus={(id, status) =>
            updatePOStatusMutation.mutate({ id, data: { status } })
          }
        />
      )}

      <ItemDialog
        open={showItemDialog}
        onOpenChange={setShowItemDialog}
        item={editingItem}
        categories={categories}
        suppliers={suppliers}
        isPending={createItemMutation.isPending || updateItemMutation.isPending}
        onSubmit={(data) => {
          if (editingItem) {
            updateItemMutation.mutate({ id: editingItem.id, data });
          } else {
            createItemMutation.mutate(data);
          }
        }}
      />

      <CategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        category={editingCategory}
        isPending={createCategoryMutation.isPending}
        onSubmit={(data) => createCategoryMutation.mutate(data)}
      />

      <AdjustStockDialog
        open={showAdjustDialog}
        onOpenChange={setShowAdjustDialog}
        item={adjustItem}
        isPending={createTransactionMutation.isPending}
        onSubmit={(data) => {
          if (adjustItem) {
            createTransactionMutation.mutate({ itemId: adjustItem.id, data });
          }
        }}
      />

      <PurchaseOrderDialog
        open={showPODialog}
        onOpenChange={setShowPODialog}
        suppliers={suppliers}
        isPending={createPOMutation.isPending}
        onSubmit={(data) => createPOMutation.mutate(data)}
      />
    </>
  );
}

function EquipmentSection() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<EquipmentTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState(defaultEquipmentFormData);
  const [maintenanceForm, setMaintenanceForm] = useState(defaultMaintenanceForm);

  const { data: equipmentList = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: categories = [] } = useQuery<EquipmentCategory[]>({
    queryKey: ["/api/equipment/categories"],
  });

  const { data: maintenanceRecords = [], isLoading: maintenanceLoading } = useQuery<EquipmentMaintenance[]>({
    queryKey: ["/api/equipment", selectedItem?.id, "maintenance"],
    enabled: !!selectedItem,
    queryFn: async () => {
      const res = await fetch(`/api/equipment/${selectedItem!.id}/maintenance`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allJobEquipment = [] } = useQuery<any[]>({
    queryKey: ["/api/equipment", selectedItem?.id, "assignments"],
    enabled: !!selectedItem,
    queryFn: async () => {
      const res = await fetch(`/api/equipment/${selectedItem!.id}/assignments`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/equipment", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setCreateDialogOpen(false);
      setFormData(defaultEquipmentFormData);
      toast({ title: "Equipment added" });
    },
    onError: () => {
      toast({ title: "Failed to add equipment", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/equipment/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEditingItem(null);
      setFormData(defaultEquipmentFormData);
      toast({ title: "Equipment updated" });
    },
    onError: () => {
      toast({ title: "Failed to update equipment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setSelectedItem(null);
      toast({ title: "Equipment deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete equipment", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      await apiRequest("POST", "/api/equipment/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/categories"] });
      setCategoryDialogOpen(false);
      setNewCategoryName("");
      toast({ title: "Category created" });
    },
    onError: () => {
      toast({ title: "Failed to create category", variant: "destructive" });
    },
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/equipment/${selectedItem!.id}/maintenance`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment", selectedItem?.id, "maintenance"] });
      setMaintenanceDialogOpen(false);
      setMaintenanceForm(defaultMaintenanceForm);
      toast({ title: "Maintenance record added" });
    },
    onError: () => {
      toast({ title: "Failed to add maintenance record", variant: "destructive" });
    },
  });

  const filtered = equipmentList.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.model && item.model.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "available") return matchesSearch && (item.status === "active" || item.status === "available");
    if (activeTab === "in_use") return matchesSearch && item.status === "in_use";
    if (activeTab === "maintenance") return matchesSearch && item.status === "maintenance";
    return matchesSearch;
  });

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return null;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || null;
  }

  function openCreate() {
    setFormData(defaultEquipmentFormData);
    setEditingItem(null);
    setCreateDialogOpen(true);
  }

  function openEdit(item: Equipment) {
    setFormData({
      name: item.name || "",
      categoryId: item.categoryId || "",
      serialNumber: item.serialNumber || "",
      manufacturer: item.manufacturer || "",
      model: item.model || "",
      purchaseDate: item.purchaseDate ? format(new Date(item.purchaseDate), "yyyy-MM-dd") : "",
      purchasePrice: item.purchasePrice || "",
      status: item.status || "active",
      location: item.location || "",
      description: item.description || "",
    });
    setEditingItem(item);
    setCreateDialogOpen(true);
  }

  function handleSubmit() {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      status: formData.status,
    };
    if (formData.categoryId) payload.categoryId = formData.categoryId;
    if (formData.serialNumber) payload.serialNumber = formData.serialNumber;
    if (formData.manufacturer) payload.manufacturer = formData.manufacturer;
    if (formData.model) payload.model = formData.model;
    if (formData.purchaseDate) payload.purchaseDate = new Date(formData.purchaseDate).toISOString();
    if (formData.purchasePrice) payload.purchasePrice = formData.purchasePrice;
    if (formData.location) payload.location = formData.location;
    if (formData.description) payload.description = formData.description;

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleMaintenanceSubmit() {
    if (!maintenanceForm.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const payload: Record<string, unknown> = {
      title: maintenanceForm.title.trim(),
      type: maintenanceForm.type,
    };
    if (maintenanceForm.description) payload.description = maintenanceForm.description;
    if (maintenanceForm.cost) payload.cost = maintenanceForm.cost;
    if (maintenanceForm.scheduledDate) payload.scheduledDate = new Date(maintenanceForm.scheduledDate).toISOString();
    if (maintenanceForm.nextDueDate) payload.nextDueDate = new Date(maintenanceForm.nextDueDate).toISOString();

    createMaintenanceMutation.mutate(payload);
  }

  const activeCount = equipmentList.filter(i => i.status === "active" || i.status === "available").length;
  const inUseCount = equipmentList.filter(i => i.status === "in_use").length;
  const maintenanceCount = equipmentList.filter(i => i.status === "maintenance").length;
  const totalCount = equipmentList.length;

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Equipment
        </Button>
      </div>

      {!isLoading && equipmentList.length > 0 && (
        <div className="animate-fade-up mb-4">
          <p className="ios-label mb-3">Overview</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="feed-card card-press col-span-2 lg:col-span-1 animate-fade-up stagger-delay-1" onClick={() => setActiveTab("available")}>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--success) / 0.1)' }}>
                    <CheckCircle className="h-5 w-5" style={{ color: 'hsl(var(--success))' }} />
                  </div>
                  <div>
                    <p className="ios-label">Available</p>
                    <p className="text-[28px] font-bold tracking-tight leading-none mt-0.5">{activeCount}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="feed-card card-press animate-fade-up stagger-delay-2" onClick={() => setActiveTab("in_use")}>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                    <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                  </div>
                  <div>
                    <p className="ios-label">In Use</p>
                    <p className="text-xl font-bold leading-none mt-0.5">{inUseCount}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="feed-card card-press animate-fade-up stagger-delay-3" onClick={() => setActiveTab("maintenance")}>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--warning) / 0.1)' }}>
                    <AlertTriangle className="h-5 w-5" style={{ color: 'hsl(var(--warning))' }} />
                  </div>
                  <div>
                    <p className="ios-label">Maintenance</p>
                    <p className="text-xl font-bold leading-none mt-0.5">{maintenanceCount}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="feed-card card-press animate-fade-up stagger-delay-4" onClick={() => setActiveTab("all")}>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/50">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="ios-label">Total</p>
                    <p className="text-xl font-bold leading-none mt-0.5">{totalCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="feed-card overflow-x-auto no-scrollbar">
          <div className="p-1.5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EquipmentTab)}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="available">Available</TabsTrigger>
                <TabsTrigger value="in_use">In Use</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="utilisation">Utilisation</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {activeTab === "utilisation" ? (
          <EquipmentUtilisation />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="feed-card">
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="feed-card text-center py-12 px-6 animate-fade-up">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.1), hsl(var(--trade) / 0.05))' }}>
              <Wrench className="h-10 w-10" style={{ color: 'hsl(var(--trade) / 0.5)' }} />
            </div>
            <p className="text-lg font-semibold mb-1">{searchQuery ? "No equipment found" : "No equipment yet"}</p>
            <p className="ios-caption mb-6 max-w-xs mx-auto">
              {searchQuery ? "Try adjusting your search terms." : "Add your first piece of equipment to start tracking your tools, vehicles, and assets."}
            </p>
            {!searchQuery && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Equipment
              </Button>
            )}
          </div>
        ) : (
          <div>
            <p className="ios-label mb-3">{filtered.length} Item{filtered.length !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {filtered.map((item, index) => {
                const categoryName = getCategoryName(item.categoryId);
                const staggerClass = index < 8 ? `stagger-delay-${index + 1}` : '';
                return (
                  <div
                    key={item.id}
                    className={`feed-card card-press cursor-pointer animate-fade-up ${staggerClass}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="card-padding">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                            <Wrench className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{item.name}</p>
                            <div className="flex items-center gap-2 flex-wrap ios-caption mt-0.5">
                              {categoryName && <span>{categoryName}</span>}
                              {item.serialNumber && (
                                <>
                                  {categoryName && <span>·</span>}
                                  <span>SN: {item.serialNumber}</span>
                                </>
                              )}
                              {item.location && (
                                <>
                                  <span>·</span>
                                  <span>{item.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <EquipmentStatusBadge status={item.status || "active"} />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Makita Impact Driver"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Category</Label>
                <Button variant="ghost" size="sm" onClick={() => setCategoryDialogOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
              <Select
                value={formData.categoryId || "none"}
                onValueChange={(v) => setFormData({ ...formData, categoryId: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Purchase Cost (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Workshop, Van 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Power Tools"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCategoryMutation.mutate({ name: newCategoryName })}
              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {selectedItem.name}
                  <EquipmentStatusBadge status={selectedItem.status || "active"} />
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div className="space-y-3">
                  <p className="ios-label">Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {getCategoryName(selectedItem.categoryId) && (
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{getCategoryName(selectedItem.categoryId)}</p>
                      </div>
                    )}
                    {selectedItem.serialNumber && (
                      <div>
                        <p className="text-muted-foreground">Serial Number</p>
                        <p className="font-medium">{selectedItem.serialNumber}</p>
                      </div>
                    )}
                    {selectedItem.manufacturer && (
                      <div>
                        <p className="text-muted-foreground">Manufacturer</p>
                        <p className="font-medium">{selectedItem.manufacturer}</p>
                      </div>
                    )}
                    {selectedItem.model && (
                      <div>
                        <p className="text-muted-foreground">Model</p>
                        <p className="font-medium">{selectedItem.model}</p>
                      </div>
                    )}
                    {selectedItem.purchaseDate && (
                      <div>
                        <p className="text-muted-foreground">Purchase Date</p>
                        <p className="font-medium">{format(new Date(selectedItem.purchaseDate), "dd MMM yyyy")}</p>
                      </div>
                    )}
                    {selectedItem.purchasePrice && (
                      <div>
                        <p className="text-muted-foreground">Purchase Cost</p>
                        <p className="font-medium">{formatAUD(selectedItem.purchasePrice)}</p>
                      </div>
                    )}
                    {selectedItem.location && (
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="font-medium">{selectedItem.location}</p>
                      </div>
                    )}
                    {selectedItem.currentValue && (
                      <div>
                        <p className="text-muted-foreground">Current Value</p>
                        <p className="font-medium">{formatAUD(selectedItem.currentValue)}</p>
                      </div>
                    )}
                  </div>
                  {selectedItem.description && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Notes</p>
                      <p className="mt-0.5">{selectedItem.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedItem(null);
                      openEdit(selectedItem);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Delete this equipment?")) {
                        deleteMutation.mutate(selectedItem.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="ios-label">Maintenance History</p>
                    <Button size="sm" onClick={() => {
                      setMaintenanceForm(defaultMaintenanceForm);
                      setMaintenanceDialogOpen(true);
                    }}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Record
                    </Button>
                  </div>

                  {maintenanceLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-3">
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-3 w-48" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : maintenanceRecords.length === 0 ? (
                    <Card>
                      <CardContent className="p-4 text-center text-sm text-muted-foreground">
                        No maintenance records yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {maintenanceRecords.map((record) => (
                        <Card key={record.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm">{record.title}</p>
                                  <Badge variant="secondary" className="text-xs">
                                    {record.type === "scheduled" ? "Service" : record.type === "repair" ? "Repair" : "Inspection"}
                                  </Badge>
                                </div>
                                {record.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{record.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                  {record.scheduledDate && (
                                    <span className="flex items-center gap-1">
                                      <CalendarIcon className="h-3 w-3" />
                                      {format(new Date(record.scheduledDate), "dd MMM yyyy")}
                                    </span>
                                  )}
                                  {record.cost && (
                                    <span>{formatAUD(record.cost)}</span>
                                  )}
                                  {record.vendor && (
                                    <span>{record.vendor}</span>
                                  )}
                                </div>
                                {record.nextDueDate && (
                                  <p className="text-xs text-warning mt-1 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Next due: {format(new Date(record.nextDueDate), "dd MMM yyyy")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <JobAssignmentsSection
                  assignments={allJobEquipment}
                  equipmentId={selectedItem.id}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={maintenanceForm.title}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                placeholder="e.g., Annual Service"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={maintenanceForm.type}
                onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Service</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={maintenanceForm.scheduledDate}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cost (AUD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Next Due Date</Label>
              <Input
                type="date"
                value={maintenanceForm.nextDueDate}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextDueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleMaintenanceSubmit}
              disabled={createMaintenanceMutation.isPending}
            >
              {createMaintenanceMutation.isPending ? "Saving..." : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const defaultEquipmentFormData = {
  name: "",
  categoryId: "",
  serialNumber: "",
  manufacturer: "",
  model: "",
  purchaseDate: "",
  purchasePrice: "",
  status: "active",
  location: "",
  description: "",
};

const defaultMaintenanceForm = {
  title: "",
  type: "scheduled",
  description: "",
  cost: "",
  scheduledDate: "",
  nextDueDate: "",
};

function JobAssignmentsSection({ assignments, equipmentId }: { assignments: any[]; equipmentId: string }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [usageForm, setUsageForm] = useState({
    hoursUsed: "",
    kmTravelled: "",
    capacityUsed: "",
    capacityAvailable: "",
    postJobNotes: "",
    wasOversized: false,
  });

  const updateUsageMutation = useMutation({
    mutationFn: async ({ jobId, assignmentId, data }: { jobId: string; assignmentId: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/jobs/${jobId}/equipment/${assignmentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment", equipmentId, "assignments"] });
      setEditingId(null);
      toast({ title: "Usage data saved" });
    },
    onError: () => {
      toast({ title: "Failed to save usage data", variant: "destructive" });
    },
  });

  function openUsageForm(assignment: any) {
    setUsageForm({
      hoursUsed: assignment.hoursUsed || "",
      kmTravelled: assignment.kmTravelled || "",
      capacityUsed: assignment.capacityUsed || "",
      capacityAvailable: assignment.capacityAvailable || "",
      postJobNotes: assignment.postJobNotes || "",
      wasOversized: assignment.wasOversized || false,
    });
    setEditingId(assignment.id);
  }

  function handleSaveUsage(assignment: any) {
    const payload: Record<string, unknown> = {};
    if (usageForm.hoursUsed) payload.hoursUsed = usageForm.hoursUsed;
    if (usageForm.kmTravelled) payload.kmTravelled = usageForm.kmTravelled;
    if (usageForm.capacityUsed) payload.capacityUsed = usageForm.capacityUsed;
    if (usageForm.capacityAvailable) payload.capacityAvailable = usageForm.capacityAvailable;
    if (usageForm.postJobNotes) payload.postJobNotes = usageForm.postJobNotes;
    payload.wasOversized = usageForm.wasOversized;

    updateUsageMutation.mutate({
      jobId: assignment.jobId,
      assignmentId: assignment.id,
      data: payload,
    });
  }

  return (
    <div className="space-y-3">
      <p className="ios-label">Assigned to Jobs</p>
      {assignments.length > 0 ? (
        <div className="space-y-2">
          {assignments.map((assignment: any) => (
            <div key={assignment.id} className="rounded-lg bg-muted/50 overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{assignment.jobTitle || 'Job'}</p>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {assignment.jobStatus || 'Active'}
                    </Badge>
                    {assignment.wasOversized && (
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">Oversized</Badge>
                    )}
                  </div>
                  {(assignment.hoursUsed || assignment.kmTravelled || assignment.capacityUsed) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      {assignment.hoursUsed && <span>{assignment.hoursUsed}h</span>}
                      {assignment.kmTravelled && <span>{assignment.kmTravelled}km</span>}
                      {assignment.capacityUsed && <span>Cap: {assignment.capacityUsed}{assignment.capacityAvailable ? ` / ${assignment.capacityAvailable}` : ''}</span>}
                    </div>
                  )}
                  {assignment.postJobNotes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{assignment.postJobNotes}</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => openUsageForm(assignment)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
              {editingId === assignment.id && (
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Hours Used</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={usageForm.hoursUsed}
                        onChange={(e) => setUsageForm({ ...usageForm, hoursUsed: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">KM Travelled</Label>
                      <Input
                        type="number"
                        value={usageForm.kmTravelled}
                        onChange={(e) => setUsageForm({ ...usageForm, kmTravelled: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Capacity Used</Label>
                      <Input
                        value={usageForm.capacityUsed}
                        onChange={(e) => setUsageForm({ ...usageForm, capacityUsed: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Capacity Available</Label>
                      <Input
                        value={usageForm.capacityAvailable}
                        onChange={(e) => setUsageForm({ ...usageForm, capacityAvailable: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Post-Job Notes</Label>
                    <Textarea
                      value={usageForm.postJobNotes}
                      onChange={(e) => setUsageForm({ ...usageForm, postJobNotes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={usageForm.wasOversized}
                      onCheckedChange={(c) => setUsageForm({ ...usageForm, wasOversized: !!c })}
                    />
                    <Label className="text-xs">Was Oversized</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleSaveUsage(assignment)} disabled={updateUsageMutation.isPending}>
                      {updateUsageMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Not assigned to any jobs yet
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EquipmentUtilisation() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/equipment-utilisation"],
    queryFn: async () => {
      const res = await fetch("/api/reports/equipment-utilisation", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="feed-card p-4"><Skeleton className="h-10 w-full" /></div>
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="feed-card p-4"><Skeleton className="h-16 w-full" /></div>
        ))}
      </div>
    );
  }

  const summary = data?.summary || {};
  const equipmentItems = data?.equipment || [];

  const utilisationStats = [
    { icon: Wrench, label: "Equipment Used", value: summary.totalEquipmentUsed || 0, color: '--trade', hero: true },
    { icon: Briefcase, label: "Total Jobs", value: summary.totalJobAssignments || 0, color: '--trade' },
    { icon: Clock, label: "Hours Logged", value: summary.totalHoursLogged || 0, color: '--info' },
    { icon: Route, label: "Total KM", value: summary.totalKmLogged || 0, color: '--success' },
    { icon: AlertTriangle, label: "Oversized", value: summary.oversizedInstances || 0, color: '--warning' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="ios-label mb-3">Utilisation Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {utilisationStats.map((stat, idx) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className={`feed-card animate-fade-up stagger-delay-${idx + 1} ${stat.hero ? 'col-span-2 sm:col-span-1' : ''}`}>
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `hsl(var(${stat.color}) / 0.1)` }}>
                      <StatIcon className="h-5 w-5" style={{ color: `hsl(var(${stat.color}))` }} />
                    </div>
                    <div>
                      <p className="ios-label">{stat.label}</p>
                      <p className={`${stat.hero ? 'text-[28px]' : 'text-xl'} font-bold leading-none mt-0.5`}>{stat.value}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {equipmentItems.length === 0 ? (
        <div className="feed-card text-center py-12 px-6 animate-fade-up">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, hsl(var(--trade) / 0.1), hsl(var(--trade) / 0.05))' }}>
            <BarChart3 className="h-10 w-10" style={{ color: 'hsl(var(--trade) / 0.5)' }} />
          </div>
          <p className="text-lg font-semibold mb-1">No utilisation data</p>
          <p className="ios-caption max-w-xs mx-auto">Equipment usage data will appear here once equipment is assigned to jobs.</p>
        </div>
      ) : (
        <div>
          <p className="ios-label mb-3">Equipment Breakdown</p>
          <div className="space-y-2">
            {equipmentItems.map((item: any, index: number) => {
              const isExpanded = expandedId === item.equipmentId;
              const staggerClass = index < 8 ? `stagger-delay-${index + 1}` : '';
              return (
                <div key={item.equipmentId} className={`feed-card card-press animate-fade-up ${staggerClass}`}>
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.equipmentId)}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                          <Wrench className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{item.name}</p>
                            {item.utilizationRate > 80 && (
                              <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">
                                <Gauge className="h-3 w-3 mr-0.5" />
                                High Use
                              </Badge>
                            )}
                            {item.oversizedCount > 0 && (
                              <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                                Oversized
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 ios-caption mt-0.5 flex-wrap">
                            {item.category && <span>{item.category}</span>}
                            <span>{item.totalJobs} job{item.totalJobs !== 1 ? 's' : ''}</span>
                            {item.totalHoursUsed > 0 && <span>{item.totalHoursUsed}h</span>}
                            {item.totalKmTravelled > 0 && <span>{item.totalKmTravelled}km</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right text-sm">
                          <p className="font-semibold">{item.utilizationRate}%</p>
                          <p className="ios-caption">utilisation</p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>
                  {isExpanded && item.assignments && item.assignments.length > 0 && (
                    <div className="px-4 pb-4 space-y-2 border-t pt-3">
                      {item.assignments.map((a: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">{a.jobTitle || 'Job'}</p>
                              <Badge variant="secondary" className="text-xs">{a.jobStatus || 'Active'}</Badge>
                              {a.wasOversized && (
                                <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">Oversized</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 ios-caption mt-1 flex-wrap">
                              {a.hoursUsed && <span>{a.hoursUsed}h used</span>}
                              {a.kmTravelled && <span>{a.kmTravelled}km</span>}
                              {a.capacityUsed && <span>Cap: {a.capacityUsed}{a.capacityAvailable ? ` / ${a.capacityAvailable}` : ''}</span>}
                              {a.assignedAt && <span>{format(new Date(a.assignedAt), "dd MMM yyyy")}</span>}
                            </div>
                            {a.postJobNotes && (
                              <p className="ios-caption mt-1 italic">{a.postJobNotes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsTab({
  items,
  categories,
  isLoading,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  sortField,
  sortDir,
  onToggleSort,
  getCategoryName,
  onSelectItem,
  onAddItem,
}: {
  items: InventoryItem[];
  categories: InventoryCategory[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (f: SortField) => void;
  getCategoryName: (id: string | null) => string;
  onSelectItem: (item: InventoryItem) => void;
  onAddItem: () => void;
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No inventory items"
          description="Add your first item to start tracking stock"
          action={
            <Button onClick={onAddItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("name")}
                    >
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="p-3 font-medium hidden sm:table-cell">SKU</th>
                  <th className="p-3 font-medium hidden md:table-cell">Category</th>
                  <th className="p-3 font-medium">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("currentStock")}
                    >
                      Stock <SortIcon field="currentStock" />
                    </button>
                  </th>
                  <th className="p-3 font-medium hidden sm:table-cell">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("costPrice")}
                    >
                      Cost <SortIcon field="costPrice" />
                    </button>
                  </th>
                  <th className="p-3 font-medium hidden sm:table-cell">
                    <button
                      className="flex items-center gap-1"
                      onClick={() => onToggleSort("sellPrice")}
                    >
                      Sell <SortIcon field="sellPrice" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLow =
                    item.reorderLevel != null &&
                    (item.currentStock ?? 0) <= item.reorderLevel;
                  return (
                    <tr
                      key={item.id}
                      className="border-b last:border-0 hover-elevate cursor-pointer"
                      onClick={() => onSelectItem(item)}
                    >
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {item.sku || "-"}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryName(item.categoryId)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span
                          className={
                            isLow
                              ? "text-destructive font-semibold"
                              : "text-foreground"
                          }
                        >
                          {item.currentStock ?? 0}
                        </span>
                        {isLow && (
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive inline ml-1" />
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {item.costPrice ? `$${parseFloat(item.costPrice).toFixed(2)}` : "-"}
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">
                        {item.sellPrice ? `$${parseFloat(item.sellPrice).toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CategoriesTab({
  categories,
  isLoading,
  items,
  onAdd,
  onEdit,
}: {
  categories: InventoryCategory[];
  isLoading: boolean;
  items: InventoryItem[];
  onAdd: () => void;
  onEdit: (cat: InventoryCategory) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="No categories"
        description="Create categories to organize your inventory"
        action={
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Category
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((cat) => {
        const count = items.filter((i) => i.categoryId === cat.id).length;
        return (
          <Card key={cat.id} className="hover-elevate cursor-pointer" onClick={() => onEdit(cat)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{cat.name}</p>
                  {cat.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {cat.description}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">{count} items</Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LowStockTab({
  items,
  getCategoryName,
  onSelectItem,
  onAdjust,
}: {
  items: InventoryItem[];
  getCategoryName: (id: string | null) => string;
  onSelectItem: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No low stock items"
        description="All items are above their reorder levels"
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => onSelectItem(item)}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="font-medium truncate">{item.name}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>
                    Stock: <span className="text-destructive font-semibold">{item.currentStock ?? 0}</span>
                    {" / "}
                    Reorder at: {item.reorderLevel ?? 0}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryName(item.categoryId)}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjust(item);
                }}
              >
                <ArrowUp className="w-4 h-4 mr-1" /> Restock
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Per-line-item status badge
const itemStatusConfig: Record<string, { label: string; className: string }> = {
  pending:  { label: "Pending",  className: "bg-warning/10 text-warning" },
  partial:  { label: "Partial",  className: "bg-primary/10 text-primary" },
  received: { label: "Received", className: "bg-success/10 text-success" },
  cancelled:{ label: "Cancelled",className: "bg-destructive/10 text-destructive" },
};

function PurchaseOrdersTab({
  purchaseOrders,
  suppliers,
  isLoading,
  getSupplierName,
  onAdd,
  onUpdateStatus,
}: {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  isLoading: boolean;
  getSupplierName: (id: string | null) => string;
  onAdd: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [poItems, setPOItems] = useState<Record<string, any[]>>({});
  const [sendDialogPO, setSendDialogPO] = useState<PurchaseOrder | null>(null);
  const [sendChannel, setSendChannel] = useState<"email" | "sms">("email");
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendingPO, setSendingPO] = useState(false);
  const { toast } = useToast();

  const togglePO = async (poId: string) => {
    if (expandedPO === poId) {
      setExpandedPO(null);
      return;
    }
    setExpandedPO(poId);
    if (!poItems[poId]) {
      try {
        const res = await apiRequest("GET", `/api/purchase-orders/${poId}/items`);
        const data = await res.json();
        setPOItems(prev => ({ ...prev, [poId]: data }));
      } catch {}
    }
  };

  const updateItemStatus = async (poId: string, itemId: string, receivedQty: number, status: string) => {
    try {
      const res = await apiRequest("PATCH", `/api/purchase-orders/${poId}/items/${itemId}`, {
        receivedQuantity: receivedQty,
        status,
      });
      const updated = await res.json();
      setPOItems(prev => ({
        ...prev,
        [poId]: (prev[poId] || []).map(i => i.id === itemId ? updated : i),
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Item updated" });
    } catch {
      toast({ title: "Failed to update item", variant: "destructive" });
    }
  };

  const openSendDialog = (po: PurchaseOrder) => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    const hasEmail = !!supplier?.email;
    const defaultChannel = hasEmail ? "email" : "sms";
    setSendChannel(defaultChannel);
    setSendTo(defaultChannel === "email" ? (supplier?.email || "") : ((supplier as any)?.phone || ""));
    setSendMessage("");
    setSendDialogPO(po);
  };

  const handleSendPO = async () => {
    if (!sendDialogPO) return;
    if (!sendTo.trim()) {
      toast({ title: sendChannel === "email" ? "Enter a supplier email address" : "Enter a supplier phone number", variant: "destructive" });
      return;
    }
    setSendingPO(true);
    try {
      await apiRequest("POST", `/api/purchase-orders/${sendDialogPO.id}/send`, {
        channel: sendChannel,
        to: sendTo.trim(),
        message: sendMessage.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: sendChannel === "email" ? "Purchase order emailed to supplier" : "Purchase order sent via SMS" });
      setSendDialogPO(null);
    } catch (e: any) {
      toast({ title: e?.message || "Failed to send PO", variant: "destructive" });
    } finally {
      setSendingPO(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (purchaseOrders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No purchase orders"
        description="Create purchase orders to manage supplier orders"
        action={
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> New PO
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {purchaseOrders.map((po) => {
          const isExpanded = expandedPO === po.id;
          const items: any[] = poItems[po.id] || [];
          return (
            <Card key={po.id} className="overflow-hidden">
              {/* PO header row */}
              <div
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => togglePO(po.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{po.poNumber}</span>
                    <Badge className={statusColors[po.status || "pending"]}>
                      {(po.status || "pending").charAt(0).toUpperCase() + (po.status || "pending").slice(1)}
                    </Badge>
                    {(po as any).sentAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Sent
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-sm text-muted-foreground flex-wrap">
                    <span>{getSupplierName(po.supplierId)}</span>
                    {po.orderDate && <span>{format(new Date(po.orderDate), "dd MMM yyyy")}</span>}
                    <span className="font-medium text-foreground">${parseFloat(po.total || "0").toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={(e) => { e.stopPropagation(); openSendDialog(po); }}
                    title="Email PO to supplier"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </Button>
                  <Select
                    value={po.status || "pending"}
                    onValueChange={(val) => onUpdateStatus(po.id, val)}
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs" onClick={e => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="partial">Partially Received</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded line items */}
              {isExpanded && (
                <div className="border-t">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">No line items on this PO.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30 text-muted-foreground">
                            <th className="p-3 text-left font-medium">Description</th>
                            <th className="p-3 text-center font-medium">Ordered</th>
                            <th className="p-3 text-center font-medium">Received</th>
                            <th className="p-3 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => {
                            const cfg = itemStatusConfig[item.status || "pending"];
                            return (
                              <tr key={item.id} className="border-b last:border-0">
                                <td className="p-3">{item.description}</td>
                                <td className="p-3 text-center">{item.quantity}</td>
                                <td className="p-3 text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={item.quantity}
                                    className="w-16 h-7 text-center text-xs p-1"
                                    defaultValue={item.receivedQuantity ?? 0}
                                    onBlur={(e) => {
                                      const qty = Math.min(parseInt(e.target.value) || 0, item.quantity);
                                      const newStatus =
                                        qty === 0 ? "pending"
                                        : qty >= item.quantity ? "received"
                                        : "partial";
                                      if (qty !== (item.receivedQuantity ?? 0) || newStatus !== item.status) {
                                        updateItemStatus(po.id, item.id, qty, newStatus);
                                      }
                                    }}
                                  />
                                </td>
                                <td className="p-3">
                                  <Select
                                    value={item.status || "pending"}
                                    onValueChange={(val) =>
                                      updateItemStatus(
                                        po.id,
                                        item.id,
                                        val === "received" ? item.quantity : (item.receivedQuantity ?? 0),
                                        val,
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-[110px] h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="partial">Partial</SelectItem>
                                      <SelectItem value="received">Received</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Send PO dialog */}
      <Dialog open={!!sendDialogPO} onOpenChange={(v) => !v && setSendDialogPO(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" /> Send Purchase Order
            </DialogTitle>
          </DialogHeader>
          {sendDialogPO && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Sending <strong>{sendDialogPO.poNumber}</strong> to supplier
                {(sendDialogPO as any).sentAt && (
                  <span className="ml-2 text-xs text-green-600 font-medium">
                    (previously sent {new Date((sendDialogPO as any).sentAt).toLocaleDateString("en-AU")})
                  </span>
                )}
              </p>
              {/* Channel selector */}
              <div className="flex rounded-md border overflow-hidden">
                {(["email", "sms"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      const supplier = suppliers.find(s => s.id === sendDialogPO.supplierId);
                      setSendChannel(ch);
                      setSendTo(ch === "email" ? (supplier?.email || "") : ((supplier as any)?.phone || ""));
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                      sendChannel === ch
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {ch === "email" ? <Mail className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    {ch === "email" ? "Email" : "SMS"}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>{sendChannel === "email" ? "Supplier email *" : "Supplier phone *"}</Label>
                <Input
                  type={sendChannel === "email" ? "email" : "tel"}
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder={sendChannel === "email" ? "supplier@example.com" : "04xx xxx xxx"}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Message (optional)</Label>
                <Textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder={sendChannel === "email" ? "Custom covering note (leave blank for default)" : "Custom SMS text (leave blank for default)"}
                  rows={3}
                />
              </div>
              {sendChannel === "email" && (
                <p className="text-xs text-muted-foreground">The PO will be attached as a PDF.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogPO(null)}>Cancel</Button>
            <Button
              onClick={handleSendPO}
              disabled={sendingPO || !sendTo.trim()}
            >
              {sendingPO ? "Sending..." : sendChannel === "email" ? "Email PO" : "Send SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ItemDetailView({
  item,
  transactions,
  getCategoryName,
  getSupplierName,
  onBack,
  onEdit,
  onDelete,
  onAdjust,
}: {
  item: InventoryItem;
  transactions: InventoryTransaction[];
  getCategoryName: (id: string | null) => string;
  getSupplierName: (id: string | null) => string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdjust: () => void;
}) {
  const isLow =
    item.reorderLevel != null && (item.currentStock ?? 0) <= item.reorderLevel;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold flex-1 truncate">{item.name}</h2>
        <Button variant="outline" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-1" /> Edit
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Current Stock</p>
            <p className={`text-2xl font-bold mt-1 ${isLow ? "text-destructive" : ""}`}>
              {item.currentStock ?? 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {item.unit || "each"}
              </span>
            </p>
            {isLow && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" /> Below reorder level ({item.reorderLevel})
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cost Price</p>
            <p className="text-2xl font-bold mt-1">
              {item.costPrice ? `$${parseFloat(item.costPrice).toFixed(2)}` : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sell Price</p>
            <p className="text-2xl font-bold mt-1">
              {item.sellPrice ? `$${parseFloat(item.sellPrice).toFixed(2)}` : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="text-lg font-medium mt-1">{getCategoryName(item.categoryId)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="font-medium">Details</p>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>SKU: {item.sku || "-"}</p>
              <p>Unit: {item.unit || "each"}</p>
              <p>Location: {item.location || "-"}</p>
              <p>Supplier: {getSupplierName(item.supplierId)}</p>
              <p>Min Stock: {item.minimumStock ?? 0}</p>
              <p>Reorder Level: {item.reorderLevel ?? 0}</p>
              <p>Reorder Qty: {item.reorderQuantity ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium flex items-center gap-1.5">
              <History className="w-4 h-4" /> Stock History
            </p>
            <Button onClick={onAdjust}>
              <ArrowUpDown className="w-4 h-4 mr-1" /> Adjust Stock
            </Button>
          </div>
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground text-sm">
                No stock movements recorded
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="max-h-[300px] overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 p-3 border-b last:border-0 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {tx.type === "in" && (
                          <ArrowDown className="w-3.5 h-3.5 text-success flex-shrink-0" />
                        )}
                        {tx.type === "out" && (
                          <ArrowUp className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        )}
                        {tx.type === "adjustment" && (
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-medium capitalize">{tx.type}</span>
                        <span className="text-muted-foreground">
                          {tx.type === "out" ? "-" : "+"}
                          {tx.quantity}
                        </span>
                      </div>
                      {tx.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {tx.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {tx.transactionDate
                        ? format(new Date(tx.transactionDate), "dd MMM HH:mm")
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  suppliers,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: InventoryItem | null;
  categories: InventoryCategory[];
  suppliers: Supplier[];
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    unit: "each",
    costPrice: "",
    sellPrice: "",
    categoryId: "",
    minimumStock: "0",
    reorderLevel: "0",
    reorderQuantity: "",
    location: "",
    supplierId: "",
  });
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();

  const inlineCategoryMutation = useMutation({
    mutationFn: (data: { name: string }) => apiRequest("POST", "/api/inventory/categories", data),
    onSuccess: async (res: Response) => {
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      if (created?.id) {
        setFormData((prev) => ({ ...prev, categoryId: created.id }));
      }
      setShowNewCategory(false);
      setNewCategoryName("");
      toast({ title: "Category created" });
    },
    onError: () => {
      toast({ title: "Could not create category", variant: "destructive" });
    },
  });

  const resetForm = () => {
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || "",
        sku: item.sku || "",
        unit: item.unit || "each",
        costPrice: item.costPrice || "",
        sellPrice: item.sellPrice || "",
        categoryId: item.categoryId || "",
        minimumStock: String(item.minimumStock ?? 0),
        reorderLevel: String(item.reorderLevel ?? 0),
        reorderQuantity: item.reorderQuantity ? String(item.reorderQuantity) : "",
        location: item.location || "",
        supplierId: item.supplierId || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        sku: "",
        unit: "each",
        costPrice: "",
        sellPrice: "",
        categoryId: "",
        minimumStock: "0",
        reorderLevel: "0",
        reorderQuantity: "",
        location: "",
        supplierId: "",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload: any = {
              name: formData.name,
              description: formData.description || null,
              sku: formData.sku || null,
              unit: formData.unit,
              costPrice: formData.costPrice || null,
              sellPrice: formData.sellPrice || null,
              categoryId: formData.categoryId || null,
              minimumStock: parseInt(formData.minimumStock) || 0,
              reorderLevel: parseInt(formData.reorderLevel) || 0,
              reorderQuantity: formData.reorderQuantity
                ? parseInt(formData.reorderQuantity)
                : null,
              location: formData.location || null,
              supplierId: formData.supplierId || null,
            };
            onSubmit(payload);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={formData.unit}
                onValueChange={(v) => setFormData({ ...formData, unit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="m">Metre</SelectItem>
                  <SelectItem value="m2">Square Metre</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="litre">Litre</SelectItem>
                  <SelectItem value="roll">Roll</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cost Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sell Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.sellPrice}
                onChange={(e) => setFormData({ ...formData, sellPrice: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.categoryId || "none"}
              onValueChange={(v) => {
                if (v === "__create__") {
                  setShowNewCategory(true);
                  return;
                }
                setFormData({ ...formData, categoryId: v === "none" ? "" : v });
              }}
            >
              <SelectTrigger data-testid="select-item-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
                <SelectItem value="__create__" data-testid="option-create-category">
                  + Create new category
                </SelectItem>
              </SelectContent>
            </Select>
            {showNewCategory && (
              <div className="flex gap-2 pt-1">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  data-testid="input-new-category-name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newCategoryName.trim()) inlineCategoryMutation.mutate({ name: newCategoryName.trim() });
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={!newCategoryName.trim() || inlineCategoryMutation.isPending}
                  onClick={() => inlineCategoryMutation.mutate({ name: newCategoryName.trim() })}
                  data-testid="button-save-new-category"
                >
                  {inlineCategoryMutation.isPending ? "Adding..." : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setShowNewCategory(false); setNewCategoryName(""); }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Min Stock</Label>
              <Input
                type="number"
                value={formData.minimumStock}
                onChange={(e) =>
                  setFormData({ ...formData, minimumStock: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Reorder Level</Label>
              <Input
                type="number"
                value={formData.reorderLevel}
                onChange={(e) =>
                  setFormData({ ...formData, reorderLevel: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Reorder Qty</Label>
              <Input
                type="number"
                value={formData.reorderQuantity}
                onChange={(e) =>
                  setFormData({ ...formData, reorderQuantity: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="e.g. Warehouse A, Bin 3"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select
              value={formData.supplierId || "none"}
              onValueChange={(v) =>
                setFormData({ ...formData, supplierId: v === "none" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : item ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: InventoryCategory | null;
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setName(category?.name || "");
          setDescription(category?.description || "");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name, description: description || null });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : category ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({
  open,
  onOpenChange,
  item,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: InventoryItem | null;
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [type, setType] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setType("in");
          setQuantity("");
          setNotes("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Adjust Stock{item ? `: ${item.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        {item && (
          <p className="text-sm text-muted-foreground">
            Current stock: {item.currentStock ?? 0} {item.unit || "each"}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              type,
              quantity: parseInt(quantity),
              notes: notes || null,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Stock In</SelectItem>
                <SelectItem value="out">Stock Out</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity *</Label>
            <Input
              type="number"
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason / Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Adjust"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrderDialog({
  open,
  onOpenChange,
  suppliers,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suppliers: Supplier[];
  isPending: boolean;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    supplierId: "",
    poNumber: "",
    notes: "",
    total: "",
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setFormData({ supplierId: "", poNumber: "", notes: "", total: "" });
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              supplierId: formData.supplierId,
              poNumber: formData.poNumber,
              notes: formData.notes || null,
              total: formData.total || "0",
              subtotal: formData.total || "0",
              status: "pending",
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>PO Number *</Label>
            <Input
              required
              value={formData.poNumber}
              onChange={(e) =>
                setFormData({ ...formData, poNumber: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(v) =>
                setFormData({ ...formData, supplierId: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Total ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.total}
              onChange={(e) =>
                setFormData({ ...formData, total: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !formData.supplierId || !formData.poNumber}
            >
              {isPending ? "Creating..." : "Create PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
