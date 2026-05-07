import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/lib/store";
import { initializePaystackPayment, redirectToPayment } from "@/lib/paystack";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, AlertCircle, ShieldCheck, Wallet, Store } from "lucide-react";
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

  const isAgent = profile?.role === "agent" || roles.includes("agent");
  const isActivated = profile?.agent_activated ?? false;

  if (loading) {
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
  if (!isAgent) return <Navigate to="/dashboard" replace />;
  if (isActivated) return <Navigate to="/dashboard" replace />;

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
    <div className="min-h-screen bg-gradient-hero p-4 md:p-8">
      <div className="mx-auto w-full max-w-5xl grid gap-6 lg:grid-cols-5">
        <Card className="p-8 shadow-elegant space-y-6 lg:col-span-3">
          <div className="space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Activate Your Agent Account</h1>
            <p className="text-muted-foreground">
              Complete your setup with a one-time activation fee and unlock full selling access.
            </p>
          </div>

          <div className="rounded-lg bg-gradient-primary/10 border border-primary/20 p-4 space-y-3">
            <h2 className="font-semibold text-base">Payment Information</h2>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Activation fee</span>
              <span className="font-semibold">{cedi(activationFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gateway</span>
              <span className="font-semibold">Paystack</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Verification</span>
              <span className="font-semibold">Automatic after payment</span>
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
              <p className="font-medium text-foreground mb-1">What happens after payment?</p>
              <p>Your payment is verified automatically. Once successful, agent access is enabled and you can enter your dashboard immediately.</p>
            </div>
          </div>

          <Button
            className="w-full bg-gradient-primary text-lg h-12"
            disabled={paying}
            onClick={handlePayment}
          >
            {paying ? "Redirecting to Paystack..." : `Pay ${cedi(activationFee)} with Paystack`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure checkout powered by Paystack. By clicking Pay, you authorize a one-time activation charge of {cedi(activationFee)}.
          </p>
        </Card>

        <Card className="p-6 shadow-soft lg:col-span-2 space-y-5">
          <h2 className="text-lg font-semibold">Why Activate?</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                <Store className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Sell from your own mini store</p>
                <p className="text-xs text-muted-foreground">Customize your packages, pricing, and store look.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Wallet and withdrawals</p>
                <p className="text-xs text-muted-foreground">Fund wallet, buy bundles, and request payouts.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">Verified account access</p>
                <p className="text-xs text-muted-foreground">Activation is verified server-side before dashboard access.</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Activation Amount</p>
            <p className="text-3xl font-bold mt-1">{cedi(activationFee)}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
