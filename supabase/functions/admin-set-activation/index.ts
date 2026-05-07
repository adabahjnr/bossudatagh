import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Verify the caller is an authenticated admin using their JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the caller's JWT to verify admin role via anon client.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const callerClient = createClient(supabaseUrl, anonKey ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerProfile, error: callerErr } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", (await callerClient.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();

    if (callerErr || callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agentId, allow } = await req.json();
    if (!agentId || typeof allow !== "boolean") {
      return new Response(JSON.stringify({ error: "agentId and allow are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client — bypasses RLS entirely.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await admin
      .from("profiles")
      .update({
        agent_activated: allow,
        activation_paid_at: allow ? new Date().toISOString() : null,
      })
      .eq("id", agentId)
      .eq("role", "agent");

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
