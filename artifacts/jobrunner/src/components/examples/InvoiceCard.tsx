import InvoiceCard from '../InvoiceCard';

export default function InvoiceCardExample() {
  return (
    <div className="space-y-4 p-4 max-w-md">
      <InvoiceCard 
        id="1"
        number="TT-2025-001"
        client="Sarah Johnson"
        jobTitle="Kitchen Renovation - Plumbing"
        total={2850.00}
        status="draft"
        onViewClick={(id) => console.log('View invoice:', id)}
        onSendClick={(id) => console.log('Send invoice:', id)}
        onCreatePaymentLink={(id) => console.log('Create payment link:', id)}
        onMarkPaid={(id) => console.log('Mark paid:', id)}
      />
      
      <InvoiceCard 
        id="2"
        number="TT-2025-002"
        client="David Wilson"
        jobTitle="Bathroom Leak Repair"
        total={650.00}
        status="sent"
        sentAt="3 days ago"
        dueDate="Jan 25, 2025"
        onViewClick={(id) => console.log('View invoice:', id)}
        onSendClick={(id) => console.log('Resend invoice:', id)}
        onCreatePaymentLink={(id) => console.log('Create payment link:', id)}
        onMarkPaid={(id) => console.log('Mark paid:', id)}
      />
      
      <InvoiceCard 
        id="3"
        number="TT-2025-003"
        client="Emma Thompson"
        jobTitle="Hot Water System Installation"
        total={1200.00}
        status="paid"
        sentAt="1 week ago"
        paidAt="5 days ago"
        onViewClick={(id) => console.log('View invoice:', id)}
      />
      
      <InvoiceCard 
        id="4"
        number="TT-2025-004"
        client="Mark Stevens"
        jobTitle="Pipe Replacement - Emergency"
        total={890.00}
        status="overdue"
        sentAt="2 weeks ago"
        dueDate="Jan 10, 2025"
        onViewClick={(id) => console.log('View invoice:', id)}
        onSendClick={(id) => console.log('Resend invoice:', id)}
        onCreatePaymentLink={(id) => console.log('Create payment link:', id)}
        onMarkPaid={(id) => console.log('Mark paid:', id)}
      />
    </div>
  );
}