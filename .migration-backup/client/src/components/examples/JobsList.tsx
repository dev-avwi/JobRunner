import JobsList from '../JobsList';

export default function JobsListExample() {
  return (
    <div className="min-h-screen bg-background">
      <JobsList 
        onCreateJob={() => console.log('Create job clicked')}
        onViewJob={(id) => console.log('View job:', id)}
        onStatusChange={(id, status) => console.log('Status change:', id, status)}
        onGenerateQuote={(id) => console.log('Generate quote:', id)}
      />
    </div>
  );
}