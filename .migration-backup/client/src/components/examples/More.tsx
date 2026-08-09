import More from '../More';

export default function MoreExample() {
  return (
    <div className="min-h-screen bg-background">
      <More 
        onNavigate={(path) => console.log('Navigate to:', path)}
        onLogout={() => console.log('Logout clicked')}
        onSupport={() => console.log('Support clicked')}
        onUpgrade={() => console.log('Upgrade clicked')}
      />
    </div>
  );
}