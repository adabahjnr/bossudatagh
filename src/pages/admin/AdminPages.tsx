import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { cedi, shortDate } from "@/lib/format";
import { toast } from "sonner";
import type { CheckerPackage, DataPackage, Network, Notification, Order, OrderStatus } from "@/lib/types";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { TrendingUp, ShoppingBag, Users, AlertCircle, DollarSign, Copy, Plus, Trash2 } from "lucide-react";

/* ================= OVERVIEW ================= */
export function AdminOverview() {
  const { state } = useStore();
  const totalRevenue = state.orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.amount, 0);
  const activeAgents = state.users.filter((u) => u.role === "agent" && u.active).length;
  const failed = state.orders.filter((o) => o.status === "failed").length;
  const pendingW = state.withdrawals.filter((w) => w.status === "pending").length;

  // Build last 7 days chart
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const total = state.orders.filter((o) => o.createdAt.slice(0, 10) === key && o.status === "delivered").reduce((s, o) => s + o.amount, 0);
    return { day: d.toLocaleDateString("en", { weekday: "short" }), revenue: total, orders: state.orders.filter((o) => o.createdAt.slice(0, 10) === key).length };
  });

  const stats = [
    { label: "Revenue", value: cedi(totalRevenue), icon: DollarSign, color: "bg-gradient-primary" },
    { label: "Orders", value: state.orders.length, icon: ShoppingBag, color: "bg-gradient-gold" },
    { label: "Active agents", value: activeAgents, icon: Users, color: "bg-success" },
    { label: "Pending withdrawals", value: pendingW, icon: TrendingUp, color: "bg-warning" },
    { label: "Failed orders", value: failed, icon: AlertCircle, color: "bg-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground uppercase">{s.label}</div>
                <div className="text-2xl font-bold mt-1">{s.value}</div>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${s.color} text-primary-foreground`}><s.icon className="h-5 w-5" /></div>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold mb-4">Revenue (last 7 days)</h3>
          <div className="h-64">
            <ResponsiveContainer><LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart></ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold mb-4">Orders (last 7 days)</h3>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="orders" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= ORDERS ================= */
export function AdminOrders() {
  const { state, updateOrderStatus } = useStore();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const list = state.orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-x-auto shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr><th className="text-left p-3">Ref</th><th className="text-left p-3">Product</th><th className="text-left p-3">Recipient</th><th className="text-left p-3">Amount</th><th className="text-left p-3">Status</th><th className="text-left p-3">Date</th><th className="text-right p-3">Actions</th></tr>
          </thead>
          <tbody>
            {list.map((o: Order) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{o.ref}</td>
                <td className="p-3">{o.productLabel}</td>
                <td className="p-3">{o.recipient}</td>
                <td className="p-3 font-medium">{cedi(o.amount)}</td>
                <td className="p-3"><Badge variant={o.status === "delivered" ? "default" : o.status === "failed" ? "destructive" : "secondary"}>{o.status}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{shortDate(o.createdAt)}</td>
                <td className="p-3 text-right space-x-1">
                  {o.status === "failed" && <Button size="sm" variant="outline" onClick={() => { updateOrderStatus(o.id, "processing"); toast.success("Retrying order"); setTimeout(() => updateOrderStatus(o.id, "delivered"), 1500); }}>Retry</Button>}
                  {o.status !== "refunded" && o.status !== "processing" && <Button size="sm" variant="ghost" onClick={() => { updateOrderStatus(o.id, "refunded"); toast.success("Refunded"); }}>Refund</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ================= PACKAGES ================= */
export function AdminPackages() {
  const { state, upsertPackage, deletePackage } = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<DataPackage | null>(null);
  const blank = (): DataPackage => ({ id: "p-" + Math.random().toString(36).slice(2, 8), network: "MTN", size: "1GB", validity: "30 days", pricePublic: 0, priceAgent: 0, active: true });
  const [form, setForm] = useState<DataPackage>(blank());

  const openNew = () => { setEdit(null); setForm(blank()); setOpen(true); };
  const openEdit = (p: DataPackage) => { setEdit(p); setForm(p); setOpen(true); };
  const save = () => { upsertPackage(form); toast.success(edit ? "Package updated" : "Package added"); setOpen(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Data Packages</h1><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add package</Button></div>
      <Card className="overflow-x-auto shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Network</th><th className="text-left p-3">Size</th><th className="text-left p-3">Validity</th><th className="text-left p-3">Public</th><th className="text-left p-3">Agent</th><th className="text-left p-3">Active</th><th className="text-right p-3">Actions</th></tr></thead>
          <tbody>
            {state.packages.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3"><Badge variant="outline">{p.network}</Badge></td>
                <td className="p-3 font-medium">{p.size}</td>
                <td className="p-3">{p.validity}</td>
                <td className="p-3">{cedi(p.pricePublic)}</td>
                <td className="p-3">{cedi(p.priceAgent)}</td>
                <td className="p-3"><Switch checked={p.active} onCheckedChange={(v) => upsertPackage({ ...p, active: v })} /></td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => { deletePackage(p.id); toast.success("Deleted"); }}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit" : "Add"} package</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Network</Label>
              <Select value={form.network} onValueChange={(v: Network) => setForm({ ...form, network: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MTN">MTN</SelectItem><SelectItem value="Telecel">Telecel</SelectItem><SelectItem value="AirtelTigo">AirtelTigo</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Size</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
              <div><Label>Validity</Label><Input value={form.validity} onChange={(e) => setForm({ ...form, validity: e.target.value })} /></div>
              <div><Label>Public price</Label><Input type="number" value={form.pricePublic} onChange={(e) => setForm({ ...form, pricePublic: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Agent price</Label><Input type="number" value={form.priceAgent} onChange={(e) => setForm({ ...form, priceAgent: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <Button className="w-full" onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================= CHECKERS ================= */
export function AdminCheckers() {
  const { state, upsertChecker } = useStore();
  const [batch, setBatch] = useState("");
  const [target, setTarget] = useState<CheckerPackage | null>(null);

  const upload = () => {
    if (!target) return;
    const lines = batch.split(/\s+/).filter(Boolean).length;
    upsertChecker({ ...target, stock: target.stock + lines });
    toast.success(`Added ${lines} PINs to ${target.type}`);
    setBatch(""); setTarget(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Result Checkers</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {state.checkers.map((c) => (
          <Card key={c.id} className="p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold">{c.type}</div>
                <div className="text-xs text-muted-foreground">Stock: {c.stock}</div>
              </div>
              <Switch checked={c.active} onCheckedChange={(v) => upsertChecker({ ...c, active: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div><Label>Public price</Label><Input type="number" defaultValue={c.pricePublic} onBlur={(e) => upsertChecker({ ...c, pricePublic: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Agent price</Label><Input type="number" defaultValue={c.priceAgent} onBlur={(e) => upsertChecker({ ...c, priceAgent: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <Dialog open={target?.id === c.id} onOpenChange={(o) => !o && setTarget(null)}>
              <DialogTrigger asChild><Button className="w-full mt-4" onClick={() => setTarget(c)}>Upload PIN batch</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Upload {c.type} PINs</DialogTitle></DialogHeader>
                <Textarea rows={8} placeholder="Paste PINs, one per line or space-separated" value={batch} onChange={(e) => setBatch(e.target.value)} />
                <Button className="w-full" onClick={upload}>Add to inventory</Button>
              </DialogContent>
            </Dialog>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ================= AGENTS ================= */
export function AdminAgents() {
  const { state, setUserActive, creditWallet } = useStore();
  const [credit, setCredit] = useState<{ id: string; amount: string } | null>(null);
  const agents = state.users.filter((u) => u.role === "agent" || u.role === "subagent");

  const doCredit = () => {
    if (!credit) return;
    const a = parseFloat(credit.amount);
    if (!a) { toast.error("Enter amount"); return; }
    creditWallet(credit.id, a); toast.success(`Credited ${cedi(a)}`); setCredit(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Agents</h1>
      <Card className="overflow-x-auto shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Role</th><th className="text-left p-3">Wallet</th><th className="text-left p-3">Sales</th><th className="text-left p-3">Status</th><th className="text-right p-3">Actions</th></tr></thead>
          <tbody>
            {agents.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                <td className="p-3"><Badge variant={u.role === "agent" ? "default" : "secondary"}>{u.role}</Badge></td>
                <td className="p-3 font-medium">{cedi(u.walletBalance)}</td>
                <td className="p-3">{cedi(u.totalSales ?? 0)}</td>
                <td className="p-3"><Switch checked={u.active} onCheckedChange={(v) => setUserActive(u.id, v)} /></td>
                <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => setCredit({ id: u.id, amount: "" })}>Credit wallet</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={!!credit} onOpenChange={(o) => !o && setCredit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Credit wallet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (₵)</Label><Input type="number" value={credit?.amount ?? ""} onChange={(e) => setCredit(credit && { ...credit, amount: e.target.value })} /></div>
            <Button className="w-full" onClick={doCredit}>Credit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================= WITHDRAWALS ================= */
export function AdminWithdrawals() {
  const { state, setWithdrawalStatus } = useStore();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Withdrawal Requests</h1>
      <Card className="overflow-x-auto shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Agent</th><th className="text-left p-3">Amount</th><th className="text-left p-3">MoMo</th><th className="text-left p-3">Network</th><th className="text-left p-3">Status</th><th className="text-left p-3">Date</th><th className="text-right p-3">Actions</th></tr></thead>
          <tbody>
            {state.withdrawals.map((w) => (
              <tr key={w.id} className="border-t border-border">
                <td className="p-3"><div className="font-medium">{w.agentName}</div><div className="text-xs text-muted-foreground">{w.accountName}</div></td>
                <td className="p-3 font-bold">{cedi(w.amount)}</td>
                <td className="p-3 font-mono text-xs">{w.momoNumber}</td>
                <td className="p-3">{w.network}</td>
                <td className="p-3"><Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>{w.status}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{shortDate(w.createdAt)}</td>
                <td className="p-3 text-right space-x-1">
                  {w.status === "pending" && (<>
                    <Button size="sm" onClick={() => { setWithdrawalStatus(w.id, "approved"); toast.success("Approved"); }}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setWithdrawalStatus(w.id, "rejected"); toast.success("Rejected"); }}>Reject</Button>
                  </>)}
                  {w.status === "approved" && <Button size="sm" variant="outline" onClick={() => { setWithdrawalStatus(w.id, "paid"); toast.success("Marked paid, wallet deducted"); }}>Mark paid</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ================= CAMPAIGNS ================= */
export function AdminCampaigns() {
  const { state, createCampaign, setCampaignActive } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; dataSize: string; network: Network; totalCodes: string }>({ name: "", dataSize: "1GB", network: "MTN", totalCodes: "10" });

  const create = () => {
    if (!form.name || !form.totalCodes) { toast.error("Fill all fields"); return; }
    createCampaign({ ...form, totalCodes: parseInt(form.totalCodes) });
    toast.success("Campaign created");
    setOpen(false);
  };

  const copyAll = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join("\n")); toast.success(`Copied ${codes.length} codes`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Free Data Campaigns</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Launch campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data size</Label><Input value={form.dataSize} onChange={(e) => setForm({ ...form, dataSize: e.target.value })} /></div>
                <div><Label>Network</Label>
                  <Select value={form.network} onValueChange={(v: Network) => setForm({ ...form, network: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="MTN">MTN</SelectItem><SelectItem value="Telecel">Telecel</SelectItem><SelectItem value="AirtelTigo">AirtelTigo</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Number of codes</Label><Input type="number" value={form.totalCodes} onChange={(e) => setForm({ ...form, totalCodes: e.target.value })} /></div>
              <Button className="w-full" onClick={create}>Generate codes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-4">
        {state.campaigns.map((c) => (
          <Card key={c.id} className="p-6 shadow-soft">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-bold text-lg">{c.name}</div>
                <div className="text-sm text-muted-foreground">{c.dataSize} {c.network} · {c.redeemed}/{c.totalCodes} redeemed</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">Active</span>
                <Switch checked={c.active} onCheckedChange={(v) => setCampaignActive(c.id, v)} />
                <Button size="sm" variant="outline" onClick={() => copyAll(c.codes.filter((x) => !x.redeemed).map((x) => x.code))}><Copy className="h-4 w-4 mr-1" /> Copy unused</Button>
              </div>
            </div>
            <div className="mt-4 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              {c.codes.slice(0, 30).map((cd) => (
                <div key={cd.code} className={`font-mono p-2 rounded ${cd.redeemed ? "bg-muted line-through opacity-50" : "bg-accent/10"}`}>{cd.code}</div>
              ))}
              {c.codes.length > 30 && <div className="p-2 text-muted-foreground">+{c.codes.length - 30} more</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ================= NOTIFICATIONS ================= */
export function AdminNotifications() {
  const { state, pushNotification } = useStore();
  const [form, setForm] = useState<Omit<Notification, "id" | "createdAt">>({ title: "", message: "", type: "info", audience: "all" });
  const send = () => {
    if (!form.title || !form.message) { toast.error("Fill title and message"); return; }
    pushNotification(form); toast.success("Notification sent"); setForm({ title: "", message: "", type: "info", audience: "all" });
  };
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <Card className="p-6 shadow-soft space-y-3">
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Type</Label>
            <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="alert">Emergency</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Audience</Label>
            <Select value={form.audience} onValueChange={(v: any) => setForm({ ...form, audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="agents">Agents only</SelectItem><SelectItem value="public">Public only</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={send}>Send notification</Button>
      </Card>
      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-3">Recent</h3>
        <div className="space-y-2">
          {state.notifications.map((n) => (
            <div key={n.id} className="border-b border-border pb-2 last:border-0">
              <div className="flex items-center gap-2"><Badge variant="outline">{n.type}</Badge><span className="font-semibold text-sm">{n.title}</span></div>
              <div className="text-xs text-muted-foreground mt-1">{n.message}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================= SETTINGS ================= */
export function AdminSettings() {
  const { state, updateSettings } = useStore();
  const [s, setS] = useState(state.settings);
  const save = () => { updateSettings(s); toast.success("Settings saved"); };
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Site Settings</h1>
      <Card className="p-6 shadow-soft space-y-3">
        <div><Label>Site name</Label><Input value={s.siteName} onChange={(e) => setS({ ...s, siteName: e.target.value })} /></div>
        <div><Label>WhatsApp number (intl format)</Label><Input value={s.whatsappNumber} onChange={(e) => setS({ ...s, whatsappNumber: e.target.value })} placeholder="233244000000" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Agent fee (₵)</Label><Input type="number" value={s.agentFee} onChange={(e) => setS({ ...s, agentFee: parseFloat(e.target.value) || 0 })} /></div>
          <div><Label>Min withdrawal (₵)</Label><Input type="number" value={s.minWithdrawal} onChange={(e) => setS({ ...s, minWithdrawal: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <Button onClick={save}>Save</Button>
      </Card>
    </div>
  );
}

/* ================= MAINTENANCE ================= */
export function AdminMaintenance() {
  const { state, updateSettings } = useStore();
  const [msg, setMsg] = useState(state.settings.maintenanceMessage);
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Maintenance Mode</h1>
      <Card className="p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10 border border-warning/30">
          <div>
            <div className="font-semibold">Lock entire platform</div>
            <div className="text-xs text-muted-foreground">Public site, agent dashboard, stores & API will be inaccessible. Only admins retain access.</div>
          </div>
          <Switch checked={state.settings.maintenanceMode} onCheckedChange={(v) => { updateSettings({ maintenanceMode: v }); toast.success(v ? "Maintenance ON" : "Maintenance OFF"); }} />
        </div>
        <div>
          <Label>Message displayed to users</Label>
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} />
        </div>
        <Button onClick={() => { updateSettings({ maintenanceMessage: msg }); toast.success("Message updated"); }}>Save message</Button>
      </Card>
    </div>
  );
}