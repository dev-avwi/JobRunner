import CalendarView from '../CalendarView';

export default function CalendarViewExample() {
  return (
    <div className="min-h-screen bg-background">
      <CalendarView 
        onCreateJob={() => console.log('Create job clicked')}
        onViewJob={(id) => console.log('View job:', id)}
        onEditJob={(id) => console.log('Edit job:', id)}
      />
    </div>
  );
}