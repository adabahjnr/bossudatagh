import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useStore } from "@/lib/store";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Badge } from "@/components/ui/badge";

export default function DashboardLayout() {
  const { currentUser } = useStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === "admin") return <Navigate to="/admin" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center px-3 gap-3">
            <SidebarTrigger />
            <div className="flex-1 flex items-center gap-3">
              <Badge variant={currentUser.role === "agent" ? "default" : "secondary"}>{currentUser.role.toUpperCase()}</Badge>
              <span className="text-sm font-medium hidden sm:inline">{currentUser.name}</span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <WhatsAppButton />
      </div>
    </SidebarProvider>
  );
}