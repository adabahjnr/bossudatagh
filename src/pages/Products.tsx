import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cedi, sizeToMB } from "@/lib/format";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import type { CheckerPackage, DataPackage, Network } from "@/lib/types";
import { Smartphone, BookOpen } from "lucide-react";

const NETWORKS: Network[] = ["MTN", "Telecel", "AirtelTigo"];

const NETWORK_STYLE: Record<Network, {
  card: string; badge: string; networkLabel: string;
  size: string; meta: string; priceLabel: string; price: string; btn: string;
}> = {
  MTN: {
    card: "bg-yellow-400 border-yellow-500",
    badge: "bg-yellow-500 text-black border-yellow-600",
    networkLabel: "bg-yellow-500 text-black",
    size: "text-black",
    meta: "text-yellow-900",
    priceLabel: "text-yellow-900",
    price: "text-black",
    btn: "bg-yellow-900 text-white hover:bg-yellow-800",
  },
  Telecel: {
    card: "bg-red-600 border-red-700",
    badge: "bg-red-700 text-white border-red-800",
    networkLabel: "bg-red-700 text-white",
    size: "text-white",
    meta: "text-red-100",
    priceLabel: "text-red-100",
    price: "text-white",
    btn: "bg-white text-red-700 hover:bg-red-50",
  },
  AirtelTigo: {
    card: "bg-blue-700 border-blue-800",
    badge: "bg-blue-800 text-white border-blue-900",
    networkLabel: "bg-blue-800 text-white",
    size: "text-white",
    meta: "text-blue-100",
    priceLabel: "text-blue-100",
    price: "text-white",
    btn: "bg-white text-blue-700 hover:bg-blue-50",
  },
};

export default function Products() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const network = (params.get("network") as Network | null) ?? "MTN";

  const [purchase, setPurchase] = useState<{ kind: "data"; pkg: DataPackage } | { kind: "checker"; pkg: CheckerPackage } | null>(null);
  const packages = useMemo(
    () =>
      state.packages
        .filter((p) => p.network === network && p.active)
        .slice()
        .sort((a, b) => sizeToMB(a.size) - sizeToMB(b.size)),
    [state.packages, network],
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Buy Data</h1>
        <p className="mt-2 text-muted-foreground">No signup required. Pay and receive in seconds.</p>
      </div>

      <Tabs value={params.get("tab") ?? "data"} onValueChange={(v) => setParams({ tab: v, network })}>
        <TabsList className="mx-auto mb-8 flex w-fit">
          <TabsTrigger value="data"><Smartphone className="h-4 w-4 mr-2" /> Data Bundles</TabsTrigger>
          <TabsTrigger value="checkers"><BookOpen className="h-4 w-4 mr-2" /> Result Checkers</TabsTrigger>
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
            {packages.map((p) => {
              const ns = NETWORK_STYLE[p.network];
              return (
                <Card key={p.id} className={`p-6 shadow-soft transition-smooth hover:shadow-elegant hover:-translate-y-0.5 ${ns.card}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${ns.networkLabel}`}>{p.network}</div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${ns.badge}`}>{p.validity}</span>
                  </div>
                  <div className={`text-3xl font-bold ${ns.size}`}>{p.size}</div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className={`text-xs ${ns.priceLabel}`}>Price</div>
                      <div className={`text-2xl font-bold ${ns.price}`}>{cedi(p.pricePublic)}</div>
                    </div>
                    <Button className={ns.btn} onClick={() => setPurchase({ kind: "data", pkg: p })}>Buy</Button>
                  </div>
                </Card>
              );
            })}
            {packages.length === 0 && <p className="text-muted-foreground col-span-full text-center">No packages available right now.</p>}
          </div>
        </TabsContent>

        <TabsContent value="checkers">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.checkers.filter((c) => c.active).map((c) => (
              <Card key={c.id} className="p-6 shadow-soft transition-smooth hover:shadow-elegant hover:-translate-y-0.5 bg-gradient-to-br from-card to-secondary border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">{c.type} Checker</div>
                    <div className="text-xs text-muted-foreground">{c.stock} in stock</div>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Price</div>
                    <div className="text-2xl font-bold text-accent">{cedi(c.pricePublic)}</div>
                  </div>
                  <Button
                    disabled={c.stock === 0}
                    onClick={() => setPurchase({ kind: "checker", pkg: c })}
                  >
                    {c.stock === 0 ? "Out of stock" : "Buy"}
                  </Button>
                </div>
              </Card>
            ))}
            {state.checkers.filter((c) => c.active).length === 0 && (
              <p className="text-muted-foreground col-span-full text-center">No checkers available right now.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <PurchaseDialog item={purchase} open={!!purchase} onOpenChange={(o) => !o && setPurchase(null)} pricing="public" />
    </div>
  );
}