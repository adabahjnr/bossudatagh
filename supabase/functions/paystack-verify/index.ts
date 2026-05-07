import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type VerifyMeta = {
  purpose?: "order" | "agent_activation" | "wallet_topup";
  userId?: string;
  productLabel?: string;
  network?: string | null;
  recipientPhone?: string;
  buyerType?: string;
  agentId?: string | null;
  // Set by paystack-initialize for server-side price verification
  packageId?: string;
  checkerId?: string;
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

    if (purpose === "wallet_topup") {
      const userId = metadata.userId;
      if (!userId) throw new Error("Wallet top-up payment is missing userId metadata");

      const { data: existingTopup } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("type", "wallet_topup")
        .eq("external_ref", reference)
        .maybeSingle();

      if (!existingTopup) {
        const paidAmount = Number(tx.amount ?? 0) / 100;

        const { data: profileRow, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("wallet_balance")
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;

        const balanceBefore = Number(profileRow?.wallet_balance ?? 0);
        const balanceAfter = balanceBefore + paidAmount;

        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ wallet_balance: balanceAfter })
          .eq("id", userId);

        if (updateError) throw updateError;

        const { error: txError } = await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          type: "wallet_topup",
          amount: paidAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: "Wallet top-up via Paystack",
          status: "completed",
          external_ref: reference,
          metadata: {
            gateway: "paystack",
            paystack_reference: reference,
          },
        });

        if (txError) throw txError;
      }

      return new Response(JSON.stringify({ ok: true, purpose: "wallet_topup" }), {
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

      // Defense-in-depth: verify the paid amount matches the canonical package price
      if (metadata.packageId) {
        const priceQuery = metadata.agentId
          ? supabaseAdmin
              .from("agent_packages")
              .select("sale_price")
              .eq("agent_id", metadata.agentId)
              .eq("bundle_id", metadata.packageId)
              .maybeSingle()
          : supabaseAdmin
              .from("data_bundles")
              .select("price_public")
              .eq("id", metadata.packageId)
              .maybeSingle();

        const { data: priceRow } = await priceQuery;
        if (priceRow) {
          const expectedPrice: number = (priceRow as { sale_price?: number; price_public?: number }).sale_price
            ?? (priceRow as { sale_price?: number; price_public?: number }).price_public
            ?? 0;
          if (expectedPrice > 0 && Math.abs(paidAmount - expectedPrice) > 0.01) {
            throw new Error("Payment amount does not match the expected package price");
          }
        }
      }

      const generatedRef = `ps_${reference}`;

      const { data: insertedOrder, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          ref: generatedRef,
          product_label: metadata.productLabel,
          network: metadata.network ?? null,
          recipient_phone: metadata.recipientPhone,
          bundle_id: metadata.packageId ?? null,
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
