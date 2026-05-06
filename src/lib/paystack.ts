const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string);

type Purpose = "order" | "agent_activation" | "wallet_topup";

interface InitializePaymentInput {
  purpose: Purpose;
  amount: number;
  email: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

/**
 * Calls the paystack-initialize Edge Function via raw fetch (bypasses supabase.functions.invoke
 * middleware that can silently swallow errors or add headers that break the no-verify-jwt flow).
 * Returns the Paystack authorization_url to redirect to.
 */
export async function initializePaystackPayment(input: InitializePaymentInput): Promise<string> {
  const url = `${SUPABASE_URL}/functions/v1/paystack-initialize`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
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
