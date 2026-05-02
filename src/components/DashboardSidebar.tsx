import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Wallet, ShoppingCart, Store,
  ArrowDownToLine, Trophy, Code2, Settings, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarHeader,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const allItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard, roles: ["agent", "subagent"] },
  { title: "Wallet", url: "/dashboard/wallet", icon: Wallet, roles: ["agent", "subagent"] },
  { title: "Buy products", url: "/dashboard/buy", icon: ShoppingCart, roles: ["agent", "subagent"] },
  { title: "My Store", url: "/dashboard/store", icon: Store, roles: ["agent"] },
  { title: "Withdrawals", url: "/dashboard/withdrawals", icon: ArrowDownToLine, roles: ["agent", "subagent"] },
  { title: "Leaderboard", url: "/dashboard/leaderboard", icon: Trophy, roles: ["agent", "subagent"] },
  { title: "API & Docs", url: "/dashboard/api", icon: Code2, roles: ["agent"] },
  { title: "Settings", url: "/dashboard/settings", icon: Settings, roles: ["agent", "subagent"] },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { currentUser, logout } = useStore();
  const nav = useNavigate();

  const items = allItems.filter((i) => currentUser && i.roles.includes(currentUser.role));

  const onLogout = () => { logout(); nav("/"); };

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
                  <SidebarMenuButton asChild isActive={pathname === i.url}>
                    <NavLink to={i.url} end className="flex items-center gap-2">
                      <i.icon className="h-4 w-4" />
                      {!collapsed && <span>{i.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-2 mt-auto pb-4">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" /> {!collapsed && "Sign out"}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}