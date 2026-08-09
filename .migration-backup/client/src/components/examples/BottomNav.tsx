import BottomNav from '../BottomNav';

export default function BottomNavExample() {
  return (
    <div className="relative h-screen bg-background">
      <div className="p-8">
        <h2 className="text-2xl font-bold">Mobile View</h2>
        <p className="text-muted-foreground mt-2">
          The bottom navigation appears at the bottom of the screen on mobile devices.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Try clicking the navigation items below to see the active state change.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}