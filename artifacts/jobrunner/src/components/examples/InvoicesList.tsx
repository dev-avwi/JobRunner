import InvoicesList from '../InvoicesList';

export default function InvoicesListExample() {
  return (
    <div className="min-h-screen bg-background">
      <InvoicesList 
        onCreateInvoice={() => console.log('Create invoice clicked')}
        onViewInvoice={(id) => console.log('View invoice:', id)}
        onSendInvoice={(id) => console.log('Send invoice:', id)}
        onCreatePaymentLink={(id) => console.log('Create payment link:', id)}
        onMarkPaid={(id) => console.log('Mark paid:', id)}
      />
    </div>
  );
}