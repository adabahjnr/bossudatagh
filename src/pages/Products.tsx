import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cedi } from "@/lib/format";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import type { DataPackage, CheckerPackage, Network } from "@/lib/types";
import { Smartphone, GraduationCap } from "lucide-react";

const NETWORKS: Network[] = ["MTN", "Telecel", "AirtelTigo"];
const NETWORK_COLORS: Record<Network, string> = {
  MTN: "from-yellow-400 to-yellow-600",
  Telecel: "from-red-500 to-red-700",
  AirtelTigo: "from-blue-500 to-blue-700",
};

export default function Products() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "checkers" ? "checkers" : "data";
  const network = (params.get("network") as Network | null) ?? "MTN";

  const [purchase, setPurchase] = useState<{ kind: "data"; pkg: DataPackage } | { kind: "checker"; pkg: CheckerPackage } | null>(null);

  const packages = useMemo(
    () => state.packages.filter((p) => p.active && p.network === network),
    [state.packages, network],
  );
  const checkers = useMemo(() => state.checkers.filter((c) => c.active), [state.checkers]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pick a product</h1>
        <p className="mt-2 text-muted-foreground">No signup required. Pay and receive in seconds.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v, ...(v === "data" ? { network } : {}) })}>
        <TabsList className="mx-auto mb-8 flex w-fit">
          <TabsTrigger value="data"><Smartphone className="h-4 w-4 mr-2" /> Data Bundles</TabsTrigger>
          <TabsTrigger value="checkers"><GraduationCap className="h-4 w-4 mr-2" /> Result Checkers</TabsTrigger>
        </TabsList>

        <TabsContent value="data">
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {NETWORKS.map((n) => (
              <button
                key={n}
                onClick={() => setParams({ tab: "data", network: n })}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-smooth border ${
                  network === n ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <Card key={p.id} className="p-6 shadow-soft transition-smooth hover:shadow-elegant hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${NETWORK_COLORS[p.network]}`}>{p.network}</div>
                  <Badge variant="secondary">{p.validity}</Badge>
                </div>
                <div className="text-3xl font-bold">{p.size}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Price</div>
                    <div className="text-2xl font-bold text-gradient-primary">{cedi(p.pricePublic)}</div>
                  </div>
                  <Button onClick={() => setPurchase({ kind: "data", pkg: p })}>Buy</Button>
                </div>
              </Card>
            ))}
            {packages.length === 0 && <p className="text-muted-foreground col-span-full text-center">No packages available right now.</p>}
          </div>
        </TabsContent>

        <TabsContent value="checkers">
          <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
            {checkers.map((c) => (
              <Card key={c.id} className="p-6 shadow-soft transition-smooth hover:shadow-elegant">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white mb-4">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div className="text-2xl font-bold">{c.type} Checker PIN</div>
                <div className="text-sm text-muted-foreground mt-1">In stock: {c.stock}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-2xl font-bold text-gradient-primary">{cedi(c.pricePublic)}</div>
                  <Button onClick={() => setPurchase({ kind: "checker", pkg: c })}>Buy</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <PurchaseDialog item={purchase} open={!!purchase} onOpenChange={(o) => !o && setPurchase(null)} pricing="public" />
    </div>
  );
}