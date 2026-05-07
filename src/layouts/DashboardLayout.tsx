import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Badge } from "@/components/ui/badge";

export default function DashboardLayout() {
  const { currentUser } = useStore();
  const { user, profile, roles, loading } = useAuth();

  // Only block rendering while we truly don't know the auth state yet (no user resolved).
  if (loading && !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Loading dashboard...</p>
          <p className="text-sm text-muted-foreground">Please wait a moment</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles.includes("admin")) return <Navigate to="/admin" replace />;

  // Redirect unactivated agents to activation page
  if (roles.includes("agent") && !profile?.agent_activated) {
    return <Navigate to="/activate-agent" replace />;
  }

  const role = roles.includes("subagent") ? "subagent" : "agent";
  const displayUser = currentUser ?? {
    id: user.id,
    name: profile?.name || user.email?.split("@")[0] || "Agent",
    email: user.email || "",
    phone: profile?.phone || "",
    role,
    walletBalance: Number(profile?.wallet_balance ?? 0),
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center px-3 gap-3">
            <SidebarTrigger />
            <div className="flex-1 flex items-center gap-3">
              <Badge variant={displayUser.role === "agent" ? "default" : "secondary"}>{displayUser.role.toUpperCase()}</Badge>
              <span className="text-sm font-medium hidden sm:inline">{displayUser.name}</span>
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