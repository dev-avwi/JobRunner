import ClientCard from '../ClientCard';

export default function ClientCardExample() {
  return (
    <div className="space-y-4 p-4 max-w-md">
      <ClientCard 
        id="1"
        name="Sarah Johnson"
        email="sarah.johnson@email.com"
        phone="(07) 4123 4567"
        address="15 Oak Street, Cairns"
        jobsCount={3}
        lastJobDate="2 days ago"
        onView={() => {}}
        onCreateJob={() => {}}
        onCall={() => {}}
        onEmail={() => {}}
      />
      
      <ClientCard 
        id="2"
        name="David Wilson"
        email="d.wilson@email.com"
        phone="(07) 4987 6543"
        address="8 Pine Avenue, Trinity Beach"
        jobsCount={1}
        lastJobDate="1 week ago"
        onView={() => {}}
        onCreateJob={() => {}}
        onCall={() => {}}
        onEmail={() => {}}
      />
      
      <ClientCard 
        id="3"
        name="Emma Thompson"
        phone="(07) 4555 7890"
        address="22 Beach Road, Palm Cove"
        jobsCount={2}
        lastJobDate="3 weeks ago"
        onView={() => {}}
        onCreateJob={() => {}}
        onCall={() => {}}
        onEmail={() => {}}
      />
    </div>
  );
}