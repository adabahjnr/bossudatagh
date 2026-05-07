import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/lib/store";
import { initializePaystackPayment, redirectToPayment } from "@/lib/paystack";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { cedi } from "@/lib/format";

export default function ActivateAgent() {
  const { user, profile, roles, loading, refreshProfile } = useAuth();
  const { state } = useStore();
  const [paying, setPaying] = useState(false);

  const activationFee = state.settings.agentActivationFee ?? 50;

  useEffect(() => {
    if (user && !profile) {
      void refreshProfile();
    }
  }, [user, profile, refreshProfile]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-gradient-hero grid place-items-center p-4">
        <Card className="p-8 shadow-elegant text-center w-full max-w-md">
          <h1 className="text-xl font-bold">Preparing Activation</h1>
          <p className="text-muted-foreground mt-2">Please wait while your account is being set up.</p>
        </Card>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles.includes("admin")) return <Navigate to="/admin" replace />;
  if (profile?.role !== "agent") return <Navigate to="/dashboard" replace />;
  if (profile?.agent_activated) return <Navigate to="/dashboard" replace />;

  const handlePayment = async () => {
    if (!user) return toast.error("Not logged in");

    setPaying(true);
    try {
      const authUrl = await initializePaystackPayment({
        purpose: "agent_activation",
        amount: activationFee,
        email: user.email ?? "",
        callbackUrl: `${window.location.origin}/payment-success?purpose=agent_activation`,
        metadata: { userId: user.id },
      });

      redirectToPayment(authUrl);
      return;
    } catch (e: any) {
      const msg = e?.context?.error ?? e?.message ?? "Payment failed. Please try again.";
      toast.error(msg);
      console.error("[Paystack init error]", e);
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
