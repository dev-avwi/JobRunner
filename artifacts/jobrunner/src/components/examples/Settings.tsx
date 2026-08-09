import Settings from '../Settings';

export default function SettingsExample() {
  return (
    <div className="min-h-screen bg-background">
      <Settings 
        onSave={(data) => console.log('Settings saved:', data)}
        onUploadLogo={(file) => console.log('Logo uploaded:', file.name)}
        onUpgradePlan={() => console.log('Upgrade plan clicked')}
      />
    </div>
  );
}