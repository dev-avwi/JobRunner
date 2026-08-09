import JobCard from '../JobCard';

export default function JobCardExample() {
  return (
    <div className="space-y-4 p-4 max-w-md">
      <JobCard 
        id="1"
        title="Kitchen Renovation - Plumbing"
        client="Sarah Johnson"
        address="15 Oak Street, Cairns"
        scheduledAt="Today, 2:00 PM"
        status="pending"
        assignedTo="Mike"
        hasPhotos={true}
        onViewClick={(id) => console.log('View job:', id)}
        onStatusChange={(id, status) => console.log('Status change:', id, status)}
        onGenerateQuote={(id) => console.log('Generate quote:', id)}
      />
      
      <JobCard 
        id="2"
        title="Bathroom Leak Repair"
        client="David Wilson"
        address="8 Pine Avenue, Trinity Beach"
        scheduledAt="Tomorrow, 9:00 AM"
        status="in_progress"
        onViewClick={(id) => console.log('View job:', id)}
        onStatusChange={(id, status) => console.log('Status change:', id, status)}
        onGenerateQuote={(id) => console.log('Generate quote:', id)}
      />
      
      <JobCard 
        id="3"
        title="Hot Water System Installation"
        client="Emma Thompson"
        address="22 Beach Road, Palm Cove"
        scheduledAt="Yesterday, 10:30 AM"
        status="done"
        hasPhotos={true}
        onViewClick={(id) => console.log('View job:', id)}
        onStatusChange={(id, status) => console.log('Status change:', id, status)}
        onGenerateQuote={(id) => console.log('Generate quote:', id)}
      />
    </div>
  );
}