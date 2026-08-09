import Header from '../Header';
import { useState } from 'react';

export default function HeaderExample() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div className="space-y-4">
      <Header 
        title="Dashboard"
        showSearch={true}
        showAddButton={true}
        addButtonText="New Job"
        onAddClick={() => console.log('Add clicked')}
        onThemeToggle={() => {
          setIsDarkMode(!isDarkMode);
          console.log('Theme toggled:', !isDarkMode);
        }}
        isDarkMode={isDarkMode}
        onProfileClick={() => console.log('Profile clicked')}
        onSettingsClick={() => console.log('Settings clicked')}
        onLogoutClick={() => console.log('Logout clicked')}
      />
      
      <div className="p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          This header shows with search, add button, and notifications. Try clicking the theme toggle to see the icon change.
        </p>
      </div>
      
      <Header 
        title="Jobs"
        showSearch={false}
        showAddButton={true}
        addButtonText="Create Job"
        onAddClick={() => console.log('Create Job clicked')}
        onThemeToggle={() => setIsDarkMode(!isDarkMode)}
        isDarkMode={isDarkMode}
      />
      
      <div className="p-4 bg-muted/30 rounded-lg">
        <p className="text-sm text-muted-foreground">
          This header variant shows without search but with an add button and no notifications.
        </p>
      </div>
    </div>
  );
}