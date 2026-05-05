import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function resolvePaystackSecret(supabase: ReturnType<typeof createClient>) {
  try {
    const { data } = await supabase
      .schema("private")
      .from("app_secrets")
      .select("secret_value")
      .eq("secret_name", "PAYSTACK_SECRET_KEY")
      .maybeSingle();

    const fromDb = data?.secret_value;
    if (typeof fromDb === "string" && fromDb.length > 0) return fromDb;
  } catch {
    // Fall back to environment variable when the private table is not yet present.
  }

  const fromEnv = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  throw new Error("Missing PAYSTACK secret. Add PAYSTACK_SECRET_KEY in private.app_secrets or edge secrets.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      purpose = "order", // "order" | "agent_signup" | "wallet_topup"
      email,
      amount,            // GHS
      productLabel,
      network,
      recipient,         // phone
      agentId,
      packageId,
      buyerType,         // "public" | "agent"
      signupData,        // { name, phone, password, storeSlug } for agent_signup
      userId,            // wallet_topup
    } = body ?? {};

    if (!email || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const paystackSecret = await resolvePaystackSecret(supabase);
    const ref = "BD-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

    if (purpose === "order") {
      if (!productLabel || !recipient) {
        return new Response(JSON.stringify({ error: "Missing order fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
    }

    const origin = req.headers.get("origin") ?? "";
    const callbackPath =
      purpose === "agent_signup" ? "/dashboard"
      : purpose === "wallet_topup" ? "/dashboard/wallet"
      : `/track?ref=${ref}`;

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100), // pesewas
        currency: "GHS",
        reference: ref,
        callback_url: origin ? `${origin}${callbackPath}` : undefined,
        metadata: {
          purpose,
          agentId, packageId, recipient, productLabel, network, buyerType,
          signupData, userId,
        },
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