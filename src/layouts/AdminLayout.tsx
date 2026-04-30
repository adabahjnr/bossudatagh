import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingBag, Package, GraduationCap, Users,
  ArrowDownToLine, Bell, Gift, Settings, LogOut, Wrench,
} from "lucide-react";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/packages", label: "Data Packages", icon: Package },
  { to: "/admin/checkers", label: "Checkers", icon: GraduationCap },
  { to: "/admin/agents", label: "Agents", icon: Users },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/admin/campaigns", label: "Free Data", icon: Gift },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/maintenance", label: "Maintenance", icon: Wrench },
];

export default function AdminLayout() {
  const { currentUser, logout, state } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  if (!currentUser || currentUser.role !== "admin") return <Navigate to="/login" replace />;

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
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { logout(); nav("/"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
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
          <Outlet key={loc.pathname} />
        </main>
      </div>
    </div>
  );
}