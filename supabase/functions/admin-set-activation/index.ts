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

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) {
      throw new Error("Missing SUPABASE_ANON_KEY");
    }

    // Validate caller identity from JWT, then authorize with robust admin detection.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    const user = userData.user;
    if (userErr || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authRoles = new Set<string>();
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const roleCandidates = [appMeta.role, appMeta.user_role, appMeta.roles, userMeta.role, userMeta.user_role];
    for (const candidate of roleCandidates) {
      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          if (typeof item === "string") authRoles.add(item.trim().toLowerCase());
        }
      } else if (typeof candidate === "string") {
        authRoles.add(candidate.trim().toLowerCase());
      }
    }

    const { data: callerProfile, error: callerErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdminByProfile = callerProfile?.role === "admin";
    const isAdminByAuth = authRoles.has("admin");

    if (callerErr || (!isAdminByProfile && !isAdminByAuth)) {
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
