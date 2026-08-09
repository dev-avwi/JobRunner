import QuoteCard from '../QuoteCard';

export default function QuoteCardExample() {
  return (
    <div className="space-y-4 p-4 max-w-md">
      <QuoteCard 
        id="1"
        number="QT-2025-001"
        client="Sarah Johnson"
        jobTitle="Kitchen Renovation - Plumbing"
        total={2850.00}
        status="draft"
        validUntil="Jan 15, 2025"
        onViewClick={(id) => console.log('View quote:', id)}
        onSendClick={(id) => console.log('Send quote:', id)}
        onConvertToInvoice={(id) => console.log('Convert to invoice:', id)}
      />
      
      <QuoteCard 
        id="2"
        number="QT-2025-002"
        client="David Wilson"
        jobTitle="Bathroom Leak Repair"
        total={650.00}
        status="sent"
        validUntil="Jan 20, 2025"
        sentAt="3 days ago"
        onViewClick={(id) => console.log('View quote:', id)}
        onSendClick={(id) => console.log('Resend quote:', id)}
      />
      
      <QuoteCard 
        id="3"
        number="QT-2025-003"
        client="Emma Thompson"
        jobTitle="Hot Water System Installation"
        total={1200.00}
        status="accepted"
        sentAt="1 week ago"
        onViewClick={(id) => console.log('View quote:', id)}
        onConvertToInvoice={(id) => console.log('Convert to invoice:', id)}
      />
    </div>
  );
}