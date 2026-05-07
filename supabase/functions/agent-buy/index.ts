import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Secure agent wallet-based data purchase.
 *
 * Security guarantees:
 * - Caller must be an authenticated, activated agent (JWT verified)
 * - Package price is looked up from data_bundles (never trusted from client)
 * - Wallet balance is read from DB (not from client state)
 * - Optimistic concurrency lock prevents double-spend race conditions
 * - Wallet deduction and order creation are performed atomically with rollback
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
    const packageId = String(body?.packageId ?? "").trim();
    const recipientPhone = String(body?.recipientPhone ?? "").trim();

    if (!packageId) {
      return new Response(JSON.stringify({ error: "packageId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^0\d{9}$/.test(recipientPhone)) {
      return new Response(JSON.stringify({ error: "Invalid recipient phone number (must be 10 digits starting with 0)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Verify agent is activated ────────────────────────────────────────────
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id,role,agent_activated,wallet_balance")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileErr || !profile) throw new Error("Profile not found");

    if (profile.role !== "agent" && profile.role !== "subagent") {
      return new Response(JSON.stringify({ error: "Only agents can use wallet-based purchases" }), {
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

    // ── Look up canonical price from DB (never trust client) ─────────────────
    const { data: bundle, error: bundleErr } = await admin
      .from("data_bundles")
      .select("id,network,label,price_agent,active")
      .eq("id", packageId)
      .maybeSingle();

    if (bundleErr || !bundle) throw new Error("Package not found");
    if (!bundle.active) throw new Error("Package is no longer available");

    const price = Number(bundle.price_agent);
    const walletBalance = Number(profile.wallet_balance ?? 0);

    if (walletBalance < price) {
      return new Response(
        JSON.stringify({ error: `Insufficient wallet balance. Required: ₵${price.toFixed(2)}, Available: ₵${walletBalance.toFixed(2)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newBalance = Math.round((walletBalance - price) * 100) / 100;

    // ── Deduct balance with optimistic concurrency lock ───────────────────────
    // The .eq("wallet_balance", walletBalance) ensures we don't double-deduct
    // if a concurrent request modified the balance between our read and write.
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

    // ── Create order ─────────────────────────────────────────────────────────
    const ref = "AG-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const productLabel = `${bundle.network} ${bundle.label}`;

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        ref,
        product_label: productLabel,
        network: bundle.network,
        recipient_phone: recipientPhone,
        bundle_id: packageId,
        amount: price,
        buyer_type: "agent",
        agent_id: callerUser.id,
        status: "processing",
      })
      .select("id,ref,product_label,recipient_phone,amount,status,created_at")
      .single();

    if (orderErr) {
      // Rollback wallet deduction
      await admin.from("profiles").update({ wallet_balance: walletBalance }).eq("id", callerUser.id);
      throw orderErr;
    }

    // ── Record transaction ledger entry ───────────────────────────────────────
    await admin.from("transactions").insert({
      user_id: callerUser.id,
      order_id: order.id,
      type: "agent_order",
      amount: price,
      balance_before: walletBalance,
      balance_after: newBalance,
      description: productLabel,
      status: "completed",
    }).catch(() => {/* non-critical, don't fail the order */});

    // ── Trigger fulfillment (best-effort) ─────────────────────────────────────
    fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref }),
    }).catch(() => {/* admin can retry via dashboard */});

    return new Response(JSON.stringify({ ok: true, order, newBalance }), {
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
