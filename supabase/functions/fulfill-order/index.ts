import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type NetworkCode = "MTN" | "TELECEL" | "AT";

function mapNetworkCode(network: string | null): NetworkCode {
  const n = (network || "").trim().toUpperCase();
  if (n === "MTN") return "MTN";
  if (n === "TELECEL") return "TELECEL";
  if (n === "AIRTELTIGO" || n === "AT") return "AT";
  throw new Error(`Unsupported network: ${network ?? "null"}`);
}

function cleanPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  if (digits.length === 12 && digits.startsWith("233")) return `0${digits.slice(3)}`;
  throw new Error("Invalid recipient phone number format");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const providerToken = Deno.env.get("DEVELOPER_API_BEARER_TOKEN");
    const providerBaseUrl = Deno.env.get("DEVELOPER_API_BASE_URL");

    if (!supabaseUrl || !serviceRole) {
      throw new Error("Missing Supabase service configuration");
    }
    if (!providerToken) {
      throw new Error("Missing DEVELOPER_API_BEARER_TOKEN");
    }
    if (!providerBaseUrl) {
      throw new Error("Missing DEVELOPER_API_BASE_URL");
    }

    const { ref } = await req.json();
    if (!ref || typeof ref !== "string") {
      throw new Error("Missing ref");
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,ref,network,recipient_phone,amount,status,fulfillment_error,bundle_id,product_label,data_bundles(size_mb)")
      .eq("ref", ref)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) throw new Error(`Order not found for ref ${ref}`);

    if (order.status === "delivered") {
      return new Response(
        JSON.stringify({ status: "delivered", ref: order.ref, alreadyDelivered: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const networkCode = mapNetworkCode(order.network);
    const customerNumber = cleanPhone(order.recipient_phone as string);

    // Compute package_size string from data_bundles.size_mb (e.g. 1024 → "1GB", 500 → "500MB")
    const bundle = (order as Record<string, unknown>).data_bundles as { size_mb: number } | null;
    let package_size: string;
    if (bundle && Number.isInteger(bundle.size_mb) && bundle.size_mb > 0) {
      const mb = bundle.size_mb;
      package_size = mb >= 1000 ? `${mb / 1000}GB` : `${mb}MB`;
    } else {
      // Fallback: parse from product_label e.g. "MTN 5GB" → "5GB"
      const labelMatch = String(order.product_label ?? "").match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
      if (!labelMatch) throw new Error("Cannot determine package_size from order");
      package_size = labelMatch[1].replace(/\s+/g, "").toUpperCase();
    }

    const providerRes = await fetch(`${providerBaseUrl}?action=airtime`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        networkCode,
        package_size,
        customerNumber,
        request_id: order.ref,
      }),
    });

    const providerText = await providerRes.text();
    let providerBody: unknown = null;
    try {
      providerBody = providerText ? JSON.parse(providerText) : null;
    } catch {
      providerBody = providerText;
    }

    if (!providerRes.ok) {
      const errorMessage =
        typeof providerBody === "object" && providerBody !== null && "message" in providerBody
          ? String((providerBody as Record<string, unknown>).message)
          : `Provider returned HTTP ${providerRes.status}`;

      const { error: failError } = await supabase
        .from("orders")
        .update({
          status: "failed",
          fulfillment_error: errorMessage,
        })
        .eq("id", order.id);

      if (failError) throw failError;

      return new Response(
        JSON.stringify({
          status: "failed",
          ref: order.ref,
          errorCode: `HTTP_${providerRes.status}`,
          errorMessage,
          provider: providerBody,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: okError } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        fulfillment_error: null,
      })
      .eq("id", order.id);

    if (okError) throw okError;

    return new Response(
      JSON.stringify({
        status: "delivered",
        ref: order.ref,
        provider: providerBody,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "failed",
        errorCode: "FULFILLMENT_ERROR",
        errorMessage: (error as Error).message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
