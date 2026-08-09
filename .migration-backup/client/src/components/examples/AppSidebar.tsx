import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from '../AppSidebar';

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar onLogout={() => console.log('Logout clicked')} />
        <div className="flex-1 p-8">
          <h2 className="text-2xl font-bold">Main Content Area</h2>
          <p className="text-muted-foreground mt-2">This is where the page content would appear.</p>
        </div>
      </div>
    </SidebarProvider>
  );
}