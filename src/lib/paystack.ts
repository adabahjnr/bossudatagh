import { supabase } from "@/integrations/supabase/client";

const PROJECT_REF = "ukdjfzllnlykwjqknqqe";
const FALLBACK_SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_URL =
  ENV_SUPABASE_URL && ENV_SUPABASE_URL.includes(`${PROJECT_REF}.supabase.co`)
    ? ENV_SUPABASE_URL
    : FALLBACK_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrZGpmemxsbmx5a3dqcWtucXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTkzNDMsImV4cCI6MjA5MzEzNTM0M30.UbF8nscWMGvHFWWkW3cBjVmjvdRjHJuUbXZucsBlZ4c";

/** For data bundle purchases (public storefront or agent mini-store) */
export interface OrderPaymentInput {
  purpose: "order";
  email: string;
  callbackUrl: string;
  recipientPhone: string;
  packageId?: string;  // data_bundles.id
  checkerId?: string;  // checker_packages.id
  agentId?: string;    // if buying from an agent's mini-store
}

/** For agent account activation */
export interface ActivationPaymentInput {
  purpose: "agent_activation";
  email: string;
  callbackUrl: string;
}

/** For wallet top-up (amount is user-chosen, validated server-side min ₵5 max ₵5,000) */
export interface TopupPaymentInput {
  purpose: "wallet_topup";
  email: string;
  callbackUrl: string;
  amount: number;
}

export type InitializePaymentInput = OrderPaymentInput | ActivationPaymentInput | TopupPaymentInput;

/**
 * Calls the paystack-initialize Edge Function via raw fetch.
 * Includes the auth token for purposes that require it (activation, topup).
 * Returns the Paystack authorization_url to redirect to.
 */
export async function initializePaystackPayment(input: InitializePaymentInput): Promise<string> {
  const url = `${SUPABASE_URL}/functions/v1/paystack-initialize`;

  // Include JWT for authenticated purposes so server can derive userId securely
  const { data: sessionData } = await supabase.auth.getSession();
  const authToken = sessionData?.session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Paystack function returned non-JSON (status ${res.status})`);
  }

  if (!res.ok || body?.error) {
    throw new Error(String(body?.error ?? `Request failed with status ${res.status}`));
  }

  const authUrl = body?.authorization_url as string | undefined;
  if (!authUrl) {
    throw new Error("Paystack did not return a payment URL. Check Edge Function logs.");
  }

  return authUrl;
}

export function redirectToPayment(authUrl: string) {
  if (!authUrl || typeof authUrl !== "string") {
    throw new Error("Invalid payment redirect URL");
  }
  window.location.assign(authUrl);
}

export async function verifyPaystackPayment(reference: string): Promise<Record<string, unknown>> {
  const url = `${SUPABASE_URL}/functions/v1/paystack-verify`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ reference }),
  });

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Paystack verify function returned non-JSON (status ${res.status})`);
  }

  if (!res.ok || body?.error) {
    throw new Error(String(body?.error ?? `Verification failed with status ${res.status}`));
  }

  return body;
}
