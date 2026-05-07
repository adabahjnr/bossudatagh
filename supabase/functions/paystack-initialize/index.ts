import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!secretKey) throw new Error("Missing PAYSTACK_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Missing Supabase configuration");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const purpose = String(body?.purpose ?? "");
    const email = String(body?.email ?? "").trim();
    const callbackUrl = String(body?.callbackUrl ?? "").trim();

    if (!["order", "agent_activation", "wallet_topup"].includes(purpose)) {
      throw new Error("Invalid payment purpose");
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error("A valid email is required");
    }
    if (!callbackUrl) throw new Error("callbackUrl is required");

    let amount = 0;
    let metadata: Record<string, unknown> = { purpose };

    // ── ORDER ────────────────────────────────────────────────────────────────
    if (purpose === "order") {
      const packageId = body?.packageId as string | undefined;
      const checkerId = body?.checkerId as string | undefined;
      const agentId = body?.agentId as string | undefined;
      const recipientPhone = String(body?.recipientPhone ?? "").trim();

      if (!recipientPhone || !/^0\d{9}$/.test(recipientPhone)) {
        throw new Error("A valid 10-digit recipient phone number is required");
      }
      if (!packageId && !checkerId) {
        throw new Error("Either packageId or checkerId is required for an order");
      }

      if (packageId) {
        // Server-side canonical price lookup — never trust frontend amount
        const { data: bundle, error: bundleErr } = await supabaseAdmin
          .from("data_bundles")
          .select("id,network,label,price_public,active")
          .eq("id", packageId)
          .maybeSingle();

        if (bundleErr || !bundle) throw new Error("Package not found");
        if (!bundle.active) throw new Error("Package is no longer available");

        let finalPrice: number = bundle.price_public;
        const finalLabel = `${bundle.network} ${bundle.label}`;

        if (agentId) {
          // If buying from an agent's store, look up their verified sale price
          const { data: agentPkg, error: apErr } = await supabaseAdmin
            .from("agent_packages")
            .select("sale_price,active")
            .eq("agent_id", agentId)
            .eq("bundle_id", packageId)
            .maybeSingle();

          if (apErr || !agentPkg || !agentPkg.active) {
            throw new Error("Package is not available in this store");
          }
          finalPrice = agentPkg.sale_price;
        }

        amount = finalPrice;
        metadata = {
          purpose,
          packageId,
          productLabel: finalLabel,
          network: bundle.network,
          recipientPhone,
          buyerType: "public",
          agentId: agentId ?? null,
        };
      } else if (checkerId) {
        const { data: checker, error: checkerErr } = await supabaseAdmin
          .from("checker_packages")
          .select("id,price_public,checker_type,active,stock")
          .eq("id", checkerId)
          .maybeSingle();

        if (checkerErr || !checker) throw new Error("Checker package not found");
        if (!checker.active) throw new Error("Checker package is not available");
        if ((checker.stock ?? 0) <= 0) throw new Error("Checker package is out of stock");

        amount = checker.price_public;
        metadata = {
          purpose,
          checkerId,
          productLabel: `${checker.checker_type} Checker`,
          network: null,
          recipientPhone,
          buyerType: "public",
          agentId: null,
        };
      }

    // ── AGENT ACTIVATION ─────────────────────────────────────────────────────
    } else if (purpose === "agent_activation") {
      // Require the caller to be authenticated; extract userId from JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Authentication required for activation payment");

      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      if (!user?.id) throw new Error("Invalid session. Please log in again.");

      // Server-side canonical activation fee lookup
      const { data: feeSetting } = await supabaseAdmin
        .from("site_settings")
        .select("value")
        .eq("key", "agent_activation_fee")
        .maybeSingle();

      amount = Number(feeSetting?.value ?? 50);
      if (!Number.isFinite(amount) || amount <= 0) amount = 50;
      metadata = { purpose, userId: user.id };

    // ── WALLET TOP-UP ─────────────────────────────────────────────────────────
    } else if (purpose === "wallet_topup") {
      // Require authentication; get userId from JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Authentication required for wallet top-up");

      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await callerClient.auth.getUser();
      if (!user?.id) throw new Error("Invalid session. Please log in again.");

      const rawAmount = Number(body?.amount ?? 0);
      if (!Number.isFinite(rawAmount) || rawAmount < 5) {
        throw new Error("Minimum top-up amount is ₵5");
      }
      if (rawAmount > 5000) throw new Error("Maximum top-up amount is ₵5,000");

      amount = rawAmount;
      metadata = { purpose, userId: user.id };
    }

    const paystackPayload = {
      email,
      amount: Math.round(amount * 100),
      currency: "GHS",
      callback_url: callbackUrl,
      metadata,
    };

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const result = await response.json();
    if (!response.ok || !result?.status) {
      throw new Error(result?.message ?? "Failed to initialize Paystack payment");
    }

    return new Response(
      JSON.stringify({
        authorization_url: result.data?.authorization_url,
        reference: result.data?.reference,
        access_code: result.data?.access_code,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
