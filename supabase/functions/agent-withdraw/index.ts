import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Secure agent withdrawal request.
 *
 * Security guarantees:
 * - Caller must be an authenticated, activated agent (JWT verified)
 * - Wallet balance is read from DB (not from client state)
 * - Amount is immediately locked (deducted) on submission to prevent double-spend
 * - Optimistic concurrency lock prevents race conditions
 * - Rollback on failure: balance is restored if withdrawal record can't be created
 * - Admin must manually approve/process the MoMo payout
 * - On rejection, admin must credit the balance back via the dashboard
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Missing Supabase env");

    // ── Authenticate caller ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const amount = Number(body?.amount ?? 0);
    const momoNumber = String(body?.momoNumber ?? "").trim();
    const network = String(body?.network ?? "").trim();
    const accountName = String(body?.accountName ?? "").trim();

    // ── Input validation ─────────────────────────────────────────────────────
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
    if (!/^0\d{9}$/.test(momoNumber)) throw new Error("Invalid mobile money number");
    if (!["MTN", "Telecel", "AirtelTigo"].includes(network)) throw new Error("Invalid network");
    if (!accountName || accountName.length < 2) throw new Error("Account name is required");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Load profile + site settings in parallel ─────────────────────────────
    const [profileRes, minSettingRes] = await Promise.all([
      admin.from("profiles").select("id,role,agent_activated,wallet_balance").eq("id", callerUser.id).maybeSingle(),
      admin.from("site_settings").select("value").eq("key", "min_withdrawal").maybeSingle(),
    ]);

    const profile = profileRes.data;
    if (!profile) throw new Error("Profile not found");

    if (profile.role !== "agent" && profile.role !== "subagent") {
      return new Response(JSON.stringify({ error: "Only agents can request withdrawals" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.role === "agent" && !profile.agent_activated) {
      return new Response(JSON.stringify({ error: "Agent account is not yet activated" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const minWithdrawal = Number(minSettingRes.data?.value ?? 50);
    const walletBalance = Number(profile.wallet_balance ?? 0);

    if (amount < minWithdrawal) {
      return new Response(
        JSON.stringify({ error: `Minimum withdrawal is ₵${minWithdrawal.toFixed(2)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (amount > walletBalance) {
      return new Response(
        JSON.stringify({ error: `Amount (₵${amount.toFixed(2)}) exceeds wallet balance (₵${walletBalance.toFixed(2)})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check for existing pending withdrawals that would exceed balance
    const { data: pendingWithdrawals } = await admin
      .from("withdrawals")
      .select("amount")
      .eq("agent_id", callerUser.id)
      .eq("status", "pending");

    const totalPending = (pendingWithdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
    if (totalPending + amount > walletBalance) {
      return new Response(
        JSON.stringify({ error: "You already have pending withdrawals that cover this amount. Please wait for them to be processed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newBalance = Math.round((walletBalance - amount) * 100) / 100;

    // ── Deduct balance with optimistic concurrency lock ───────────────────────
    const { data: updatedProfile, error: deductErr } = await admin
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("id", callerUser.id)
      .eq("wallet_balance", walletBalance)
      .select("id")
      .maybeSingle();

    if (deductErr || !updatedProfile) {
      throw new Error("Balance update failed (possible concurrent request). Please try again.");
    }

    // ── Create withdrawal record ──────────────────────────────────────────────
    const { data: withdrawal, error: withdrawalErr } = await admin
      .from("withdrawals")
      .insert({
        agent_id: callerUser.id,
        amount,
        momo_number: momoNumber,
        momo_network: network,
        account_name: accountName,
        status: "pending",
      })
      .select("id,amount,momo_number,momo_network,account_name,status,created_at")
      .single();

    if (withdrawalErr) {
      // Rollback: restore balance
      await admin.from("profiles").update({ wallet_balance: walletBalance }).eq("id", callerUser.id);
      throw withdrawalErr;
    }

    // ── Record transaction ledger entry ───────────────────────────────────────
    await admin.from("transactions").insert({
      user_id: callerUser.id,
      type: "withdrawal",
      amount,
      balance_before: walletBalance,
      balance_after: newBalance,
      description: `Withdrawal to ${network} ${momoNumber}`,
      status: "pending",
    }).catch(() => {/* non-critical */});

    return new Response(JSON.stringify({ ok: true, withdrawal, newBalance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
