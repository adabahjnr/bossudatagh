import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { cedi } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { MessageCircle, Zap, Rocket } from "lucide-react";
import type { CheckerPackage, DataPackage, Network } from "@/lib/types";

const POPUP_KEY = "geteasydata.store.popup.seen";

export default function MiniStore() {
  const { slug } = useParams();
  const { state } = useStore();
  const agent = state.users.find((u) => u.storeSlug === slug && u.role === "agent");
  const [popup, setPopup] = useState(false);
  const [net, setNet] = useState<Network>("MTN");
  const [purchase, setPurchase] = useState<{ kind: "data"; pkg: DataPackage; agentId: string } | { kind: "checker"; pkg: CheckerPackage; agentId: string } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(POPUP_KEY)) {
      const t = setTimeout(() => setPopup(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);
  const dismiss = () => { localStorage.setItem(POPUP_KEY, "1"); setPopup(false); };

  const packages = useMemo(() => state.packages.filter((p) => p.active && p.network === net), [state.packages, net]);
  const checkers = state.checkers.filter((c) => c.active);
  const wa = state.settings.whatsappNumber;

  if (!agent) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="text-muted-foreground mt-2">This store doesn't exist or is no longer active.</p>
          <Button asChild className="mt-4"><Link to="/">Back to GetEasyData</Link></Button>
        </div>
      </div>
    );
  }

  const tpl = agent.storeTemplate ?? "neon";
  const themes: Record<string, { bg: string; card: string; accent: string; header: string; pill: string }> = {
    neon: {
      bg: "min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 text-white",
      card: "rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-5 shadow-2xl",
      accent: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",
      header: "border-b border-white/10",
      pill: "rounded-full px-4 py-1.5 text-sm border",
    },
    minimal: {
      bg: "min-h-screen bg-slate-50 text-slate-900",
      card: "rounded-xl bg-white border border-slate-200 p-5 shadow-sm",
      accent: "bg-slate-900 text-white",
      header: "border-b border-slate-200 bg-white",
      pill: "rounded-full px-4 py-1.5 text-sm border border-slate-300",
    },
    bold: {
      bg: "min-h-screen bg-gradient-to-br from-amber-500 via-red-600 to-rose-800 text-white",
      card: "rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 p-5 shadow-2xl",
      accent: "bg-yellow-300 text-black",
      header: "border-b border-white/20",
      pill: "rounded-full px-4 py-1.5 text-sm border border-white/30",
    },
  };
  const t = themes[tpl];

  return (
    <div className={t.bg}>
      <header className={`${t.header} sticky top-0 z-30 backdrop-blur`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {agent.storeLogo ? (
              <img src={agent.storeLogo} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className={`h-9 w-9 rounded-lg grid place-items-center ${t.accent}`}><Zap className="h-5 w-5" /></div>
            )}
            <div>
              <div className="font-bold leading-tight">{agent.storeBrand}</div>
              <div className="text-xs opacity-70">by {agent.name}</div>
            </div>
          </div>
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={`${t.pill} flex items-center gap-2`}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </header>

      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{agent.storeBrand}</h1>
        <p className="mt-3 opacity-90 max-w-xl mx-auto">Fast data bundles & result checker PINs. Order in seconds.</p>
      </section>

      <section className="container mx-auto px-4 pb-16 space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-4">Data bundles</h2>
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["MTN", "Telecel", "AirtelTigo"] as Network[]).map((n) => (
              <button key={n} onClick={() => setNet(n)} className={`${t.pill} ${net === n ? t.accent : ""}`}>{n}</button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <div key={p.id} className={t.card}>
                <div className="text-xs uppercase tracking-wider opacity-70">{p.network} · {p.validity}</div>
                <div className="text-3xl font-bold mt-1">{p.size}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-2xl font-bold">{cedi(p.pricePublic)}</div>
                  <Button className={t.accent + " hover:opacity-90"} onClick={() => setPurchase({ kind: "data", pkg: p, agentId: agent.id })}>Buy</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Result checkers</h2>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            {checkers.map((c) => (
              <div key={c.id} className={t.card}>
                <div className="text-3xl font-bold">{c.type}</div>
                <div className="text-xs opacity-70">Checker PIN</div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-2xl font-bold">{cedi(c.pricePublic)}</div>
                  <Button className={t.accent + " hover:opacity-90"} onClick={() => setPurchase({ kind: "checker", pkg: c, agentId: agent.id })}>Buy</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
         className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-green-500 text-white shadow-2xl hover:scale-110 transition-transform">
        <MessageCircle className="h-6 w-6" />
      </a>

      <Dialog open={popup} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl">🚀 Get your own GetEasyData store</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Sell data & checkers, build your brand, and earn daily — for just ₵50.</p>
          <Button asChild size="lg" className="mt-2 bg-gradient-primary"><Link to="/become-agent" onClick={dismiss}><Rocket className="h-4 w-4 mr-1" /> Become an Agent</Link></Button>
          <button onClick={dismiss} className="text-xs text-muted-foreground hover:underline">No thanks, just shopping</button>
        </DialogContent>
      </Dialog>

      <PurchaseDialog item={purchase} open={!!purchase} onOpenChange={(o) => !o && setPurchase(null)} pricing="public" />
    </div>
  );
}