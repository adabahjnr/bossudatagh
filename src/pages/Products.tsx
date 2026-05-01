import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cedi } from "@/lib/format";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import type { DataPackage, CheckerPackage, Network } from "@/lib/types";
import { Smartphone, GraduationCap, Loader2 } from "lucide-react";

const NETWORKS: Network[] = ["MTN", "Telecel", "AirtelTigo"];
const NETWORK_COLORS: Record<Network, string> = {
  MTN: "from-yellow-400 to-yellow-600",
  Telecel: "from-red-500 to-red-700",
  AirtelTigo: "from-blue-500 to-blue-700",
};

const NETWORK_CARD: Record<Network, string> = {
  MTN: "bg-gradient-to-br from-yellow-300/30 to-yellow-500/10 border-yellow-500/50",
  Telecel: "bg-gradient-to-br from-red-500/30 to-red-700/10 border-red-500/50",
  AirtelTigo: "bg-gradient-to-br from-blue-500/30 to-blue-700/10 border-blue-500/50",
};

export default function Products() {
  const [allPackages, setAllPackages] = useState<DataPackage[]>([]);
  const [allCheckers, setAllCheckers] = useState<CheckerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "checkers" ? "checkers" : "data";
  const network = (params.get("network") as Network | null) ?? "MTN";

  const [purchase, setPurchase] = useState<{ kind: "data"; pkg: DataPackage } | { kind: "checker"; pkg: CheckerPackage } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("data_packages").select("*").eq("active", true).order("price_public"),
      supabase.from("checker_packages").select("*").eq("active", true).order("price_public"),
    ]).then(([pkgRes, chkRes]) => {
      if (cancelled) return;
      const pkgs: DataPackage[] = (pkgRes.data ?? []).map((r: any) => ({
        id: r.id,
        network: r.network,
        size: r.size,
        validity: r.validity,
        pricePublic: Number(r.price_public),
        priceAgent: Number(r.price_agent),
        active: r.active,
      }));
      const chks: CheckerPackage[] = (chkRes.data ?? []).map((r: any) => ({
        id: r.id,
        type: r.type,
        pricePublic: Number(r.price_public),
        priceAgent: Number(r.price_agent),
        stock: r.stock,
        active: r.active,
      }));
      setAllPackages(pkgs);
      setAllCheckers(chks);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const packages = useMemo(
    () => allPackages.filter((p) => p.network === network),
    [allPackages, network],
  );
  const checkers = allCheckers;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Buy Data</h1>
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
            {loading && (
              <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading packages…
              </div>
            )}
            {packages.map((p) => (
              <Card key={p.id} className={`p-6 shadow-soft transition-smooth hover:shadow-elegant hover:-translate-y-0.5 ${NETWORK_CARD[p.network]}`}>
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