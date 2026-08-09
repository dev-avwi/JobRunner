import { queryClient } from "./queryClient";

const routeQueryMap: Record<string, string[]> = {
  "/": ["/api/dashboard/stats", "/api/jobs", "/api/action-center"],
  "/work": ["/api/jobs"],
  "/action-center": ["/api/action-center"],
  "/clients": ["/api/clients"],
  "/documents": ["/api/quotes", "/api/invoices"],
  "/payment-hub": ["/api/invoices", "/api/payments"],
  "/expenses": ["/api/expenses"],
  "/schedule": ["/api/jobs"],
  "/time-tracking": ["/api/time-entries"],
  "/team-operations": ["/api/team/members"],
  "/chat": ["/api/chat/unread-counts"],
  "/insights": ["/api/dashboard/stats"],
  "/templates": ["/api/templates"],
  "/settings": ["/api/business-settings"],
  "/reports": ["/api/dashboard/stats"],
  "/reports/payroll": ["/api/team/members"],
  "/subcontractor-invoices": ["/api/business/subcontractor-invoices"],
  "/collect-payment": ["/api/invoices"],
  "/inventory": ["/api/inventory"],
  "/files": ["/api/files"],
};

const chunkImportMap: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/components/Dashboard"),
  "/work": () => import("@/pages/WorkPage"),
  "/action-center": () => import("@/pages/ActionCenter"),
  "/clients": () => import("@/components/ClientsList"),
  "/documents": () => import("@/pages/DocumentsHub"),
  "/payment-hub": () => import("@/pages/PaymentHub"),
  "/expenses": () => import("@/pages/ExpensesPage"),
  "/schedule": () => import("@/pages/SchedulePage"),
  "/time-tracking": () => import("@/pages/TimeTracking"),
  "/team-operations": () => import("@/pages/TeamOperations"),
  "/chat": () => import("@/pages/ChatHub"),
  "/insights": () => import("@/pages/Insights"),
  "/autopilot": () => import("@/pages/Autopilot"),
  "/templates": () => import("@/pages/TemplatesHub"),
  "/settings": () => import("@/components/Settings"),
  "/reports": () => import("@/pages/Reports"),
  "/reports/payroll": () => import("@/pages/PayrollReports"),
  "/subcontractor-invoices": () => import("@/pages/SubcontractorInvoices"),
  "/integrations": () => import("@/pages/Integrations"),
  "/collect-payment": () => import("@/pages/CollectPayment"),
  "/inventory": () => import("@/pages/InventoryPage"),
  "/map": () => import("@/pages/JobMap"),
  "/files": () => import("@/pages/Files"),
  "/communications": () => import("@/pages/CommunicationsHub"),
  "/whs": () => import("@/pages/WhsHub"),
  "/more": () => import("@/pages/More"),
};

const prefetchedChunks = new Set<string>();

export function prefetchRoute(path: string): void {
  if (!prefetchedChunks.has(path)) {
    const chunkLoader = chunkImportMap[path];
    if (chunkLoader) {
      chunkLoader()
        .then(() => prefetchedChunks.add(path))
        .catch(() => {});
    }
  }

  const queryKeys = routeQueryMap[path];
  if (queryKeys) {
    for (const key of queryKeys) {
      const existing = queryClient.getQueryData([key]);
      if (!existing) {
        queryClient.prefetchQuery({ queryKey: [key] });
      }
    }
  }
}

export function warmCoreData(): void {
  const coreEndpoints = [
    "/api/jobs",
    "/api/clients",
    "/api/quotes",
    "/api/invoices",
    "/api/business-settings",
    "/api/dashboard/stats",
  ];
  for (const key of coreEndpoints) {
    const existing = queryClient.getQueryData([key]);
    if (!existing) {
      queryClient.prefetchQuery({ queryKey: [key] });
    }
  }
}
