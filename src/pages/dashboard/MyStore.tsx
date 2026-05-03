import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Copy, ExternalLink, Share2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Link } from "react-router-dom";

const templates = [
  { id: "neon", name: "Neon", desc: "Vibrant gradients, bold cards" },
  { id: "minimal", name: "Minimal", desc: "Clean, spacious, professional" },
  { id: "bold", name: "Bold", desc: "High-contrast, statement style" },
] as const;

export default function MyStore() {
  const { currentUser, setState } = useStore();
  const [brand, setBrand] = useState(currentUser?.storeBrand ?? "");
  if (!currentUser) return null;

  const url = `${window.location.origin}/store/${currentUser.storeSlug}`;
  const refLink = `${window.location.origin}/become-agent?ref=${currentUser.referralCode}`;

  const update = (patch: Partial<typeof currentUser>) =>
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === currentUser.id ? { ...u, ...patch } : u)) }));

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">My Store</h1>
        <p className="text-muted-foreground">Customize your branded mini-store. Each store looks unique.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/dashboard/store/packages">Manage store packages</Link>
        </Button>
      </div>

      <Card className="p-6 shadow-soft">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Your store URL</div>
            <div className="font-mono font-semibold mt-1 break-all">{url}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(url, "Store URL")}><Copy className="h-4 w-4" /></Button>
            <Button asChild size="sm"><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Visit</a></Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Branding</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Store name</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} onBlur={() => update({ storeBrand: brand })} />
          </div>
          <div className="space-y-2">
            <Label>Logo URL (optional)</Label>
            <Input defaultValue={currentUser.storeLogo ?? ""} onBlur={(e) => update({ storeLogo: e.target.value })} placeholder="https://..." />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-4">Pick a template</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {templates.map((t) => {
            const active = currentUser.storeTemplate === t.id;
            return (
              <button key={t.id} onClick={() => update({ storeTemplate: t.id })}
                className={`text-left p-5 rounded-xl border-2 transition-smooth ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <div className={`h-20 rounded-lg mb-3 ${
                  t.id === "neon" ? "bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600" :
                  t.id === "minimal" ? "bg-gradient-to-br from-slate-100 to-slate-300 border" :
                  "bg-gradient-to-br from-amber-400 via-red-500 to-rose-700"
                }`} />
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
                {active && <div className="mt-2 text-xs text-primary font-medium">Active</div>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 shadow-soft bg-gradient-primary text-primary-foreground">
        <div className="flex items-center gap-2 mb-2"><Share2 className="h-5 w-5" /><h3 className="font-semibold">Referral link</h3></div>
        <p className="text-sm opacity-90">Earn bonuses when new agents sign up via your link.</p>
        <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-lg p-2">
          <Link2 className="h-4 w-4 ml-1" />
          <code className="text-xs flex-1 truncate">{refLink}</code>
          <Button size="sm" variant="ghost" className="hover:bg-white/20" onClick={() => copy(refLink, "Referral link")}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}