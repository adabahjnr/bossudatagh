import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { cedi, shortDate } from "@/lib/format";
import { Wallet, TrendingUp, ShoppingBag, Users, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function Overview() {
  const { currentUser, state } = useStore();
  if (!currentUser) return null;
  const myOrders = state.orders.filter((o) => o.agentId === currentUser.id);
  const subagents = state.users.filter((u) => u.parentAgentId === currentUser.id);

  const stats = [
    { label: "Wallet balance", value: cedi(currentUser.walletBalance), icon: Wallet, gradient: "bg-gradient-primary" },
    { label: "Total sales", value: cedi(currentUser.totalSales ?? 0), icon: TrendingUp, gradient: "bg-gradient-gold" },
    { label: "Orders", value: myOrders.length.toString(), icon: ShoppingBag, gradient: "bg-success" },
    { label: currentUser.role === "agent" ? "Sub-agents" : "Referrals", value: (currentUser.role === "agent" ? subagents.length : currentUser.totalReferrals ?? 0).toString(), icon: Users, gradient: "bg-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, {currentUser.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground">Here's what's happening today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 shadow-soft transition-smooth hover:shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
                <div className="text-2xl font-bold mt-1">{s.value}</div>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.gradient} text-primary-foreground`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent orders</h3>
            <Link to="/dashboard/buy" className="text-sm text-primary hover:underline">Buy more →</Link>
          </div>
          {myOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No orders yet. Top up your wallet and start selling!</p>
          ) : (
            <div className="space-y-3">
              {myOrders.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <div>
                    <div className="font-medium text-sm">{o.productLabel}</div>
                    <div className="text-xs text-muted-foreground">{o.recipient} · {shortDate(o.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{cedi(o.amount)}</div>
                    <Badge variant={o.status === "delivered" ? "default" : o.status === "failed" ? "destructive" : "secondary"} className="text-xs">{o.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6 shadow-soft bg-gradient-primary text-primary-foreground">
          <Trophy className="h-7 w-7 text-accent" />
          <h3 className="mt-3 font-bold text-lg">Earn rewards</h3>
          <p className="text-sm opacity-90 mt-1">Climb the weekly leaderboard for bonus credits and elite badges.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(currentUser.badges ?? []).map((b) => (
              <Badge key={b} className="bg-white/20 hover:bg-white/30 backdrop-blur">{b}</Badge>
            ))}
            {(!currentUser.badges || currentUser.badges.length === 0) && <span className="text-xs opacity-70">No badges yet — start selling!</span>}
          </div>
          <Link to="/dashboard/leaderboard" className="block mt-4 text-sm font-medium underline-offset-4 hover:underline">View leaderboard →</Link>
        </Card>
      </div>
    </div>
  );
}