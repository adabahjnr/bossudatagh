import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { cedi } from "@/lib/format";

export default function ActivateAgent() {
  const { user, profile } = useAuth();
  const { state } = useStore();
  const nav = useNavigate();
  const [paying, setPaying] = useState(false);

  const activationFee = state.settings.agentActivationFee ?? 50;

  if (!user || profile?.role !== "agent" || profile?.agent_activated) {
    nav("/dashboard", { replace: true });
    return null;
  }

  const handlePayment = async () => {
    if (!user) return toast.error("Not logged in");

    setPaying(true);
    try {
      // In production, integrate with a real payment provider (Stripe, PayPal, etc.)
      // For now, we'll mock the payment as approved
      const { error } = await supabase
        .from("profiles")
        .update({
          agent_activated: true,
          activation_paid_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Payment successful! Your agent account is now active.");
      nav("/dashboard", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8 shadow-elegant space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Activate Your Agent Account</h1>
            <p className="text-muted-foreground">
              Complete your account setup with a one-time activation payment.
            </p>
          </div>

          <div className="rounded-lg bg-gradient-primary/10 border border-primary/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Activation fee</span>
              <span className="font-semibold">{cedi(activationFee)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-primary/10 pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold text-primary">{cedi(activationFee)}</span>
            </div>
          </div>

          <div className="space-y-3 bg-success/5 border border-success/20 rounded-lg p-4">
            {[
              "Access full agent dashboard",
              "Create and manage your store",
              "Add sub-agents to your network",
              "Access API for integrations",
              "Full wallet & payment system",
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Payment Methods</p>
              <p>In production, you'll be able to pay via MTN MoMo, Telecel Cash, or international cards.</p>
            </div>
          </div>

          <Button
            className="w-full bg-gradient-primary text-lg h-12"
            disabled={paying}
            onClick={handlePayment}
          >
            {paying ? "Processing..." : `Pay ${cedi(activationFee)} to Activate`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By clicking "Pay", you agree to activate your agent account with a one-time fee of {cedi(activationFee)}
          </p>
        </Card>
      </div>
    </div>
  );
}
