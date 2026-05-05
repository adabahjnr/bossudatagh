import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import type { AgentStorePackage, DataPackage, Network } from "@/lib/types";

function mapNetwork(network: string): Network {
  if (network === "MTN" || network === "Telecel" || network === "AirtelTigo") return network;
  return "MTN";
}

export function SupabaseDataBridge() {
  const { setState } = useStore();

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      const [{ data: pkgRows }, { data: storeRows }] = await Promise.all([
        supabase
          .from("data_packages")
          .select("id,network,size,validity,price_public,price_agent,active"),
        supabase
          .from("agent_store_packages")
          .select("id,agent_id,package_id,sale_price,active,created_at,updated_at"),
      ]);

      if (!mounted) return;

      const packages: DataPackage[] = (pkgRows ?? []).map((row: any) => ({
        id: row.id,
        network: mapNetwork(row.network),
        size: row.size,
        validity: row.validity,
        pricePublic: Number(row.price_public),
        priceAgent: Number(row.price_agent),
        active: Boolean(row.active),
      }));

      const agentStorePackages: AgentStorePackage[] = (storeRows ?? []).map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        packageId: row.package_id,
        salePrice: Number(row.sale_price),
        active: Boolean(row.active),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setState((s) => ({
        ...s,
        packages,
        agentStorePackages,
      }));
    };

    void loadCatalog();

    const channel = supabase
      .channel("catalog-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "data_packages" },
        () => {
          void loadCatalog();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_store_packages" },
        () => {
          void loadCatalog();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [setState]);

  return null;
}
