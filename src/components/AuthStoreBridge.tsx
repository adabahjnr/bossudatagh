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
  const { user, profile, roles, loading, signOut } = useAuth();
  const { setState, state } = useStore();

  useEffect(() => {
    if (loading) return; // Still initialising — don't touch the store yet

    if (!user) {
      // Signed out — clear the legacy store
      if (state.currentUserId) setState((s) => ({ ...s, currentUserId: null }));
      return;
    }

    const role = roles.includes("admin") ? "admin" : roles.includes("subagent") ? "subagent" : "agent";

    // Sync whatever we have. profile may still be loading; fall back to user metadata.
    const mirrored: User = {
      id: user.id,
      name: profile?.name || user.name || user.email?.split("@")[0] || "Agent",
      email: user.email ?? "",
      phone: profile?.phone || user.phone || "",
      role,
      walletBalance: Number(profile?.wallet_balance ?? user.walletBalance ?? 0),
      storeSlug: profile?.store_slug ?? user.storeSlug,
      storeTemplate: (profile?.store_template as User["storeTemplate"]) ?? user.storeTemplate ?? "neon",
      storeBrand: profile?.store_brand ?? user.storeBrand,
      storeLogo: profile?.store_logo ?? user.storeLogo,
      parentAgentId: profile?.parent_agent_id ?? user.parentAgentId,
      apiKey: profile?.api_key ?? user.apiKey,
      referralCode: profile?.referral_code ?? user.referralCode,
      totalSales: profile?.total_sales ?? user.totalSales ?? 0,
      totalReferrals: profile?.total_referrals ?? user.totalReferrals ?? 0,
      badges: profile?.badges ?? user.badges ?? [],
      agentActivated: profile?.agent_activated ?? user.agentActivated ?? false,
      activationPaidAt: profile?.activation_paid_at ?? user.activationPaidAt,
      createdAt: user.createdAt ?? new Date().toISOString(),
      active: profile?.active ?? user.active ?? true,
    };

    setState((s) => {
      const others = s.users.filter((u) => u.id !== user.id);
      return { ...s, users: [...others, mirrored], currentUserId: user.id };
    });

    // Expose signOut on window so legacy logout() calls fully sign out of Supabase too
    (window as unknown as { __geteasySignOut?: () => Promise<void> }).__geteasySignOut = signOut;
  }, [user, profile, roles, loading, setState, signOut, state.currentUserId]);

  return null;
}