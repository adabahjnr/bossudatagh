import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment settings");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [
      profilesRes,
      storesRes,
      bundlesRes,
      agentPackagesRes,
      checkersRes,
      ordersRes,
      withdrawalsRes,
      campaignsRes,
      codesRes,
      notificationsRes,
      settingsRes,
    ] = await Promise.all([
      adminClient
        .from("profiles")
        .select("id,role,name,phone,store_slug,store_template,store_logo,store_brand,parent_agent_id,api_key,referral_code,wallet_balance,total_sales,total_referrals,badges,active,agent_activated,activation_paid_at,created_at"),
      adminClient.from("stores").select("agent_id,slug,brand_name,logo_url,template"),
      adminClient
        .from("data_bundles")
        .select("id,network,label,validity_days,price_public,price_agent,active")
        .order("sort_order", { ascending: true }),
      adminClient.from("agent_packages").select("id,agent_id,bundle_id,sale_price,active,created_at,updated_at"),
      adminClient.from("checker_packages").select("id,checker_type,price_public,price_agent,stock,active"),
      adminClient
        .from("orders")
        .select("id,ref,product_label,network,recipient_phone,guest_email,amount,status,created_at,buyer_type,agent_id,fulfillment_error")
        .order("created_at", { ascending: false }),
      adminClient
        .from("withdrawals")
        .select("id,agent_id,amount,momo_number,momo_network,account_name,status,created_at,profiles:agent_id(name)")
        .order("created_at", { ascending: false }),
      adminClient
        .from("free_data_campaigns")
        .select("id,name,data_size,network,total_codes,redeemed_count,active,created_at")
        .order("created_at", { ascending: false }),
      adminClient.from("campaign_codes").select("campaign_id,code,redeemed,redeemed_by"),
      adminClient
        .from("notifications")
        .select("id,title,message,type,audience,created_at")
        .order("created_at", { ascending: false }),
      adminClient.from("site_settings").select("key,value"),
    ]);

    const firstError = [
      profilesRes.error,
      storesRes.error,
      bundlesRes.error,
      agentPackagesRes.error,
      checkersRes.error,
      ordersRes.error,
      withdrawalsRes.error,
      campaignsRes.error,
      codesRes.error,
      notificationsRes.error,
      settingsRes.error,
    ].find(Boolean);

    if (firstError) {
      throw firstError;
    }

    return new Response(
      JSON.stringify({
        profiles: profilesRes.data ?? [],
        stores: storesRes.data ?? [],
        bundles: bundlesRes.data ?? [],
        agentPackages: agentPackagesRes.data ?? [],
        checkers: checkersRes.data ?? [],
        orders: ordersRes.data ?? [],
        withdrawals: withdrawalsRes.data ?? [],
        campaigns: campaignsRes.data ?? [],
        codes: codesRes.data ?? [],
        notifications: notificationsRes.data ?? [],
        settings: settingsRes.data ?? [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
