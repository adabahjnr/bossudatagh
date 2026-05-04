import { createContext, useContext, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const authClient =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

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
  const { state, setState, currentUser, signupAgent, login, logout } = useStore();

  const roles: AppRole[] = currentUser
    ? currentUser.role === "admin"
      ? ["admin"]
      : currentUser.role === "subagent"
        ? ["subagent"]
        : ["agent"]
    : [];

  const signUp: AuthCtx["signUp"] = async ({ email, password, name, phone, storeSlug }) => {
    try {
      if (!authClient) {
        return { error: "Supabase Auth is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY." };
      }

      const existing = state.users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() || u.phone === phone,
      );
      if (existing) return { error: "An account with that email or phone already exists." };

      const slug = storeSlug ?? name.toLowerCase().replace(/\s+/g, "-");
      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            name,
            phone,
            store_slug: slug,
          },
        },
      });
      if (error) return { error: error.message };

      signupAgent({ id: data.user?.id, name, email, phone, password, storeSlug: slug });
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign up failed" };
    }
  };

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    if (authClient) {
      const { data, error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      const signedIn = data.user;
      if (signedIn) {
        const metadata = (signedIn.user_metadata ?? {}) as {
          name?: string;
          phone?: string;
          store_slug?: string;
        };

        const { data: roleRows } = await authClient
          .from("user_roles")
          .select("role")
          .eq("user_id", signedIn.id);

        const roles = (roleRows ?? []).map((r: any) => String(r.role));
        const mappedRole: User["role"] = roles.includes("admin")
          ? "admin"
          : roles.includes("subagent")
            ? "subagent"
            : "agent";

        setState((s) => {
          const existing = s.users.find((u) => u.id === signedIn.id || u.email.toLowerCase() === (signedIn.email ?? "").toLowerCase());
          if (existing) {
            return {
              ...s,
              users: s.users.map((u) =>
                u.id === existing.id
                  ? {
                      ...u,
                      id: signedIn.id,
                      email: signedIn.email ?? u.email,
                      name: metadata.name ?? u.name,
                      phone: metadata.phone ?? u.phone,
                      storeSlug: metadata.store_slug ?? u.storeSlug,
                      role: mappedRole,
                    }
                  : u,
              ),
              currentUserId: signedIn.id,
            };
          }

          const newUser: User = {
            id: signedIn.id,
            name: metadata.name ?? (signedIn.email?.split("@")[0] ?? "Agent"),
            email: signedIn.email ?? email,
            phone: metadata.phone ?? "",
            role: mappedRole,
            walletBalance: 0,
            storeSlug: metadata.store_slug,
            storeTemplate: "neon",
            storeBrand: (metadata.name ?? "Agent") + "'s Data Store",
            totalSales: 0,
            totalReferrals: 0,
            badges: [],
            createdAt: new Date().toISOString(),
            active: true,
          };
          return { ...s, users: [...s.users, newUser], currentUserId: signedIn.id };
        });
      }
      return { error: null };
    }

    const u = login(email);
    if (!u) return { error: "No account found with that email or phone." };
    return { error: null };
  };

  const signOut: AuthCtx["signOut"] = async () => {
    if (authClient) {
      await authClient.auth.signOut();
    }
    logout();
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    if (!authClient) {
      return { error: "Supabase Auth is not configured." };
    }
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
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