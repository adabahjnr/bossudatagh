import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type VerifyMeta = {
  purpose?: "order" | "agent_activation";
  userId?: string;
  productLabel?: string;
  network?: string | null;
  recipientPhone?: string;
  buyerType?: string;
  agentId?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!secretKey) throw new Error("Missing PAYSTACK_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase environment settings");

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") {
      throw new Error("reference is required");
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData?.status) {
      throw new Error(verifyData?.message ?? "Unable to verify payment");
    }

    const tx = verifyData?.data;
    if (tx?.status !== "success") {
      throw new Error(`Payment status is ${tx?.status ?? "unknown"}`);
    }

    const metadata = (tx?.metadata ?? {}) as VerifyMeta;
    const purpose = metadata.purpose;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (purpose === "agent_activation") {
      const userId = metadata.userId;
      if (!userId) throw new Error("Activation payment is missing userId metadata");

      const { data: existingUpgrade } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("type", "agent_upgrade")
        .eq("external_ref", reference)
        .maybeSingle();

      if (!existingUpgrade) {
        const { error: activateError } = await supabaseAdmin
          .from("profiles")
          .update({
            agent_activated: true,
            activation_paid_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .eq("role", "agent");

        if (activateError) throw activateError;

        const paidAmount = Number(tx.amount ?? 0) / 100;
        const { error: txError } = await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          type: "agent_upgrade",
          amount: paidAmount,
          description: "Agent activation payment",
          status: "completed",
          external_ref: reference,
          metadata: {
            gateway: "paystack",
            paystack_reference: reference,
          },
        });

        if (txError) throw txError;
      }

      return new Response(JSON.stringify({ ok: true, purpose: "agent_activation" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purpose === "order") {
      const { data: existingOrder } = await supabaseAdmin
        .from("orders")
        .select("id,ref,product_label,recipient_phone,amount,status,created_at")
        .eq("payment_ref", reference)
        .maybeSingle();

      if (existingOrder) {
        return new Response(JSON.stringify({ ok: true, purpose: "order", order: existingOrder }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!metadata.productLabel || !metadata.recipientPhone) {
        throw new Error("Order payment is missing required metadata");
      }

      const paidAmount = Number(tx.amount ?? 0) / 100;
      const generatedRef = `ps_${reference}`;

      const { data: insertedOrder, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          ref: generatedRef,
          product_label: metadata.productLabel,
          network: metadata.network ?? null,
          recipient_phone: metadata.recipientPhone,
          amount: paidAmount,
          buyer_type: metadata.buyerType ?? "public",
          agent_id: metadata.agentId ?? null,
          status: "processing",
          payment_ref: reference,
        })
        .select("id,ref,product_label,recipient_phone,amount,status,created_at")
        .single();

      if (orderError) throw orderError;

      if (insertedOrder?.id && metadata.agentId) {
        const { error: ledgerError } = await supabaseAdmin.from("transactions").insert({
          user_id: metadata.agentId,
          order_id: insertedOrder.id,
          type: "agent_order",
          amount: paidAmount,
          description: String(metadata.productLabel),
          status: "completed",
          external_ref: reference,
          metadata: {
            gateway: "paystack",
            paystack_reference: reference,
          },
        });

        if (ledgerError) throw ledgerError;
      }

      try {
        await fetch(`${supabaseUrl}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: insertedOrder.ref }),
        });
      } catch {
        // Order remains processing; admin can retry fulfillment.
      }

      return new Response(JSON.stringify({ ok: true, purpose: "order", order: insertedOrder }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported payment purpose in metadata");
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
