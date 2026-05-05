import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      email,
      amount,            // GHS
      productLabel,
      network,
      recipient,         // phone
      agentId,
      packageId,
      buyerType,         // "public" | "agent"
    } = body ?? {};

    if (!email || !amount || !productLabel || !recipient) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const ref = "BD-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

    const { error: insErr } = await supabase.from("orders").insert({
      ref,
      product_label: productLabel,
      network: network ?? null,
      recipient,
      email,
      amount,
      buyer_type: buyerType ?? "public",
      agent_id: agentId ?? null,
      status: "processing",
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") ?? "";
    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100), // pesewas
        currency: "GHS",
        reference: ref,
        callback_url: origin ? `${origin}/track?ref=${ref}` : undefined,
        metadata: { agentId, packageId, recipient, productLabel, network, buyerType },
      }),
    });
    const initData = await initRes.json();
    if (!initData?.status) {
      return new Response(JSON.stringify({ error: initData?.message ?? "Paystack init failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ref,
        authorization_url: initData.data.authorization_url,
        access_code: initData.data.access_code,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});