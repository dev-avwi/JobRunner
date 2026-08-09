import QuotesList from '../QuotesList';

export default function QuotesListExample() {
  return (
    <div className="min-h-screen bg-background">
      <QuotesList 
        onCreateQuote={() => console.log('Create quote clicked')}
        onViewQuote={(id) => console.log('View quote:', id)}
        onSendQuote={(id) => console.log('Send quote:', id)}
        onConvertToInvoice={(id) => console.log('Convert to invoice:', id)}
      />
    </div>
  );
}