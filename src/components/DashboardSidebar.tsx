import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Wallet, ShoppingCart, Store,
  ArrowDownToLine, Trophy, Code2, Settings, LogOut, Package, Users, Palette,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarHeader,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const allItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, roles: ["agent", "subagent"] },
  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet, roles: ["agent", "subagent"] },
  { title: "Buy products", url: "/dashboard/buy", icon: ShoppingCart, roles: ["agent", "subagent"] },
  { title: "My Store", url: "/dashboard/store", icon: Store, roles: ["agent"] },
  { title: "Store Packages", url: "/dashboard/store/packages", icon: Package, roles: ["agent"] },
  { title: "Sub-agents", url: "/dashboard/subagents", icon: Users, roles: ["agent"] },
  { title: "Flyer Generator", url: "/dashboard/flyer", icon: Palette, roles: ["agent", "subagent"] },
  { title: "Withdrawals", url: "/dashboard/withdrawals", icon: ArrowDownToLine, roles: ["agent", "subagent"] },
  { title: "Leaderboard", url: "/dashboard/leaderboard", icon: Trophy, roles: ["agent", "subagent"] },
  { title: "API & Docs", url: "/dashboard/api", icon: Code2, roles: ["agent"] },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, roles: ["agent", "subagent"] },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { currentUser } = useStore();
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const items = allItems.filter((i) => currentUser && i.roles.includes(currentUser.role));

  const onLogout = async () => {
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-2 py-2">
          {!collapsed ? <Logo /> : (
            <div className="grid h-9 w-9 mx-auto place-items-center rounded-xl bg-gradient-primary text-primary-foreground">⚡</div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{currentUser?.role === "subagent" ? "Sub-agent" : "Agent"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={pathname === i.url} className="p-0 h-auto">
                    <NavLink
                      to={i.url}
                      end
                      className={({ isActive }) =>
                        `w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-smooth ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`
                      }
                    >
                      <i.icon className="h-4 w-4" />
                      {!collapsed && <span className="font-semibold">{i.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-2 mt-auto pb-4">
          <Button variant="ghost" size="sm" className="w-full justify-start font-semibold" disabled={loggingOut} onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" /> {!collapsed && (loggingOut ? "Signing out..." : "Sign out")}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}