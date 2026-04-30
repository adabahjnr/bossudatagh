import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { cedi, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export default function WalletPage() {
  const { currentUser, topUpWallet, state } = useStore();
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  if (!currentUser) return null;

  const onTopUp = () => {
    const n = parseFloat(amount);
    if (!n || n < 5) { toast.error("Minimum top-up is ₵5"); return; }
    topUpWallet(currentUser.id, n);
    toast.success(`${cedi(n)} added (simulated)`);
    setAmount(""); setOpen(false);
  };

  const myOrders = state.orders.filter((o) => o.agentId === currentUser.id);

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="p-8 bg-gradient-primary text-primary-foreground shadow-elegant">
        <div className="text-sm uppercase tracking-wider opacity-80">Wallet balance</div>
        <div className="text-5xl font-bold mt-2">{cedi(currentUser.walletBalance)}</div>
        <div className="mt-6 flex gap-3 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-gold text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4 mr-1" /> Top up</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Top up wallet</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50" /></div>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 50, 100, 200].map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setAmount(v.toString())}>{cedi(v)}</Button>
                  ))}
                </div>
                <Button className="w-full bg-gradient-primary" onClick={onTopUp}>Pay {amount ? cedi(parseFloat(amount) || 0) : "now"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild variant="outline" className="bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20">
            <a href="/dashboard/withdrawals"><ArrowDownLeft className="h-4 w-4 mr-1" /> Withdraw</a>
          </Button>
        </div>
      </Card>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Transaction history</h3>
        {myOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {myOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive"><ArrowUpRight className="h-4 w-4" /></div>
                  <div>
                    <div className="font-medium text-sm">{o.productLabel}</div>
                    <div className="text-xs text-muted-foreground">{shortDate(o.createdAt)}</div>
                  </div>
                </div>
                <div className="font-semibold text-destructive">−{cedi(o.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}