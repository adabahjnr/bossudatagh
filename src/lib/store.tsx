import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  defaultSiteSettings,
  mockAgents,
  mockCampaigns,
  mockCheckers,
  mockNotifications,
  mockOrders,
  mockPackages,
  mockWithdrawals,
} from "./mockData";
import type {
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

const KEY = "geteasydata.state.v1";

interface State {
  users: User[];
  packages: DataPackage[];
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
  users: mockAgents,
  packages: mockPackages,
  checkers: mockCheckers,
  orders: mockOrders,
  withdrawals: mockWithdrawals,
  campaigns: mockCampaigns,
  settings: defaultSiteSettings,
  notifications: mockNotifications,
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
  signupAgent: (input: { name: string; email: string; phone: string; password: string; storeSlug: string }) => User;
  signupSubagent: (input: { name: string; email: string; phone: string; parentAgentId: string }) => User;
  login: (emailOrPhone: string) => User | null;
  logout: () => void;
  loginAsAdmin: () => void;
  // Orders
  placeOrder: (input: Omit<Order, "id" | "ref" | "createdAt" | "status"> & { status?: Order["status"] }) => Order;
  updateOrderStatus: (id: string, status: Order["status"]) => void;
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

    signupAgent: ({ name, email, phone, storeSlug }) => {
      const id = "u-" + Math.random().toString(36).slice(2, 9);
      const user: User = {
        id,
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
      setState((s) => ({ ...s, users: [...s.users, user], currentUserId: id }));
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
      // Simulate fulfillment
      setTimeout(() => {
        setStateRaw((s) => ({
          ...s,
          orders: s.orders.map((o) => (o.id === order.id ? { ...o, status: "delivered" } : o)),
        }));
      }, 1800);
      return order;
    },

    updateOrderStatus: (id, status) =>
      setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),

    topUpWallet: (userId, amount) =>
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, walletBalance: u.walletBalance + amount } : u)),
      })),

    deductWallet: (userId, amount) => {
      const u = state.users.find((x) => x.id === userId);
      if (!u || u.walletBalance < amount) return false;
      setState((s) => ({
        ...s,
        users: s.users.map((x) => (x.id === userId ? { ...x, walletBalance: x.walletBalance - amount } : x)),
      }));
      return true;
    },

    creditWallet: (userId, amount) =>
      setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, walletBalance: u.walletBalance + amount } : u)),
      })),

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
    },

    setWithdrawalStatus: (id, status) =>
      setState((s) => {
        const w = s.withdrawals.find((x) => x.id === id);
        let users = s.users;
        if (w && status === "paid" && w.status !== "paid") {
          users = s.users.map((u) =>
            u.id === w.agentId ? { ...u, walletBalance: Math.max(0, u.walletBalance - w.amount) } : u,
          );
        }
        return { ...s, users, withdrawals: s.withdrawals.map((x) => (x.id === id ? { ...x, status } : x)) };
      }),

    upsertPackage: (p) =>
      setState((s) => {
        const exists = s.packages.find((x) => x.id === p.id);
        return {
          ...s,
          packages: exists ? s.packages.map((x) => (x.id === p.id ? p : x)) : [...s.packages, p],
        };
      }),

    deletePackage: (id) => setState((s) => ({ ...s, packages: s.packages.filter((p) => p.id !== id) })),

    upsertChecker: (c) =>
      setState((s) => {
        const exists = s.checkers.find((x) => x.id === c.id);
        return {
          ...s,
          checkers: exists ? s.checkers.map((x) => (x.id === c.id ? c : x)) : [...s.checkers, c],
        };
      }),

    setUserActive: (id, active) =>
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, active } : u)) })),

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
      return campaign;
    },

    setCampaignActive: (id, active) =>
      setState((s) => ({ ...s, campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, active } : c)) })),

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
      return result;
    },

    pushNotification: (n) =>
      setState((s) => ({
        ...s,
        notifications: [
          { ...n, id: "n-" + Math.random().toString(36).slice(2, 9), createdAt: new Date().toISOString() },
          ...s.notifications,
        ],
      })),

    updateSettings: (s) => setState((st) => ({ ...st, settings: { ...st.settings, ...s } })),

    regenerateApiKey: (userId) => {
      const key = genApiKey();
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === userId ? { ...u, apiKey: key } : u)) }));
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