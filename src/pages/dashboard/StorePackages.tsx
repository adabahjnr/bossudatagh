import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cedi } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import type { Network, DataPackage } from "@/lib/types";

interface StoreRow {
  id: string;
  package_id: string;
  sale_price: number;
  active: boolean;
}

const NETWORKS: Network[] = ["MTN", "Telecel", "AirtelTigo"];

export default function StorePackages() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<DataPackage[]>([]);
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [draftPrice, setDraftPrice] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Network>("MTN");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    const [{ data: pkgs }, { data: mine }] = await Promise.all([
      supabase.from("data_packages").select("*").eq("active", true).order("network").order("size"),
      supabase.from("agent_store_packages").select("id, package_id, sale_price, active").eq("agent_id", user.id),
    ]);
    const cat: DataPackage[] = (pkgs ?? []).map((p) => ({
      id: p.id, network: p.network as Network, size: p.size, validity: p.validity,
      pricePublic: Number(p.price_public), priceAgent: Number(p.price_agent), active: p.active,
    }));
    setCatalog(cat);
    setRows((mine ?? []).map((r) => ({ ...r, sale_price: Number(r.sale_price) })));
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [user]);

  const byPkg = useMemo(() => {
    const m = new Map<string, StoreRow>();
    rows.forEach((r) => m.set(r.package_id, r));
    return m;
  }, [rows]);

  const add = async (pkg: DataPackage) => {
    if (!user) return;
    const raw = draftPrice[pkg.id] ?? "";
    const price = Number(raw);
    if (!price || price < pkg.priceAgent) {
      toast.error(`Price must be at least ${cedi(pkg.priceAgent)} (your cost)`);
      return;
    }
    const { error } = await supabase.from("agent_store_packages").insert({
      agent_id: user.id, package_id: pkg.id, sale_price: price, active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Added to your store");
    setDraftPrice((d) => ({ ...d, [pkg.id]: "" }));
    void refresh();
  };

  const updatePrice = async (row: StoreRow, pkg: DataPackage, value: string) => {
    const price = Number(value);
    if (!price || price < pkg.priceAgent) {
      toast.error(`Price must be at least ${cedi(pkg.priceAgent)}`);
      return;
    }
    const { error } = await supabase.from("agent_store_packages").update({ sale_price: price }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Price updated");
    void refresh();
  };

  const toggle = async (row: StoreRow, active: boolean) => {
    await supabase.from("agent_store_packages").update({ active }).eq("id", row.id);
    void refresh();
  };

  const remove = async (row: StoreRow) => {
    await supabase.from("agent_store_packages").delete().eq("id", row.id);
    toast.success("Removed");
    void refresh();
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
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm">No {n} packages available yet.</p>
            ) : filtered.map((pkg) => {
              const row = byPkg.get(pkg.id);
              const profit = row ? row.sale_price - pkg.priceAgent : 0;
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
                            defaultValue={row.sale_price}
                            className="w-28"
                            onBlur={(e) => {
                              if (Number(e.target.value) !== row.sale_price) updatePrice(row, pkg, e.target.value);
                            }}
                          />
                        </div>
                        <Badge variant="secondary" className="gap-1">
                          <TrendingUp className="h-3 w-3" /> {cedi(profit)} profit
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={row.active} onCheckedChange={(v) => toggle(row, v)} />
                        <span className="text-xs text-muted-foreground">{row.active ? "Live" : "Hidden"}</span>
                        <Button size="icon" variant="ghost" onClick={() => remove(row)}>
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