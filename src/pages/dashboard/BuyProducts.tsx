import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cedi } from "@/lib/format";
import { toast } from "sonner";
import type { Network } from "@/lib/types";

const NETS: Network[] = ["MTN", "Telecel", "AirtelTigo"];

export default function BuyProducts() {
  const { state, currentUser, deductWallet, placeOrder } = useStore();
  const [net, setNet] = useState<Network>("MTN");
  const [recipient, setRecipient] = useState("");

  const packages = useMemo(() => state.packages.filter((p) => p.active && p.network === net), [state.packages, net]);

  const buyData = (id: string) => {
    if (!currentUser) return;
    const pkg = state.packages.find((p) => p.id === id);
    if (!pkg) return;
    if (!/^0\d{9}$/.test(recipient)) { toast.error("Enter a valid recipient phone"); return; }
    if (!deductWallet(currentUser.id, pkg.priceAgent)) { toast.error("Insufficient wallet balance. Top up first."); return; }
    placeOrder({
      productLabel: `${pkg.network} ${pkg.size}`, network: pkg.network,
      recipient, amount: pkg.priceAgent, buyerType: "agent", agentId: currentUser.id,
    });
    toast.success(`Order placed for ${recipient}`);
    setRecipient("");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Buy products</h1>
        <p className="text-muted-foreground">Wallet-deducted at agent prices. Instant delivery.</p>
      </div>

      <Card className="p-4 shadow-soft">
        <label className="text-sm font-medium">Recipient phone number</label>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0244000000" maxLength={10}
          className="mt-2 w-full rounded-md border border-input bg-background h-10 px-3" />
      </Card>

      <Tabs defaultValue="data">
        <TabsList><TabsTrigger value="data">Data</TabsTrigger></TabsList>
        <TabsContent value="data">
          <div className="flex gap-2 mb-4 flex-wrap">
            {NETS.map((n) => (
              <button key={n} onClick={() => setNet(n)}
                className={`px-4 py-1.5 rounded-full text-sm border ${net === n ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{n}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <Card key={p.id} className="p-5 shadow-soft hover:shadow-elegant transition-smooth">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{p.network}</div>
                    <div className="text-2xl font-bold">{p.size}</div>
                    <div className="text-xs text-muted-foreground">{p.validity}</div>
                  </div>
                  <Badge variant="outline">Agent</Badge>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-xl font-bold text-gradient-primary">{cedi(p.priceAgent)}</div>
                  <Button size="sm" onClick={() => buyData(p.id)}>Buy</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}