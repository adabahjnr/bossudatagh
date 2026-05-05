import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { createHmac } from "node:crypto";

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
  if (req.method !== "POST") return new Response("ok");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const paystackSecret = await resolvePaystackSecret(supabase);

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", paystackSecret).update(raw).digest("hex");
  if (signature !== expected) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event?.event !== "charge.success") {
    return new Response("ignored", { status: 200 });
  }

  const data = event.data ?? {};
  const ref: string = data.reference;
  const paidAmount: number = Number(data.amount ?? 0) / 100; // GHS
  const meta = data.metadata ?? {};
  const purpose: string = meta.purpose ?? "order";

  if (purpose === "wallet_topup") {
    const userId: string | null = meta.userId ?? null;
    if (!userId) return new Response("missing userId", { status: 200 });
    // Idempotency: skip if already recorded
    const { data: existing } = await supabase
      .from("wallet_transactions").select("id").eq("ref", ref).maybeSingle();
    if (existing) return new Response("ok", { status: 200 });

    const { data: prof } = await supabase
      .from("profiles").select("wallet_balance").eq("id", userId).maybeSingle();
    const newBal = Number(prof?.wallet_balance ?? 0) + paidAmount;
    await supabase.from("profiles").update({ wallet_balance: newBal }).eq("id", userId);
    await supabase.from("wallet_transactions").insert({
      user_id: userId, type: "topup", amount: paidAmount,
      description: "Paystack wallet top-up", ref,
    });
    return new Response("ok", { status: 200 });
  }

  if (purpose === "agent_signup") {
    // The signup itself is finalized client-side after Paystack redirect.
    // We just log a wallet transaction marker so the ref can be verified.
    await supabase.from("wallet_transactions").insert({
      user_id: meta.userId ?? "00000000-0000-0000-0000-000000000000",
      type: "topup", amount: paidAmount,
      description: "Agent registration fee", ref,
    }).then(() => {}, () => {});
    return new Response("ok", { status: 200 });
  }

  // Default: order
  const agentId: string | null = meta.agentId ?? null;
  const packageId: string | null = meta.packageId ?? null;
  const { data: order } = await supabase
    .from("orders").select("id, status").eq("ref", ref).maybeSingle();
  if (!order) return new Response("order not found", { status: 200 });
  if (order.status !== "delivered") {
    await supabase.from("orders").update({ status: "delivered" }).eq("id", order.id);
  }
  if (agentId && packageId) {
    await supabase.rpc("record_agent_sale", {
      _agent_id: agentId,
      _package_id: packageId,
      _sale_price: paidAmount,
      _order_ref: ref,
    });
  }
  return new Response("ok", { status: 200 });
});