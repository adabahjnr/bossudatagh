// Supabase disconnected — this bridge is disabled. App runs on local store only.

export function SupabaseDataBridge() {
  return null;
}
  const { setState } = useStore();
  const { user, isAdmin } = useAuth();

  // Load public catalog + settings (everyone)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: pkgs }, { data: chks }, { data: settings }, { data: notifs }, { data: camps }, { data: codes }] =
        await Promise.all([
          supabase.from("data_packages").select("*").order("network").order("size"),
          supabase.from("checker_packages").select("*").order("type"),
          supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
          supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
          supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
          supabase.from("campaign_codes").select("*"),
        ]);
      if (cancelled) return;

      const packages: DataPackage[] = (pkgs ?? []).map((p) => ({
        id: p.id,
        network: p.network as Network,
        size: p.size,
        validity: p.validity,
        pricePublic: Number(p.price_public),
        priceAgent: Number(p.price_agent),
        active: p.active,
      }));
      const checkers: CheckerPackage[] = (chks ?? []).map((c) => ({
        id: c.id,
        type: c.type as "BECE" | "WASSCE",
        pricePublic: Number(c.price_public),
        priceAgent: Number(c.price_agent),
        stock: c.stock,
        active: c.active,
      }));
      const codesByCampaign = new Map<string, { code: string; redeemed: boolean; redeemedBy?: string }[]>();
      (codes ?? []).forEach((cd) => {
        const arr = codesByCampaign.get(cd.campaign_id) ?? [];
        arr.push({ code: cd.code, redeemed: cd.redeemed, redeemedBy: cd.redeemed_by ?? undefined });
        codesByCampaign.set(cd.campaign_id, arr);
      });
      const campaigns: FreeDataCampaign[] = (camps ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        dataSize: c.data_size,
        network: c.network as Network,
        totalCodes: c.total_codes,
        redeemed: c.redeemed,
        codes: codesByCampaign.get(c.id) ?? [],
        active: c.active,
        createdAt: c.created_at,
      }));
      const notifications: Notification[] = (notifs ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type as Notification["type"],
        audience: n.audience as Notification["audience"],
        createdAt: n.created_at,
      }));
      const siteSettings: Partial<SiteSettings> = settings
        ? {
            siteName: settings.site_name,
            whatsappNumber: settings.whatsapp_number,
            agentFee: Number(settings.agent_fee),
            minWithdrawal: Number(settings.min_withdrawal),
            maintenanceMode: settings.maintenance_mode,
            maintenanceMessage: settings.maintenance_message,
            banner: settings.banner ?? undefined,
          }
        : {};

      setState((s) => ({
        ...s,
        packages,
        checkers,
        campaigns,
        notifications,
        settings: { ...s.settings, ...siteSettings },
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [setState]);

  // Load orders, withdrawals, profiles for signed-in users.
  // Admin sees everything; agents see their own.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const ordersQ = isAdmin
        ? supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500)
        : supabase.from("orders").select("*").eq("agent_id", user.id).order("created_at", { ascending: false }).limit(200);
      const withdrawalsQ = isAdmin
        ? supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(200)
        : supabase.from("withdrawals").select("*").eq("agent_id", user.id).order("created_at", { ascending: false });
      const profilesQ = isAdmin
        ? supabase.from("profiles").select("*")
        : supabase.from("profiles").select("*").or(`id.eq.${user.id},parent_agent_id.eq.${user.id}`);

      const [{ data: orders }, { data: ws }, { data: profs }, { data: roleRows }] = await Promise.all([
        ordersQ,
        withdrawalsQ,
        profilesQ,
        isAdmin
          ? supabase.from("user_roles").select("user_id, role")
          : supabase.from("user_roles").select("user_id, role").eq("user_id", user.id),
      ]);
      if (cancelled) return;

      const orderRows: Order[] = (orders ?? []).map((o) => ({
        id: o.id,
        ref: o.ref,
        productLabel: o.product_label,
        network: (o.network ?? undefined) as Network | undefined,
        recipient: o.recipient,
        email: o.email ?? undefined,
        amount: Number(o.amount),
        status: o.status as Order["status"],
        createdAt: o.created_at,
        buyerType: o.buyer_type as Order["buyerType"],
        agentId: o.agent_id ?? undefined,
      }));

      const withdrawalRows: WithdrawalRequest[] = (ws ?? []).map((w) => ({
        id: w.id,
        agentId: w.agent_id,
        agentName: "",
        amount: Number(w.amount),
        momoNumber: w.momo_number,
        network: w.network as Network,
        accountName: w.account_name,
        status: w.status as WithdrawalRequest["status"],
        createdAt: w.created_at,
      }));

      const rolesByUser = new Map<string, string[]>();
      (roleRows ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      type ProfRow = {
        id: string;
        name: string;
        phone: string;
        store_slug: string | null;
        store_template: string | null;
        store_logo: string | null;
        store_brand: string | null;
        parent_agent_id: string | null;
        api_key: string | null;
        referral_code: string | null;
        wallet_balance: number;
        total_sales: number;
        total_referrals: number;
        badges: string[];
        active: boolean;
        created_at: string;
      };

      const userRows: User[] = ((profs ?? []) as ProfRow[]).map((p) => {
        const roleArr = rolesByUser.get(p.id) ?? [];
        const role: User["role"] = roleArr.includes("admin")
          ? "admin"
          : roleArr.includes("subagent")
            ? "subagent"
            : "agent";
        return {
          id: p.id,
          name: p.name,
          email: "",
          phone: p.phone ?? "",
          role,
          walletBalance: Number(p.wallet_balance ?? 0),
          storeSlug: p.store_slug ?? undefined,
          storeTemplate: (p.store_template as User["storeTemplate"]) ?? "neon",
          storeBrand: p.store_brand ?? undefined,
          storeLogo: p.store_logo ?? undefined,
          parentAgentId: p.parent_agent_id ?? undefined,
          apiKey: p.api_key ?? undefined,
          referralCode: p.referral_code ?? undefined,
          totalSales: p.total_sales ?? 0,
          totalReferrals: p.total_referrals ?? 0,
          badges: p.badges ?? [],
          createdAt: p.created_at,
          active: p.active,
        };
      });

      // Attach agent names to withdrawals
      const nameById = new Map(userRows.map((u) => [u.id, u.name]));
      withdrawalRows.forEach((w) => {
        w.agentName = nameById.get(w.agentId) ?? "Agent";
      });

      setState((s) => {
        // Merge users: keep currently-logged-in user mirrored by AuthStoreBridge.
        const map = new Map<string, User>();
        s.users.forEach((u) => map.set(u.id, u));
        userRows.forEach((u) => {
          const existing = map.get(u.id);
          map.set(u.id, existing ? { ...existing, ...u, email: existing.email || u.email } : u);
        });
        return {
          ...s,
          orders: orderRows,
          withdrawals: withdrawalRows,
          users: Array.from(map.values()),
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, setState]);

  // Realtime updates for the most fluid surfaces
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("geteasy-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // simple refetch
        const q = isAdmin
          ? supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500)
          : supabase.from("orders").select("*").eq("agent_id", user.id).order("created_at", { ascending: false }).limit(200);
        q.then(({ data }) => {
          if (!data) return;
          const rows: Order[] = data.map((o) => ({
            id: o.id,
            ref: o.ref,
            productLabel: o.product_label,
            network: (o.network ?? undefined) as Network | undefined,
            recipient: o.recipient,
            email: o.email ?? undefined,
            amount: Number(o.amount),
            status: o.status as Order["status"],
            createdAt: o.created_at,
            buyerType: o.buyer_type as Order["buyerType"],
            agentId: o.agent_id ?? undefined,
          }));
          setState((s) => ({ ...s, orders: rows }));
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, isAdmin, setState]);

  return null;
}