import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_PROVIDER_ENDPOINT = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api/airtime";

function toJsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeErrorText(input: unknown) {
  return String(input ?? "").trim().toLowerCase();
}

function isProviderInsufficientBalance(code: unknown, message: unknown) {
  const raw = `${normalizeErrorText(code)} ${normalizeErrorText(message)}`;
  return (
    raw.includes("insufficient") && raw.includes("balance") ||
    raw.includes("not enough balance") ||
    raw.includes("low balance")
  );
}

function looksLikeSuccess(body: Record<string, unknown>, httpOk: boolean) {
  const status = normalizeErrorText(body.status ?? body.state ?? body.result ?? body.message);
  const success = body.success === true || body.ok === true;
  return httpOk && (success || status === "success" || status === "successful" || status === "ok" || status === "delivered" || status === "completed");
}

async function resolveDataProviderConfig(supabase: ReturnType<typeof createClient>) {
  try {
    const { data } = await supabase
      .schema("private")
      .from("app_secrets")
      .select("secret_name,secret_value")
      .in("secret_name", ["DATA_API_ENDPOINT", "DATA_API_TOKEN"]);

    const endpoint = data?.find((x) => x.secret_name === "DATA_API_ENDPOINT")?.secret_value;
    const token = data?.find((x) => x.secret_name === "DATA_API_TOKEN")?.secret_value;

    if (endpoint && endpoint.length > 0) {
      return { endpoint, token: token ?? "" };
    }

    if (token && token.length > 0) {
      return { endpoint: DEFAULT_PROVIDER_ENDPOINT, token };
    }
  } catch {
    // Fall back to edge environment variables when private table is unavailable.
  }

  const endpoint = Deno.env.get("DATA_API_ENDPOINT") ?? DEFAULT_PROVIDER_ENDPOINT;
  const token = Deno.env.get("DATA_API_TOKEN") ?? "";
  if (!endpoint) throw new Error("Missing DATA_API_ENDPOINT. Set it in private.app_secrets or edge secrets.");
  if (!token) throw new Error("Missing DATA_API_TOKEN. Set it in private.app_secrets or edge secrets.");

  return { endpoint, token };
}

function mapNetworkCode(network: string | null): string | null {
  if (!network) return null;
  if (network === "MTN") return "MTN";
  if (network === "Telecel") return "TELECEL";
  if (network === "AirtelTigo") return "AT";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return toJsonResponse(405, { error: "Method not allowed" });

  try {
    const { ref } = await req.json();
    if (!ref) return toJsonResponse(400, { error: "Missing ref" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { endpoint, token } = await resolveDataProviderConfig(supabase);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,ref,product_label,network,recipient,amount,status")
      .eq("ref", ref)
      .maybeSingle();

    if (orderError) return toJsonResponse(500, { error: orderError.message });
    if (!order) return toJsonResponse(404, { error: "Order not found" });
    if (order.status === "delivered") {
      return toJsonResponse(200, { ok: true, status: "delivered" });
    }

    const networkCode = mapNetworkCode(order.network ?? null);
    if (!networkCode) {
      return toJsonResponse(400, { error: "Unsupported or missing order network" });
    }

    // Extract package_size from product_label (e.g. "MTN 5GB" → "5GB", "Telecel 500MB" → "500MB")
    const sizeStr: string = (order.product_label as string).replace(/^\S+\s+/, "").trim();
    if (!sizeStr.match(/([\d.]+)\s*(GB|MB)/i)) {
      return toJsonResponse(400, { error: `Cannot parse data size from "${order.product_label}"` });
    }

    const payload = {
      networkCode,
      package_size: sizeStr,
      customerNumber: order.recipient,
      request_id: `${order.ref}-${Date.now()}`,
    };

    const providerRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    let providerBody: Record<string, unknown> = {};
    try {
      providerBody = await providerRes.json();
    } catch {
      providerBody = { raw: await providerRes.text() };
    }

    const success = looksLikeSuccess(providerBody, providerRes.ok);
    const externalCode = String(providerBody.error_code ?? providerBody.code ?? "").trim();
    const externalMessage = String(providerBody.message ?? providerBody.error ?? providerBody.detail ?? "").trim();
    const insufficientBalance = isProviderInsufficientBalance(externalCode, externalMessage);

    const nextStatus = success ? "delivered" : "failed";
    const nextErrorCode = success
      ? null
      : insufficientBalance
        ? "PROVIDER_INSUFFICIENT_BALANCE"
        : externalCode || "PROVIDER_REQUEST_FAILED";
    const nextErrorMessage = success ? null : (externalMessage || `Provider returned HTTP ${providerRes.status}`);

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", order.id);

    if (updateError) return toJsonResponse(500, { error: updateError.message });

    return toJsonResponse(200, {
      ok: success,
      status: nextStatus,
      errorCode: nextErrorCode,
      errorMessage: nextErrorMessage,
      providerResponse: providerBody,
    });
  } catch (e) {
    return toJsonResponse(500, { error: String((e as Error).message ?? e) });
  }
});
