import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { cedi } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import type { Network, DataPackage } from "@/lib/types";

const NETWORKS: Network[] = ["MTN", "Telecel", "AirtelTigo"];

export default function StorePackages() {
  const {
    state,
    currentUser,
    upsertAgentStorePackage,
    removeAgentStorePackage,
    setAgentStorePackageActive,
  } = useStore();
  const [draftPrice, setDraftPrice] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Network>("MTN");

  if (!currentUser) return null;
  const catalog = state.packages.filter((p) => p.active);
  const rows = state.agentStorePackages.filter((r) => r.agentId === currentUser.id);

  const byPkg = useMemo(() => {
    const m = new Map<string, typeof rows[number]>();
    rows.forEach((r) => m.set(r.packageId, r));
    return m;
  }, [rows]);

  const add = (pkg: DataPackage) => {
    const raw = draftPrice[pkg.id] ?? "";
    const price = Number(raw);
    if (!price || price < pkg.priceAgent) {
      toast.error(`Price must be at least ${cedi(pkg.priceAgent)} (your cost)`);
      return;
    }
    upsertAgentStorePackage({
      agentId: currentUser.id,
      packageId: pkg.id,
      salePrice: price,
      active: true,
    });
    toast.success("Added to your store");
    setDraftPrice((d) => ({ ...d, [pkg.id]: "" }));
  };

  const updatePrice = (pkgId: string, pkg: DataPackage, value: string, active: boolean) => {
    const price = Number(value);
    if (!price || price < pkg.priceAgent) {
      toast.error(`Price must be at least ${cedi(pkg.priceAgent)}`);
      return;
    }
    upsertAgentStorePackage({
      agentId: currentUser.id,
      packageId: pkgId,
      salePrice: price,
      active,
    });
    toast.success("Price updated");
  };

  const toggle = (pkgId: string, active: boolean) => {
    setAgentStorePackageActive(currentUser.id, pkgId, active);
  };

  const remove = (pkgId: string) => {
    removeAgentStorePackage(currentUser.id, pkgId);
    toast.success("Removed");
  };

  const filtered = catalog.filter((p) => p.network === tab);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Store Packages</h1>
        <p className="text-muted-foreground">
          Choose which data packages appear in your store and set your selling price.
          Your profit is the difference between your selling price and your agent cost.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Network)}>
        <TabsList>
          {NETWORKS.map((n) => <TabsTrigger key={n} value={n}>{n}</TabsTrigger>)}
        </TabsList>
        {NETWORKS.map((n) => (
          <TabsContent key={n} value={n} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm">No {n} packages available yet.</p>
            ) : filtered.map((pkg) => {
              const row = byPkg.get(pkg.id);
              const profit = row ? row.salePrice - pkg.priceAgent : 0;
              return (
                <Card key={pkg.id} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="min-w-[140px]">
                    <div className="font-semibold text-lg">{pkg.size}</div>
                    <div className="text-xs text-muted-foreground">{pkg.validity}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground text-xs">Your cost</div>
                    <div className="font-semibold">{cedi(pkg.priceAgent)}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground text-xs">Suggested public</div>
                    <div className="font-semibold">{cedi(pkg.pricePublic)}</div>
                  </div>

                  {row ? (
                    <>
                      <div className="flex items-end gap-2 ml-auto">
                        <div>
                          <Label className="text-xs">Your price</Label>
                          <Input
                            type="number"
                            defaultValue={row.salePrice}
                            className="w-28"
                            onBlur={(e) => {
                              if (Number(e.target.value) !== row.salePrice) {
                                updatePrice(pkg.id, pkg, e.target.value, row.active);
                              }
                            }}
                          />
                        </div>
                        <Badge variant="secondary" className="gap-1">
                          <TrendingUp className="h-3 w-3" /> {cedi(profit)} profit
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={row.active} onCheckedChange={(v) => toggle(pkg.id, v)} />
                        <span className="text-xs text-muted-foreground">{row.active ? "Live" : "Hidden"}</span>
                        <Button size="icon" variant="ghost" onClick={() => remove(pkg.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-end gap-2 ml-auto">
                      <div>
                        <Label className="text-xs">Your price</Label>
                        <Input
                          type="number"
                          placeholder={String(pkg.pricePublic)}
                          className="w-28"
                          value={draftPrice[pkg.id] ?? ""}
                          onChange={(e) => setDraftPrice((d) => ({ ...d, [pkg.id]: e.target.value }))}
                        />
                      </div>
                      <Button onClick={() => add(pkg)}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}