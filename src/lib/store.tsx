import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AgentStorePackage,
  CheckerPackage,
  DataPackage,
  FreeDataCampaign,
  Notification,
  Order,
  SiteSettings,
  User,
  WithdrawalRequest,
} from "./types";
import { genApiKey, genRef } from "./format";
import { sizeToMB } from "./format";

const parseValidityDays = (v: string): number => {
  const m = v.match(/(\d+)\s*day/i);
  return m ? parseInt(m[1], 10) : 30;
};

const KEY = "geteasydata.state.v2";

const defaultSiteSettings: SiteSettings = {
  siteName: "GetEasyData",
  whatsappNumber: "",
  whatsappChannelLink: "",
  agentFee: 50,
  agentActivationFee: 50,
  minWithdrawal: 50,
  maintenanceMode: false,
  maintenanceMessage: "",
};

interface State {
  users: User[];
  packages: DataPackage[];
  agentStorePackages: AgentStorePackage[];
  checkers: CheckerPackage[];
  orders: Order[];
  withdrawals: WithdrawalRequest[];
  campaigns: FreeDataCampaign[];
  settings: SiteSettings;
  notifications: Notification[];
  currentUserId: string | null;
  redemptionsByPhone: Record<string, string[]>; // phone -> code list
}

const initialState: State = {
  users: [],
  packages: [],
  agentStorePackages: [],
  checkers: [],
  orders: [],
  withdrawals: [],
  campaigns: [],
  settings: defaultSiteSettings,
  notifications: [],
  currentUserId: null,
  redemptionsByPhone: {},
};

function load(): State {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return { ...initialState, ...parsed };
  } catch {
    return initialState;
  }
}

interface StoreCtx {
  state: State;
  setState: (updater: (s: State) => State) => void;
  currentUser: User | null;
  // Auth
  signupAgent: (input: { id?: string; name: string; email: string; phone: string; password: string; storeSlug: string }) => User;
  signupSubagent: (input: { name: string; email: string; phone: string; parentAgentId: string }) => User;
  login: (emailOrPhone: string) => User | null;
  logout: () => void;
  loginAsAdmin: () => void;
  // Orders
  placeOrder: (input: Omit<Order, "id" | "ref" | "createdAt" | "status"> & { status?: Order["status"] }) => Order;
  updateOrderStatus: (id: string, status: Order["status"]) => void;
  retryOrderFulfillment: (ref: string) => Promise<{ ok: boolean; error?: string }>;
  // Wallet
  topUpWallet: (userId: string, amount: number) => void;
  deductWallet: (userId: string, amount: number) => boolean;
  creditWallet: (userId: string, amount: number) => void;
  // Withdrawals
  requestWithdrawal: (req: Omit<WithdrawalRequest, "id" | "createdAt" | "status" | "agentName">) => void;
  setWithdrawalStatus: (id: string, status: WithdrawalRequest["status"]) => void;
  // Admin
  upsertPackage: (p: DataPackage) => void;
  deletePackage: (id: string) => void;
  upsertChecker: (c: CheckerPackage) => void;
  setUserActive: (id: string, active: boolean) => void;
  // Agent store packages
  upsertAgentStorePackage: (row: { agentId: string; packageId: string; salePrice: number; active: boolean }) => void;
  removeAgentStorePackage: (agentId: string, packageId: string) => void;
  setAgentStorePackageActive: (agentId: string, packageId: string, active: boolean) => void;
  // Campaigns
  createCampaign: (input: { name: string; dataSize: string; network: FreeDataCampaign["network"]; totalCodes: number }) => FreeDataCampaign;
  setCampaignActive: (id: string, active: boolean) => void;
  redeemCode: (code: string, phone: string) => { ok: boolean; message: string };
  // Notifications
  pushNotification: (n: Omit<Notification, "id" | "createdAt">) => void;
  // Settings
  updateSettings: (s: Partial<SiteSettings>) => void;
  // API
  regenerateApiKey: (userId: string) => string;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<State>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setState = (updater: (s: State) => State) => setStateRaw((prev) => updater(prev));

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  );

  const value: StoreCtx = {
    state,
    setState,
    currentUser,

    signupAgent: ({ id, name, email, phone, storeSlug }) => {
      const userId = id ?? ("u-" + Math.random().toString(36).slice(2, 9));
      const user: User = {
        id: userId,
        name,
        email,
        phone,
        role: "agent",
        walletBalance: 0,
        storeSlug: storeSlug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
        storeTemplate: "neon",
        storeBrand: name + "'s Data Store",
        referralCode: "EASY-" + name.split(" ")[0].toUpperCase(),
        apiKey: genApiKey(),
        totalSales: 0,
        totalReferrals: 0,
        badges: [],
        createdAt: new Date().toISOString(),
        active: true,
      };

      setState((s) => {
        const idx = s.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === email.toLowerCase());
        if (idx === -1) {
          return { ...s, users: [...s.users, user], currentUserId: user.id };
        }
        const nextUsers = [...s.users];
        nextUsers[idx] = { ...nextUsers[idx], ...user, role: nextUsers[idx].role ?? "agent" };
        return { ...s, users: nextUsers, currentUserId: nextUsers[idx].id };
      });
      return user;
    },

    signupSubagent: ({ name, email, phone, parentAgentId }) => {
      const id = "u-" + Math.random().toString(36).slice(2, 9);
      const user: User = {
        id, name, email, phone,
        role: "subagent",
        walletBalance: 0,
        parentAgentId,
        referralCode: "EASY-" + name.split(" ")[0].toUpperCase(),
        totalSales: 0,
        badges: [],
        createdAt: new Date().toISOString(),
        active: true,
      };
      setState((s) => ({ ...s, users: [...s.users, user] }));
      return user;
    },

    login: (emailOrPhone) => {
      const u = state.users.find(
        (x) => x.email.toLowerCase() === emailOrPhone.toLowerCase() || x.phone === emailOrPhone,
      );
      if (u) setState((s) => ({ ...s, currentUserId: u.id }));
      return u ?? null;
    },

    logout: () => {
      const w = window as unknown as { __geteasySignOut?: () => Promise<void> };
      if (w.__geteasySignOut) void w.__geteasySignOut();
      setState((s) => ({ ...s, currentUserId: null }));
    },

    loginAsAdmin: () => {
      // Ensure an admin user exists
      let admin = state.users.find((u) => u.role === "admin");
      if (!admin) {
        admin = {
          id: "u-admin",
          name: "Admin",
          email: "admin@geteasydata.com",
          phone: "0000000000",
          role: "admin",
          walletBalance: 0,
          createdAt: new Date().toISOString(),
          active: true,
        };
        setState((s) => ({ ...s, users: [...s.users, admin!], currentUserId: admin!.id }));
      } else {
        setState((s) => ({ ...s, currentUserId: admin!.id }));
      }
    },

    placeOrder: (input) => {
      const order: Order = {
        ...input,
        id: "o-" + Math.random().toString(36).slice(2, 9),
        ref: genRef(),
        createdAt: new Date().toISOString(),
        status: input.status ?? "processing",
      };
      setState((s) => ({ ...s, orders: [order, ...s.orders] }));
      // Persist to Supabase + record wallet transaction for agent buys
      void (async () => {
        const { data, error } = await supabase
          .from("orders")
          .insert({
            ref: order.ref,
            product_label: order.productLabel,
            network: order.network ?? null,
            recipient_phone: order.recipient,
            amount: order.amount,
            buyer_type: order.buyerType,
            agent_id: order.agentId ?? null,
            status: order.status,
          })
          .select("id,ref")
          .single();
        if (!error && data && order.agentId) {
          await supabase.from("transactions").insert({
            user_id: order.agentId,
            order_id: data.id,
            type: "agent_order",
            amount: order.amount,
            description: order.productLabel,
            status: "completed",
          });
        }

        // Trigger real provider fulfillment for wallet-based buys.
        if (!error && data?.ref) {
          const { data: fulfillment, error: fulfillmentError } = await supabase.functions.invoke("fulfill-order", {
            body: { ref: data.ref },
          });

          setStateRaw((s) => ({
            ...s,
            orders: s.orders.map((o) => {
              if (o.id !== order.id) return o;
              if (fulfillmentError) {
                return {
                  ...o,
                  status: "failed",
                  fulfillmentErrorCode: "FULFILLMENT_CALL_FAILED",
                  fulfillmentErrorMessage: fulfillmentError.message,
                };
              }
              return {
                ...o,
                status: fulfillment?.status === "delivered" ? "delivered" : "failed",
                fulfillmentErrorCode: fulfillment?.errorCode ?? undefined,
                fulfillmentErrorMessage: fulfillment?.errorMessage ?? undefined,
              };
            }),
          }));
        }
      })();
      return order;
    },

    updateOrderStatus: (id, status) => {
      setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
      const o = state.orders.find((x) => x.id === id);
      if (o) {
        void supabase.from("orders").update({ status }).eq("ref", o.ref);
      } else if (/^[0-9a-f-]{36}$/i.test(id)) {
        void supabase.from("orders").update({ status }).eq("id", id);
      }
    },

    retryOrderFulfillment: async (ref) => {
      const { data, error } = await supabase.functions.invoke("fulfill-order", {
        body: { ref, retry: true },
      });
      if (error) return { ok: false, error: error.message };

      setStateRaw((s) => ({
        ...s,
        orders: s.orders.map((o) =>
          o.ref !== ref
            ? o
            : {
                ...o,
                status: data?.status === "delivered" ? "delivered" : "failed",
                fulfillmentErrorCode: data?.errorCode ?? undefined,
                fulfillmentErrorMessage: data?.errorMessage ?? undefined,
              },
        ),
      }));

      return { ok: true };
    },

    topUpWallet: (userId, amount) => {
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, walletBalance: u.walletBalance + amount } : u)),
      }));
      const u = state.users.find((x) => x.id === userId);
      const newBal = (u?.walletBalance ?? 0) + amount;
      void supabase.from("profiles").update({ wallet_balance: newBal }).eq("id", userId);
      void supabase.from("transactions").insert({
        user_id: userId, type: "wallet_topup", amount, description: "Wallet top-up", status: "completed",
      });
    },

    deductWallet: (userId, amount) => {
      const u = state.users.find((x) => x.id === userId);
      if (!u || u.walletBalance < amount) return false;
      setState((s) => ({
        ...s,
        users: s.users.map((x) => (x.id === userId ? { ...x, walletBalance: x.walletBalance - amount } : x)),
      }));
      void supabase.from("profiles").update({ wallet_balance: u.walletBalance - amount }).eq("id", userId);
      return true;
    },

    creditWallet: (userId, amount) => {
      const u = state.users.find((x) => x.id === userId);
      const newBal = (u?.walletBalance ?? 0) + amount;
      setState((s) => ({
        ...s,
        users: s.users.map((x) => (x.id === userId ? { ...x, walletBalance: newBal } : x)),
      }));
      void supabase.from("profiles").update({ wallet_balance: newBal }).eq("id", userId);
      void supabase.from("transactions").insert({
        user_id: userId, type: "wallet_topup", amount, description: "Admin credit", status: "completed",
      });
    },

    requestWithdrawal: (req) => {
      const agent = state.users.find((u) => u.id === req.agentId);
      const w: WithdrawalRequest = {
        ...req,
        id: "w-" + Math.random().toString(36).slice(2, 9),
        status: "pending",
        createdAt: new Date().toISOString(),
        agentName: agent?.name ?? "Unknown",
      };
      setState((s) => ({ ...s, withdrawals: [w, ...s.withdrawals] }));
      void supabase.from("withdrawals").insert({
        agent_id: req.agentId,
        amount: req.amount,
        momo_number: req.momoNumber,
        momo_network: req.network,
        account_name: req.accountName,
        status: "pending",
      });
    },

    setWithdrawalStatus: (id, status) =>
      setState((s) => {
        const w = s.withdrawals.find((x) => x.id === id);
        let users = s.users;
        if (w && status === "paid" && w.status !== "paid") {
          users = s.users.map((u) =>
            u.id === w.agentId ? { ...u, walletBalance: Math.max(0, u.walletBalance - w.amount) } : u,
          );
          void supabase.from("profiles")
            .update({ wallet_balance: Math.max(0, (users.find((u) => u.id === w.agentId)?.walletBalance ?? 0)) })
            .eq("id", w.agentId);
        }
        if (w) {
          // Try update by id (real UUID from Supabase) — silently no-op for legacy local-only rows.
          void supabase.from("withdrawals").update({ status }).eq("id", w.id);
        }
        return { ...s, users, withdrawals: s.withdrawals.map((x) => (x.id === id ? { ...x, status } : x)) };
      }),

    upsertPackage: (p) => {
      setState((s) => {
        const exists = s.packages.find((x) => x.id === p.id);
        return {
          ...s,
          packages: exists ? s.packages.map((x) => (x.id === p.id ? p : x)) : [...s.packages, p],
        };
      });
      const isUuid = /^[0-9a-f-]{36}$/i.test(p.id);
      const row = {
        network: p.network,
        label: p.size,
        size_mb: sizeToMB(p.size),
        validity_days: parseValidityDays(p.validity),
        price_public: p.pricePublic,
        price_agent: p.priceAgent,
        active: p.active,
      };
      if (isUuid) {
        void supabase.from("data_bundles").update(row).eq("id", p.id);
      } else {
        void supabase.from("data_bundles").insert(row).select("id").single().then(({ data }) => {
          if (data?.id) {
            setStateRaw((s) => ({
              ...s,
              packages: s.packages.map((x) => (x.id === p.id ? { ...x, id: data.id } : x)),
            }));
          }
        });
      }
    },

    deletePackage: (id) => {
      setState((s) => ({ ...s, packages: s.packages.filter((p) => p.id !== id) }));
      if (/^[0-9a-f-]{36}$/i.test(id)) void supabase.from("data_bundles").delete().eq("id", id);
    },

    upsertChecker: (c) => {
      setState((s) => {
        const exists = s.checkers.find((x) => x.id === c.id);
        return {
          ...s,
          checkers: exists ? s.checkers.map((x) => (x.id === c.id ? c : x)) : [...s.checkers, c],
        };
      });
      if (/^[0-9a-f-]{36}$/i.test(c.id)) {
        void supabase.from("checker_packages").update({
          checker_type: c.type,
          price_public: c.pricePublic,
          price_agent: c.priceAgent,
          stock: c.stock,
          active: c.active,
        }).eq("id", c.id);
      }
    },

    setUserActive: (id, active) => {
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, active } : u)) }));
      void supabase.from("profiles").update({ active }).eq("id", id);
    },

    upsertAgentStorePackage: ({ agentId, packageId, salePrice, active }) => {
      const now = new Date().toISOString();
      const existing = state.agentStorePackages.find((x) => x.agentId === agentId && x.packageId === packageId);
      const localId = existing?.id ?? ("asp-" + Math.random().toString(36).slice(2, 9));

      setState((s) => {
        const rows = s.agentStorePackages.some((x) => x.agentId === agentId && x.packageId === packageId)
          ? s.agentStorePackages.map((x) =>
              x.agentId === agentId && x.packageId === packageId
                ? { ...x, salePrice, active, updatedAt: now }
                : x,
            )
          : [
              {
                id: localId,
                agentId,
                packageId,
                salePrice,
                active,
                createdAt: now,
                updatedAt: now,
              },
              ...s.agentStorePackages,
            ];
        return { ...s, agentStorePackages: rows };
      });

      void (async () => {
        const { data: found } = await supabase
          .from("agent_packages")
          .select("id")
          .eq("agent_id", agentId)
          .eq("bundle_id", packageId)
          .maybeSingle();

        if (found?.id) {
          await supabase
            .from("agent_packages")
            .update({ sale_price: salePrice, active })
            .eq("id", found.id);
        } else {
          await supabase.from("agent_packages").insert({
            agent_id: agentId,
            bundle_id: packageId,
            sale_price: salePrice,
            active,
          });
        }
      })();
    },

    removeAgentStorePackage: (agentId, packageId) => {
      setState((s) => ({
        ...s,
        agentStorePackages: s.agentStorePackages.filter(
          (x) => !(x.agentId === agentId && x.packageId === packageId),
        ),
      }));

      void supabase
        .from("agent_packages")
        .delete()
        .eq("agent_id", agentId)
        .eq("bundle_id", packageId);
    },

    setAgentStorePackageActive: (agentId, packageId, active) => {
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        agentStorePackages: s.agentStorePackages.map((x) =>
          x.agentId === agentId && x.packageId === packageId ? { ...x, active, updatedAt: now } : x,
        ),
      }));

      void supabase
        .from("agent_packages")
        .update({ active })
        .eq("agent_id", agentId)
        .eq("bundle_id", packageId);
    },

    createCampaign: ({ name, dataSize, network, totalCodes }) => {
      const codes = Array.from({ length: totalCodes }, () => ({
        code: Array.from({ length: 8 }, () =>
          "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)],
        ).join(""),
        redeemed: false,
      }));
      const campaign: FreeDataCampaign = {
        id: "fc-" + Math.random().toString(36).slice(2, 9),
        name, dataSize, network, totalCodes,
        redeemed: 0, codes, active: true,
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, campaigns: [campaign, ...s.campaigns] }));
      void (async () => {
        const { data } = await supabase.from("free_data_campaigns").insert({
          name, data_size: dataSize, network, total_codes: totalCodes, redeemed_count: 0, active: true,
        }).select("id").single();
        if (data?.id) {
          await supabase.from("campaign_codes").insert(codes.map((c) => ({ campaign_id: data.id, code: c.code })));
          setStateRaw((s) => ({
            ...s,
            campaigns: s.campaigns.map((c) => (c.id === campaign.id ? { ...c, id: data.id } : c)),
          }));
        }
      })();
      return campaign;
    },

    setCampaignActive: (id, active) => {
      setState((s) => ({ ...s, campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, active } : c)) }));
      if (/^[0-9a-f-]{36}$/i.test(id)) void supabase.from("free_data_campaigns").update({ active }).eq("id", id);
    },

    redeemCode: (code, phone) => {
      const upper = code.trim().toUpperCase();
      const phoneTrim = phone.trim();
      if (!/^0\d{9}$/.test(phoneTrim)) return { ok: false, message: "Enter a valid Ghana phone (10 digits)." };
      const used = state.redemptionsByPhone[phoneTrim] ?? [];
      if (used.length > 0) return { ok: false, message: "This phone number has already redeemed a code." };
      let result = { ok: false, message: "Invalid or expired code." };
      setState((s) => {
        const campaigns = s.campaigns.map((c) => {
          if (!c.active) return c;
          const idx = c.codes.findIndex((cd) => cd.code === upper && !cd.redeemed);
          if (idx === -1) return c;
          const codes = c.codes.map((cd, i) => (i === idx ? { ...cd, redeemed: true, redeemedBy: phoneTrim } : cd));
          result = { ok: true, message: `Success! ${c.dataSize} ${c.network} will be sent to ${phoneTrim}.` };
          return { ...c, codes, redeemed: c.redeemed + 1 };
        });
        const redemptionsByPhone = result.ok
          ? { ...s.redemptionsByPhone, [phoneTrim]: [...used, upper] }
          : s.redemptionsByPhone;
        return { ...s, campaigns, redemptionsByPhone };
      });
      // Also try server-side redemption (authoritative). Ignore mismatch silently.
      void supabase.rpc("fn_redeem_campaign_code", { p_code: upper, p_phone: phoneTrim });
      return result;
    },

    pushNotification: (n) =>
      {
        const localId = "n-" + Math.random().toString(36).slice(2, 9);
        setState((s) => ({
          ...s,
          notifications: [
            { ...n, id: localId, createdAt: new Date().toISOString() },
            ...s.notifications,
          ],
        }));
        void supabase.from("notifications").insert({
          title: n.title, message: n.message, type: n.type, audience: n.audience,
        }).select("id, created_at").single().then(({ data }) => {
          if (data?.id) {
            setStateRaw((s) => ({
              ...s,
              notifications: s.notifications.map((x) => x.id === localId ? { ...x, id: data.id, createdAt: data.created_at } : x),
            }));
          }
        });
      },

    updateSettings: (patch) => {
      setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
      const updates: Array<{ key: string; value: unknown }> = [];
      if (patch.siteName !== undefined) updates.push({ key: "site_name", value: patch.siteName });
      if (patch.whatsappNumber !== undefined) updates.push({ key: "whatsapp_number", value: patch.whatsappNumber });
      if (patch.whatsappChannelLink !== undefined) updates.push({ key: "whatsapp_channel", value: patch.whatsappChannelLink });
      if (patch.agentFee !== undefined) updates.push({ key: "agent_fee", value: patch.agentFee });
      if (patch.agentActivationFee !== undefined) updates.push({ key: "agent_activation_fee", value: patch.agentActivationFee });
      if (patch.minWithdrawal !== undefined) updates.push({ key: "min_withdrawal", value: patch.minWithdrawal });
      if (patch.maintenanceMode !== undefined) updates.push({ key: "maintenance_mode", value: patch.maintenanceMode });
      if (patch.maintenanceMessage !== undefined) updates.push({ key: "maintenance_message", value: patch.maintenanceMessage });
      if (patch.banner !== undefined) updates.push({ key: "banner", value: patch.banner ?? null });

      if (updates.length > 0) {
        void supabase.from("site_settings").upsert(
          updates.map((u) => ({ key: u.key, value: u.value })),
          { onConflict: "key" },
        );
      }
    },

    regenerateApiKey: (userId) => {
      const key = genApiKey();
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, apiKey: key } : u)) }));
      void supabase.from("profiles").update({ api_key: key }).eq("id", userId);
      return key;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}