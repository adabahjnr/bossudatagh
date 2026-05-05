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
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const paystackSecret = await resolvePaystackSecret(supabase);
    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const json = await res.json();
    const ok = json?.status && json?.data?.status === "success";
    return new Response(JSON.stringify({
      ok,
      amount: ok ? Number(json.data.amount) / 100 : 0,
      metadata: json?.data?.metadata ?? {},
      raw: json?.data?.status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});