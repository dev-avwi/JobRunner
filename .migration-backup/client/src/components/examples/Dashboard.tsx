import Dashboard from '../Dashboard';

export default function DashboardExample() {
  return (
    <div className="min-h-screen bg-background">
      <Dashboard 
        onCreateJob={() => console.log('Create job clicked')}
        onCreateQuote={() => console.log('Create quote clicked')}
        onCreateInvoice={() => console.log('Create invoice clicked')}
        onViewJobs={() => console.log('View jobs clicked')}
        onViewInvoices={() => console.log('View invoices clicked')}
        onViewQuotes={() => console.log('View quotes clicked')}
      />
    </div>
  );
}