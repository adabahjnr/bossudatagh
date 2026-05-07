import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  LayoutDashboard, ShoppingBag, Package, Users,
  ArrowDownToLine, Bell, Gift, Settings, LogOut, Wrench,
} from "lucide-react";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/packages", label: "Data Packages", icon: Package },
  { to: "/admin/agents", label: "Agents", icon: Users },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/admin/campaigns", label: "Free Data", icon: Gift },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/maintenance", label: "Maintenance", icon: Wrench },
];

export default function AdminLayout() {
  const { currentUser, state } = useStore();
  const { user, roles, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const onSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not sign out cleanly. Redirecting...");
    } finally {
      nav("/login", { replace: true });
      setLoggingOut(false);
    }
  };

  // Only block rendering while we truly don't know the auth state yet.
  if (loading && !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Loading admin dashboard...</p>
          <p className="text-sm text-muted-foreground">Please wait a moment</p>
        </div>
      </div>
    );
  }
  if (!user || !roles.includes("admin")) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
        <div className="p-4 border-b border-sidebar-border"><Logo /></div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-smooth ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}>
              <i.icon className="h-4 w-4" /> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={loggingOut} onClick={onSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> {loggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center px-4 gap-3">
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold">Admin</span>
            {state.settings.maintenanceMode && <span className="text-xs px-2 py-0.5 rounded bg-warning text-warning-foreground font-semibold">MAINTENANCE</span>}
          </div>
          <ThemeToggle />
        </header>
        {/* mobile nav */}
        <div className="md:hidden border-b border-border overflow-x-auto">
          <div className="flex gap-1 p-2">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end}
                className={({ isActive }) => `whitespace-nowrap px-3 py-1.5 rounded-md text-xs ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {i.label}
              </NavLink>
            ))}
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}