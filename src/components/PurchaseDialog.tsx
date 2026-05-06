import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cedi } from "@/lib/format";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { CheckerPackage, DataPackage } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

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
  const { placeOrder } = useStore();
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

  const submit = async () => {
    if (!/^0\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit Ghana phone number");
      return;
    }
    if (pricing === "public" && !email) {
      toast.error("Email is required for payment");
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      if (pricing === "public") {
        const { data, error } = await supabase.functions.invoke("paystack-initialize", {
          body: {
            purpose: "order",
            amount: price,
            email,
            callbackUrl: `${window.location.origin}/payment-success?purpose=order`,
            metadata: {
              productLabel: label,
              network: item.kind === "data" ? item.pkg.network : null,
              recipientPhone: phone,
              buyerType: "public",
              agentId: item.agentId ?? null,
            },
          },
        });

        if (error) throw error;
        const authUrl = data?.authorization_url as string | undefined;
        if (!authUrl) throw new Error("Unable to initialize payment");

        window.location.href = authUrl;
        return;
      }

      const order = placeOrder({
        productLabel: label,
        network: item.kind === "data" ? item.pkg.network : undefined,
        recipient: phone,
        email: email || undefined,
        amount: price,
        buyerType: "public",
        agentId: item.agentId,
      });
      setOrderRef(order.ref);
      setStep("success");
    } catch (e: any) {
      toast.error(e?.message ?? "Unable to start payment. Please try again.");
    } finally {
      setSubmitting(false);
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
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <Button className="w-full bg-gradient-primary" disabled={submitting} onClick={submit}>
                {submitting ? "Placing order..." : `Place order (${cedi(price)})`}
              </Button>
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