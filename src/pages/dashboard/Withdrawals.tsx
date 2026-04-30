import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { cedi, shortDate } from "@/lib/format";
import { toast } from "sonner";
import type { Network } from "@/lib/types";

export default function Withdrawals() {
  const { state, currentUser, requestWithdrawal } = useStore();
  const [form, setForm] = useState({ amount: "", momoNumber: "", network: "MTN" as Network, accountName: "" });
  if (!currentUser) return null;

  const min = state.settings.minWithdrawal;
  const my = state.withdrawals.filter((w) => w.agentId === currentUser.id);

  const submit = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt < min) { toast.error(`Minimum withdrawal is ${cedi(min)}`); return; }
    if (amt > currentUser.walletBalance) { toast.error("Amount exceeds wallet balance"); return; }
    if (!/^0\d{9}$/.test(form.momoNumber)) { toast.error("Invalid mobile money number"); return; }
    if (!form.accountName) { toast.error("Account name is required"); return; }
    requestWithdrawal({ agentId: currentUser.id, amount: amt, momoNumber: form.momoNumber, network: form.network, accountName: form.accountName });
    toast.success("Withdrawal request submitted. Admin will process shortly.");
    setForm({ amount: "", momoNumber: "", network: "MTN", accountName: "" });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-muted-foreground">Cash out your earnings to mobile money. Minimum {cedi(min)}.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-soft space-y-4">
          <h3 className="font-semibold">Request withdrawal</h3>
          <div className="rounded-lg bg-muted p-3 text-sm">Available: <span className="font-bold">{cedi(currentUser.walletBalance)}</span></div>
          <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>MoMo number</Label><Input value={form.momoNumber} onChange={(e) => setForm({ ...form, momoNumber: e.target.value })} maxLength={10} /></div>
          <div>
            <Label>Network</Label>
            <Select value={form.network} onValueChange={(v: Network) => setForm({ ...form, network: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MTN">MTN</SelectItem>
                <SelectItem value="Telecel">Telecel</SelectItem>
                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Account name</Label><Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></div>
          <Button className="w-full bg-gradient-primary" onClick={submit}>Submit request</Button>
        </Card>

        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold mb-4">Your requests</h3>
          {my.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {my.map((w) => (
                <div key={w.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                  <div>
                    <div className="font-semibold">{cedi(w.amount)}</div>
                    <div className="text-xs text-muted-foreground">{w.network} · {w.momoNumber}</div>
                    <div className="text-xs text-muted-foreground">{shortDate(w.createdAt)}</div>
                  </div>
                  <Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>{w.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}