import { corsHeaders } from "../_shared/cors.ts";

type Purpose = "order" | "agent_activation";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      throw new Error("Missing PAYSTACK_SECRET_KEY");
    }

    const body = await req.json();
    const purpose = String(body?.purpose ?? "") as Purpose;
    const amount = Number(body?.amount ?? 0);
    const email = String(body?.email ?? "").trim();
    const callbackUrl = String(body?.callbackUrl ?? "").trim();
    const metadata = body?.metadata ?? {};

    if (purpose !== "order" && purpose !== "agent_activation") {
      throw new Error("Invalid payment purpose");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid amount");
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error("A valid email is required");
    }

    if (!callbackUrl) {
      throw new Error("callbackUrl is required");
    }

    const paystackPayload = {
      email,
      amount: Math.round(amount * 100),
      currency: "GHS",
      callback_url: callbackUrl,
      metadata: {
        ...metadata,
        purpose,
      },
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
