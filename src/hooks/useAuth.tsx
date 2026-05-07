import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  agent_activated: boolean;
  activation_paid_at: string | null;
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

const PROFILE_SELECT =
  "id,role,name,phone,store_slug,store_template,store_logo,store_brand,parent_agent_id,api_key,referral_code,wallet_balance,total_sales,total_referrals,badges,active,agent_activated,activation_paid_at";
const PROFILE_SELECT_LEGACY =
  "id,role,name,phone,store_slug,store_template,store_logo,store_brand,parent_agent_id,api_key,referral_code,wallet_balance,total_sales,total_referrals,badges,active";

function roleFromProfileLike(value: unknown): AppRole {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "admin") return "admin";
    if (normalized === "subagent") return "subagent";
  }
  return "agent";
}

function toRoleOrNull(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "subagent") return "subagent";
  if (normalized === "agent") return "agent";
  return null;
}

function pushRoleCandidate(out: Set<AppRole>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => pushRoleCandidate(out, item));
    return;
  }
  const parsed = toRoleOrNull(value);
  if (parsed) out.add(parsed);
}

function extractAuthRoles(session: Session | null): AppRole[] {
  const authUser = session?.user;
  if (!authUser) return [];

  const unique = new Set<AppRole>();
  pushRoleCandidate(unique, authUser.app_metadata?.role);
  pushRoleCandidate(unique, authUser.app_metadata?.user_role);
  pushRoleCandidate(unique, authUser.app_metadata?.roles);
  pushRoleCandidate(unique, authUser.user_metadata?.role);
  pushRoleCandidate(unique, authUser.user_metadata?.user_role);

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
    agent_activated: row.agent_activated ?? false,
    activation_paid_at: row.activation_paid_at ?? null,
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

async function getOrCreateProfile(
  userId: string,
  userMetadata: Record<string, any> | undefined,
  appMetadata: Record<string, any> | undefined,
) {
  let existing: any = null;
  let readError: any = null;

  const fullRead = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  existing = fullRead.data;
  readError = fullRead.error;

  // Backward-compatible fallback if the DB is missing newer activation columns.
  if (readError && /agent_activated|activation_paid_at/i.test(readError.message ?? "")) {
    const legacyRead = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_LEGACY)
      .eq("id", userId)
      .maybeSingle();

    existing = legacyRead.data;
    readError = legacyRead.error;
  }

  if (readError) throw readError;
  if (existing) return mapProfileRow(existing);

  const roleFromAuth =
    toRoleOrNull(appMetadata?.role) ??
    toRoleOrNull(appMetadata?.user_role) ??
    toRoleOrNull(userMetadata?.role) ??
    toRoleOrNull(userMetadata?.user_role) ??
    "agent";

  const payload = {
    id: userId,
    role: roleFromAuth,
    name: typeof userMetadata?.name === "string" ? userMetadata.name : null,
    phone: typeof userMetadata?.phone === "string" ? userMetadata.phone : null,
    store_slug: typeof userMetadata?.store_slug === "string" ? userMetadata.store_slug : null,
    active: true,
  };

  let created: any = null;
  let createError: any = null;

  const fullCreate = await supabase
    .from("profiles")
    .insert(payload)
    .select(PROFILE_SELECT)
    .maybeSingle();

  created = fullCreate.data;
  createError = fullCreate.error;

  if (createError && /agent_activated|activation_paid_at/i.test(createError.message ?? "")) {
    const legacyCreate = await supabase
      .from("profiles")
      .insert(payload)
      .select(PROFILE_SELECT_LEGACY)
      .maybeSingle();

    created = legacyCreate.data;
    createError = legacyCreate.error;
  }

  if (createError) {
    if (createError.code === "23505") {
      let retryExisting: any = null;
      let retryError: any = null;

      const fullRetry = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", userId)
        .maybeSingle();

      retryExisting = fullRetry.data;
      retryError = fullRetry.error;

      if (retryError && /agent_activated|activation_paid_at/i.test(retryError.message ?? "")) {
        const legacyRetry = await supabase
          .from("profiles")
          .select(PROFILE_SELECT_LEGACY)
          .eq("id", userId)
          .maybeSingle();

        retryExisting = legacyRetry.data;
        retryError = legacyRetry.error;
      }

      if (retryError) throw retryError;
      if (retryExisting) return mapProfileRow(retryExisting);
    }
    throw createError;
  }

  return created ? mapProfileRow(created) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshProfile = async () => {
    const authUser = session?.user;
    if (!authUser) {
      setProfile(null);
      return;
    }

    try {
      const nextProfile = await getOrCreateProfile(
        authUser.id,
        authUser.user_metadata as Record<string, any> | undefined,
        authUser.app_metadata as Record<string, any> | undefined,
      );
      setProfile(nextProfile);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;
    let visibilityHandler: (() => void) | null = null;

    const bootstrap = async () => {
      if (bootstrapTimeoutRef.current) clearTimeout(bootstrapTimeoutRef.current);
      // Fallback in case session/profile bootstrap gets stuck due transient network issues.
      bootstrapTimeoutRef.current = setTimeout(() => {
        if (mounted) setLoading(false);
      }, 4000);

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
              nextSession.user.app_metadata as Record<string, any> | undefined,
            );
            if (mounted) setProfile(nextProfile);
          } catch {
            if (mounted) setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } finally {
        if (bootstrapTimeoutRef.current) {
          clearTimeout(bootstrapTimeoutRef.current);
          bootstrapTimeoutRef.current = null;
        }
        if (mounted) setLoading(false);
      }
    };

    const refreshSession = async () => {
      if (!mounted) return;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          if (mounted) {
            setSession(null);
            setProfile(null);
          }
        } else if (mounted) {
          setSession(data.session);
          if (data.session.user) {
            try {
              const nextProfile = await getOrCreateProfile(
                data.session.user.id,
                data.session.user.user_metadata as Record<string, any> | undefined,
                data.session.user.app_metadata as Record<string, any> | undefined,
              );
              if (mounted) setProfile(nextProfile);
            } catch {
              if (mounted) setProfile(null);
            }
          }
        }
      } catch {
        if (mounted) {
          setSession(null);
          setProfile(null);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      void refreshSession();
    };

    void bootstrap();

    refreshInterval = setInterval(() => {
      void refreshSession();
    }, 45000);

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      visibilityHandler = handleVisibilityChange;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Silently update profile in background — do NOT set loading=true here.
      // Bootstrap already manages loading state for the initial session load.
      try {
        const nextProfile = await getOrCreateProfile(
          nextSession.user.id,
          nextSession.user.user_metadata as Record<string, any> | undefined,
          nextSession.user.app_metadata as Record<string, any> | undefined,
        );
        if (mounted) setProfile(nextProfile);
      } catch {
        if (mounted) setProfile(null);
      }
    });

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      if (bootstrapTimeoutRef.current) clearTimeout(bootstrapTimeoutRef.current);
      if (visibilityHandler && typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
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

      if (error) {
        if (error.message === "Database error saving new user") {
          return { error: "Could not create account. The store URL may already be in use. Please choose a different store URL." };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Sign up failed" };
    }
  };

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
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