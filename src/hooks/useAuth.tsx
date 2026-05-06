import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/lib/types";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "agent" | "subagent";

export interface Profile {
  id: string;
  role: AppRole;
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
  session: Session | null;
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

function roleFromProfileLike(value: unknown): AppRole {
  if (value === "admin" || value === "subagent") return value;
  return "agent";
}

function extractAuthRoles(session: Session | null): AppRole[] {
  const authUser = session?.user;
  if (!authUser) return [];

  const candidates: unknown[] = [
    authUser.app_metadata?.role,
    authUser.app_metadata?.user_role,
    ...(Array.isArray(authUser.app_metadata?.roles) ? authUser.app_metadata.roles : []),
    authUser.user_metadata?.role,
  ];

  const unique = new Set<AppRole>();
  for (const candidate of candidates) {
    unique.add(roleFromProfileLike(candidate));
  }

  return Array.from(unique);
}

function resolveRoles(session: Session | null, profile: Profile | null): AppRole[] {
  const authRoles = extractAuthRoles(session);
  const combined = new Set<AppRole>();

  if (profile?.role) combined.add(roleFromProfileLike(profile.role));
  authRoles.forEach((r) => combined.add(r));

  return combined.size ? Array.from(combined) : [];
}

function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    role: roleFromProfileLike(row.role),
    name: row.name ?? "",
    phone: row.phone ?? "",
    store_slug: row.store_slug ?? null,
    store_template: row.store_template ?? null,
    store_logo: row.store_logo ?? null,
    store_brand: row.store_brand ?? null,
    parent_agent_id: row.parent_agent_id ?? null,
    api_key: row.api_key ?? null,
    referral_code: row.referral_code ?? null,
    wallet_balance: Number(row.wallet_balance ?? 0),
    total_sales: Number(row.total_sales ?? 0),
    total_referrals: Number(row.total_referrals ?? 0),
    badges: Array.isArray(row.badges) ? row.badges : [],
    active: row.active ?? true,
  };
}

function mapSessionUserToAppUser(session: Session | null, profile: Profile | null): User | null {
  const authUser = session?.user;
  if (!authUser) return null;

  const nameFromMeta =
    typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name : undefined;
  const phoneFromMeta =
    typeof authUser.user_metadata?.phone === "string" ? authUser.user_metadata.phone : undefined;
  const createdAt = authUser.created_at ?? new Date().toISOString();

  return {
    id: authUser.id,
    name: profile?.name || nameFromMeta || authUser.email?.split("@")[0] || "Agent",
    email: authUser.email ?? "",
    phone: profile?.phone || phoneFromMeta || "",
    role: profile?.role ?? extractAuthRoles(session)[0] ?? "agent",
    walletBalance: Number(profile?.wallet_balance ?? 0),
    storeSlug: profile?.store_slug ?? undefined,
    storeTemplate: profile?.store_template ?? "neon",
    storeLogo: profile?.store_logo ?? undefined,
    storeBrand: profile?.store_brand ?? undefined,
    parentAgentId: profile?.parent_agent_id ?? undefined,
    apiKey: profile?.api_key ?? undefined,
    referralCode: profile?.referral_code ?? undefined,
    totalSales: Number(profile?.total_sales ?? 0),
    totalReferrals: Number(profile?.total_referrals ?? 0),
    badges: profile?.badges ?? [],
    createdAt,
    active: profile?.active ?? true,
  };
}

async function getOrCreateProfile(userId: string, metadata: Record<string, any> | undefined) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select(
      "id,role,name,phone,store_slug,store_template,store_logo,store_brand,parent_agent_id,api_key,referral_code,wallet_balance,total_sales,total_referrals,badges,active",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!readError && existing) return mapProfileRow(existing);

  const payload = {
    id: userId,
    role: roleFromProfileLike(metadata?.role),
    name: typeof metadata?.name === "string" ? metadata.name : null,
    phone: typeof metadata?.phone === "string" ? metadata.phone : null,
    store_slug: typeof metadata?.store_slug === "string" ? metadata.store_slug : null,
    active: true,
  };

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select(
      "id,role,name,phone,store_slug,store_template,store_logo,store_brand,parent_agent_id,api_key,referral_code,wallet_balance,total_sales,total_referrals,badges,active",
    )
    .maybeSingle();

  if (createError) throw createError;
  return created ? mapProfileRow(created) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const authUser = session?.user;
    if (!authUser) {
      setProfile(null);
      return;
    }

    try {
      const nextProfile = await getOrCreateProfile(authUser.id, authUser.user_metadata as Record<string, any> | undefined);
      setProfile(nextProfile);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const nextSession = data.session;
        setSession(nextSession);
        if (nextSession?.user) {
          try {
            const nextProfile = await getOrCreateProfile(
              nextSession.user.id,
              nextSession.user.user_metadata as Record<string, any> | undefined,
            );
            if (mounted) setProfile(nextProfile);
          } catch {
            if (mounted) setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextProfile = await getOrCreateProfile(
          nextSession.user.id,
          nextSession.user.user_metadata as Record<string, any> | undefined,
        );
        if (mounted) setProfile(nextProfile);
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const user = useMemo(() => mapSessionUserToAppUser(session, profile), [session, profile]);
  const roles: AppRole[] = useMemo(() => resolveRoles(session, profile), [session, profile]);

  const signUp: AuthCtx["signUp"] = async ({ email, password, name, phone, storeSlug }) => {
    try {
      const slug = storeSlug ? storeSlug.toLowerCase() : null;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            store_slug: slug,
            role: "agent",
          },
        },
      });

      if (error) return { error: error.message };

      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign up failed" };
    }
  };

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut: AuthCtx["signOut"] = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user,
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        loading,
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