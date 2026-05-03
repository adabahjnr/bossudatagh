import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { cedi } from "@/lib/format";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { CheckerPackage, DataPackage } from "@/lib/types";

type Item =
  | { kind: "data"; pkg: DataPackage; agentId?: string }
  | { kind: "checker"; pkg: CheckerPackage; agentId?: string };

export function PurchaseDialog({
  item,
  open,
  onOpenChange,
  pricing = "public",
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pricing?: "public" | "agent";
}) {
  const { creditWallet, setState } = useStore();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");
  const [orderRef, setOrderRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;
  const price = pricing === "agent" ? item.pkg.priceAgent : item.pkg.pricePublic;
  const label = item.kind === "data"
    ? `${item.pkg.network} ${item.pkg.size}`
    : `${item.pkg.type} Checker`;

  const reset = () => {
    setStep("form"); setPhone(""); setEmail(""); setOrderRef("");
  };

  const onClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const genRef = () =>
    "BD-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  const submit = async () => {
    if (!/^0\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit Ghana phone number");
      return;
    }
    setSubmitting(true);
    const ref = genRef();
    const { data, error } = await supabase
      .from("orders")
      .insert({
        ref,
        product_label: label,
        network: item.kind === "data" ? item.pkg.network : null,
        recipient: phone,
        email: email || null,
        amount: price,
        buyer_type: item.agentId ? "agent" : "public",
        agent_id: item.agentId ?? null,
        status: "processing",
      })
      .select("id, ref")
      .single();
    if (error || !data) {
      setSubmitting(false);
      toast.error(error?.message ?? "Could not place order");
      return;
    }
    setOrderRef(data.ref);
    setStep("success");
    setSubmitting(false);
    toast.success("Payment received. Delivering now…");
    // Simulate fulfillment ~1.8s later
    setTimeout(() => {
      supabase.from("orders").update({ status: "delivered" }).eq("id", data.id).then(() => {});
    }, 1800);
    // Credit agent profit immediately for store sales of data packages
    if (item.agentId && item.kind === "data") {
      const profit = Math.max(price - item.pkg.priceAgent, 0);
      if (profit > 0) {
        creditWallet(item.agentId, profit);
        setState((s) => ({
          ...s,
          users: s.users.map((u) =>
            u.id === item.agentId
              ? { ...u, totalSales: (u.totalSales ?? 0) + 1 }
              : u,
          ),
        }));
      }

      supabase.rpc("record_agent_sale", {
        _agent_id: item.agentId,
        _package_id: item.pkg.id,
        _sale_price: price,
        _order_ref: data.ref,
      }).then(({ data: res }) => {
        const r = res as { ok?: boolean; profit?: number } | null;
        if (r?.ok && r.profit && r.profit > 0) {
          toast.success(`Agent earned ₵${r.profit.toFixed(2)} profit`);
        } else if (profit > 0) {
          toast.success(`Agent earned ${cedi(profit)} profit`);
        }
      });
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(orderRef);
    toast.success("Reference copied");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Buy {label}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{label}</div>
                  {item.kind === "data" && <div className="text-xs text-muted-foreground">Valid {item.pkg.validity}</div>}
                </div>
                <div className="text-2xl font-bold text-gradient-primary">{cedi(price)}</div>
              </div>
              <div className="space-y-2">
                <Label>Recipient phone number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244000000" maxLength={10} />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <Button className="w-full bg-gradient-primary" disabled={submitting} onClick={submit}>
                {submitting ? "Processing…" : `Pay ${cedi(price)}`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Simulated payment for demo. Production wires to Paystack/Hubtel.</p>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-success-foreground shadow-elegant mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold">Order placed!</h3>
            <p className="text-muted-foreground mt-1">Your {label} is being delivered to {phone}.</p>
            <div className="mt-6 rounded-lg bg-muted p-4 flex items-center justify-between">
              <div className="text-left">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">Reference</div>
                <div className="font-mono font-bold text-lg">{orderRef}</div>
              </div>
              <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
            <Button className="w-full mt-6" onClick={() => onClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}