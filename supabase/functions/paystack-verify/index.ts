import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
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