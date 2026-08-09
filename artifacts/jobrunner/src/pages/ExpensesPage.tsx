import { PageShell } from "@/components/ui/page-shell";
import { ExpenseTracking } from "@/components/ExpenseTracking";

export default function ExpensesPage() {
  return (
    <PageShell>
      <ExpenseTracking />
    </PageShell>
  );
}
