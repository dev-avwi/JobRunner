import ClientsList from '../ClientsList';

export default function ClientsListExample() {
  return (
    <div className="min-h-screen bg-background">
      <ClientsList 
        onCreateClient={() => console.log('Create client clicked')}
        onViewClient={(id) => console.log('View client:', id)}
        onCreateJobForClient={(id) => console.log('Create job for client:', id)}
        onCallClient={(phone) => console.log('Call client:', phone)}
        onEmailClient={(email) => console.log('Email client:', email)}
      />
    </div>
  );
}