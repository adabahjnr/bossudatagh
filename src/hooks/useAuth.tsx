import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";

export type AppRole = "admin" | "agent" | "subagent";

export interface Profile {
  id: string;
  name: string;
  phone: string;
  store_slug: string | null;
  store_template: "neon" | "minimal" | "bold" | null;
  store_logo: string | null;
  store_brand: string | null;
  parent_agent_id: string | null;
  api_key: string | null;
  referral_code: string | null;
  wallet_balance: number;
  total_sales: number;
  total_referrals: number;
  badges: string[];
  active: boolean;
}

interface AuthCtx {
  session: null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  signUp: (input: {
    email: string;
    password: string;
    name: string;
    phone: string;
    storeSlug?: string;
  }) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function userToProfile(u: User): Profile {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    store_slug: u.storeSlug ?? null,
    store_template: (u.storeTemplate as Profile["store_template"]) ?? null,
    store_logo: u.storeLogo ?? null,
    store_brand: u.storeBrand ?? null,
    parent_agent_id: u.parentAgentId ?? null,
    api_key: u.apiKey ?? null,
    referral_code: u.referralCode ?? null,
    wallet_balance: u.walletBalance,
    total_sales: u.totalSales ?? 0,
    total_referrals: u.totalReferrals ?? 0,
    badges: u.badges ?? [],
    active: u.active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state, currentUser, signupAgent, login, logout } = useStore();

  const roles: AppRole[] = currentUser
    ? currentUser.role === "admin"
      ? ["admin"]
      : currentUser.role === "subagent"
        ? ["subagent"]
        : ["agent"]
    : [];

  const signUp: AuthCtx["signUp"] = async ({ email, name, phone, storeSlug }) => {
    try {
      const existing = state.users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() || u.phone === phone,
      );
      if (existing) return { error: "An account with that email or phone already exists." };
      signupAgent({ name, email, phone, password: "", storeSlug: storeSlug ?? name.toLowerCase().replace(/\s+/g, "-") });
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign up failed" };
    }
  };

  const signIn: AuthCtx["signIn"] = async (email, _password) => {
    const u = login(email);
    if (!u) return { error: "No account found with that email or phone." };
    return { error: null };
  };

  const signOut: AuthCtx["signOut"] = async () => {
    logout();
  };

  const resetPassword: AuthCtx["resetPassword"] = async (_email) => {
    return { error: null };
  };

  const refreshProfile: AuthCtx["refreshProfile"] = async () => {};

  return (
    <Ctx.Provider
      value={{
        session: null,
        user: currentUser,
        profile: currentUser ? userToProfile(currentUser) : null,
        roles,
        isAdmin: currentUser?.role === "admin",
        loading: false,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}