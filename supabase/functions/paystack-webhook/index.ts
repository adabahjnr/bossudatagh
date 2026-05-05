import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { createHmac } from "node:crypto";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(raw).digest("hex");
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
  const agentId: string | null = meta.agentId ?? null;
  const packageId: string | null = meta.packageId ?? null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Mark order delivered
  const { data: order } = await supabase
    .from("orders").select("id, status, amount, agent_id")
    .eq("ref", ref).maybeSingle();

  if (!order) return new Response("order not found", { status: 200 });

  if (order.status !== "delivered") {
    await supabase.from("orders").update({ status: "delivered" }).eq("id", order.id);
  }

  // Record agent profit if applicable
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