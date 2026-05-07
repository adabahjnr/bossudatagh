import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import type {
  AgentStorePackage,
  CheckerPackage,
  DataPackage,
  FreeDataCampaign,
  Network,
  Notification,
  Order,
  SiteSettings,
  User,
  WithdrawalRequest,
} from "@/lib/types";

const defaultSettings: SiteSettings = {
  siteName: "GetEasyData",
  whatsappNumber: "",
  whatsappChannelLink: "",
  agentFee: 50,
  agentActivationFee: 50,
  minWithdrawal: 50,
  maintenanceMode: false,
  maintenanceMessage: "",
};

function mapNetwork(input: string | null | undefined): Network {
  const n = (input ?? "").toUpperCase();
  if (n === "MTN") return "MTN";
  if (n === "TELECEL") return "Telecel";
  return "AirtelTigo";
}

function parseSettings(rows: Array<{ key: string; value: unknown }>): SiteSettings {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const agentFee = Number(byKey.get("agent_fee") ?? defaultSettings.agentFee);
  return {
    siteName: String(byKey.get("site_name") ?? defaultSettings.siteName),
    whatsappNumber: String(byKey.get("whatsapp_number") ?? defaultSettings.whatsappNumber),
    whatsappChannelLink: String(byKey.get("whatsapp_channel") ?? defaultSettings.whatsappChannelLink),
    agentFee,
    agentActivationFee: Number(byKey.get("agent_activation_fee") ?? agentFee),
    minWithdrawal: Number(byKey.get("min_withdrawal") ?? defaultSettings.minWithdrawal),
    maintenanceMode: Boolean(byKey.get("maintenance_mode") ?? defaultSettings.maintenanceMode),
    maintenanceMessage: String(byKey.get("maintenance_message") ?? defaultSettings.maintenanceMessage),
    banner: (byKey.get("banner") as string | null) ?? undefined,
  };
}

export function SupabaseDataBridge() {
  const { setState } = useStore();

  useEffect(() => {
    let mounted = true;

    const syncAll = async () => {
      const [
        profilesRes,
        storesRes,
        bundlesRes,
        agentPackagesRes,
        checkersRes,
        ordersRes,
        withdrawalsRes,
        campaignsRes,
        codesRes,
        notificationsRes,
        settingsRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,role,name,phone,store_slug,store_template,store_logo,store_brand,parent_agent_id,api_key,referral_code,wallet_balance,total_sales,total_referrals,badges,active,agent_activated,activation_paid_at,created_at"),
        supabase.from("stores").select("agent_id,slug,brand_name,logo_url,template"),
        supabase.from("data_bundles").select("id,network,label,validity_days,price_public,price_agent,active").order("sort_order", { ascending: true }),
        supabase.from("agent_packages").select("id,agent_id,bundle_id,sale_price,active,created_at,updated_at"),
        supabase.from("checker_packages").select("id,checker_type,price_public,price_agent,stock,active"),
        supabase.from("orders").select("id,ref,product_label,network,recipient_phone,guest_email,amount,status,created_at,buyer_type,agent_id,fulfillment_error").order("created_at", { ascending: false }),
        supabase.from("withdrawals").select("id,agent_id,amount,momo_number,momo_network,account_name,status,created_at,profiles:agent_id(name)").order("created_at", { ascending: false }),
        supabase.from("free_data_campaigns").select("id,name,data_size,network,total_codes,redeemed_count,active,created_at").order("created_at", { ascending: false }),
        supabase.from("campaign_codes").select("campaign_id,code,redeemed,redeemed_by"),
        supabase.from("notifications").select("id,title,message,type,audience,created_at").order("created_at", { ascending: false }),
        supabase.from("site_settings").select("key,value"),
      ]);

      if (!mounted) return;

      const storesByAgent = new Map<string, { slug: string | null; brand_name: string | null; logo_url: string | null; template: string | null }>();
      (storesRes.data ?? []).forEach((row: any) => {
        storesByAgent.set(row.agent_id, {
          slug: row.slug ?? null,
          brand_name: row.brand_name ?? null,
          logo_url: row.logo_url ?? null,
          template: row.template ?? null,
        });
      });

      const users: User[] = (profilesRes.data ?? []).map((row: any) => {
        const store = storesByAgent.get(row.id);
        const role = row.role === "admin" ? "admin" : row.role === "subagent" ? "subagent" : "agent";
        return {
          id: row.id,
          name: row.name ?? "Agent",
          email: "",
          phone: row.phone ?? "",
          role,
          walletBalance: Number(row.wallet_balance ?? 0),
          storeSlug: store?.slug ?? row.store_slug ?? undefined,
          storeTemplate: (store?.template ?? row.store_template ?? "neon") as User["storeTemplate"],
          storeLogo: store?.logo_url ?? row.store_logo ?? undefined,
          storeBrand: store?.brand_name ?? row.store_brand ?? undefined,
          parentAgentId: row.parent_agent_id ?? undefined,
          apiKey: row.api_key ?? undefined,
          referralCode: row.referral_code ?? undefined,
          totalSales: Number(row.total_sales ?? 0),
          totalReferrals: Number(row.total_referrals ?? 0),
          badges: Array.isArray(row.badges) ? row.badges : [],
          agentActivated: row.agent_activated ?? false,
          activationPaidAt: row.activation_paid_at ?? undefined,
          createdAt: row.created_at ?? new Date().toISOString(),
          active: row.active ?? true,
        };
      });

      const packages: DataPackage[] = (bundlesRes.data ?? []).map((row: any) => ({
        id: row.id,
        network: mapNetwork(row.network),
        size: String(row.label ?? ""),
        validity: row.validity_days ? `${row.validity_days} days` : "Non-expiry",
        pricePublic: Number(row.price_public ?? 0),
        priceAgent: Number(row.price_agent ?? 0),
        active: row.active ?? true,
      }));

      const agentStorePackages: AgentStorePackage[] = (agentPackagesRes.data ?? [])
        .filter((row: any) => Boolean(row.bundle_id))
        .map((row: any) => ({
          id: row.id,
          agentId: row.agent_id,
          packageId: row.bundle_id,
          salePrice: Number(row.sale_price ?? 0),
          active: row.active ?? true,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

      const checkers: CheckerPackage[] = (checkersRes.data ?? []).map((row: any) => ({
        id: row.id,
        type: row.checker_type,
        pricePublic: Number(row.price_public ?? 0),
        priceAgent: Number(row.price_agent ?? 0),
        stock: Number(row.stock ?? 0),
        active: row.active ?? true,
      }));

      const orders: Order[] = (ordersRes.data ?? []).map((row: any) => ({
        id: row.id,
        ref: row.ref,
        productLabel: row.product_label,
        network: row.network ? mapNetwork(row.network) : undefined,
        recipient: row.recipient_phone,
        email: row.guest_email ?? undefined,
        amount: Number(row.amount ?? 0),
        status: row.status,
        fulfillmentErrorMessage: row.fulfillment_error ?? undefined,
        createdAt: row.created_at,
        buyerType: row.buyer_type === "agent" || row.buyer_type === "subagent" ? row.buyer_type : "public",
        agentId: row.agent_id ?? undefined,
      }));

      const withdrawals: WithdrawalRequest[] = (withdrawalsRes.data ?? []).map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.profiles?.name ?? "Unknown",
        amount: Number(row.amount ?? 0),
        momoNumber: row.momo_number,
        network: mapNetwork(row.momo_network),
        accountName: row.account_name,
        status: row.status,
        createdAt: row.created_at,
      }));

      const codesByCampaign = new Map<string, Array<{ code: string; redeemed: boolean; redeemedBy?: string }>>();
      (codesRes.data ?? []).forEach((row: any) => {
        const list = codesByCampaign.get(row.campaign_id) ?? [];
        list.push({
          code: row.code,
          redeemed: row.redeemed ?? false,
          redeemedBy: row.redeemed_by ?? undefined,
        });
        codesByCampaign.set(row.campaign_id, list);
      });

      const campaigns: FreeDataCampaign[] = (campaignsRes.data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        dataSize: row.data_size,
        network: mapNetwork(row.network),
        totalCodes: Number(row.total_codes ?? 0),
        redeemed: Number(row.redeemed_count ?? 0),
        codes: codesByCampaign.get(row.id) ?? [],
        active: row.active ?? true,
        createdAt: row.created_at,
      }));

      const notifications: Notification[] = (notificationsRes.data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.type,
        audience: row.audience,
        createdAt: row.created_at,
      }));

      const settings = parseSettings(settingsRes.data ?? []);

      setState((prev) => ({
        ...prev,
        users,
        packages,
        agentStorePackages,
        checkers,
        orders,
        withdrawals,
        campaigns,
        notifications,
        settings,
      }));
    };

    // Defer initial sync so auth bootstrap completes first.
    const initialTimer = setTimeout(() => {
      void syncAll();
    }, 800);

    const interval = setInterval(() => {
      void syncAll();
    }, 60000);

    let lastSync = 0;
    const onVisible = () => {
      if (document.hidden) return;
      const now = Date.now();
      // Only refetch if it's been at least 30s since last sync to avoid hammering.
      if (now - lastSync > 30000) {
        lastSync = now;
        void syncAll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [setState]);

  return null;
}
