import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, bottomNav, children }: AppShellProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        {sidebar}
        <div className="flex flex-col flex-1 w-full min-w-0">
          {header}
          <main className="flex-1 overflow-y-auto w-full">
            {children}
          </main>
          {bottomNav}
        </div>
      </div>
    </SidebarProvider>
  );
}
