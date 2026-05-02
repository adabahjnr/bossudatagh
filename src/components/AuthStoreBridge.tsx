import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";

/**
 * Bridges the real Supabase auth session into the legacy localStorage store
 * so existing dashboard/admin pages keep working during the phased migration.
 * As pages are migrated to query Supabase directly, this can be removed.
 */
export function AuthStoreBridge() {
  const { user, profile, roles, signOut } = useAuth();
  const { setState, state } = useStore();

  useEffect(() => {
    if (!user || !profile) {
      // If there's no signed-in user but the legacy store still has one, clear it.
      if (state.currentUserId) setState((s) => ({ ...s, currentUserId: null }));
      return;
    }
    const role = roles.includes("admin") ? "admin" : roles.includes("subagent") ? "subagent" : "agent";
    const mirrored: User = {
      id: user.id,
      name: profile.name || user.email?.split("@")[0] || "Agent",
      email: user.email ?? "",
      phone: profile.phone ?? "",
      role,
      walletBalance: Number(profile.wallet_balance ?? 0),
      storeSlug: profile.store_slug ?? undefined,
      storeTemplate: (profile.store_template as User["storeTemplate"]) ?? "neon",
      storeBrand: profile.store_brand ?? undefined,
      storeLogo: profile.store_logo ?? undefined,
      parentAgentId: profile.parent_agent_id ?? undefined,
      apiKey: profile.api_key ?? undefined,
      referralCode: profile.referral_code ?? undefined,
      totalSales: profile.total_sales ?? 0,
      totalReferrals: profile.total_referrals ?? 0,
      badges: profile.badges ?? [],
      createdAt: new Date().toISOString(),
      active: profile.active ?? true,
    };
    setState((s) => {
      const others = s.users.filter((u) => u.id !== user.id);
      return { ...s, users: [...others, mirrored], currentUserId: user.id };
    });
    // expose signOut on window so legacy logout() calls fully sign out of Supabase too
    (window as unknown as { __geteasySignOut?: () => Promise<void> }).__geteasySignOut = signOut;
  }, [user, profile, roles, setState, signOut, state.currentUserId]);

  return null;
}