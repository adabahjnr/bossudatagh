import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { cedi } from "@/lib/format";
import { Trophy, Medal, Award } from "lucide-react";

export default function Leaderboard() {
  const { state, currentUser } = useStore();
  const ranked = [...state.users.filter((u) => u.role === "agent")].sort((a, b) => (b.totalSales ?? 0) - (a.totalSales ?? 0));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Weekly leaderboard 🏆</h1>
        <p className="text-muted-foreground">Top agents this week. Rewards distributed every Sunday.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ranked.slice(0, 3).map((u, i) => {
          const Icon = [Trophy, Medal, Award][i];
          const colors = ["from-yellow-400 to-yellow-600", "from-gray-300 to-gray-500", "from-amber-600 to-amber-800"];
          return (
            <Card key={u.id} className="p-6 shadow-elegant relative overflow-hidden">
              <div className={`absolute top-0 right-0 h-24 w-24 -mr-8 -mt-8 rounded-full bg-gradient-to-br ${colors[i]} opacity-20`} />
              <Icon className={`h-10 w-10 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
              <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3">Rank #{i + 1}</div>
              <div className="font-bold text-lg">{u.name}</div>
              <div className="text-2xl font-bold text-gradient-primary mt-1">{cedi(u.totalSales ?? 0)}</div>
              <div className="flex flex-wrap gap-1 mt-3">
                {(u.badges ?? []).map((b) => <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>)}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-soft overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Full ranking</div>
        <div className="divide-y divide-border">
          {ranked.map((u, i) => (
            <div key={u.id} className={`p-4 flex items-center justify-between gap-4 ${u.id === currentUser?.id ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="w-6 text-center font-bold text-muted-foreground">{i + 1}</div>
                <div>
                  <div className="font-medium">{u.name}{u.id === currentUser?.id && <span className="text-xs text-primary ml-2">(you)</span>}</div>
                  <div className="text-xs text-muted-foreground">{u.totalReferrals ?? 0} referrals</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{cedi(u.totalSales ?? 0)}</div>
                <div className="text-xs text-muted-foreground">in sales</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}