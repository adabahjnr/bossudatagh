import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { cedi, shortDate } from "@/lib/format";
import { toast } from "sonner";
import { verifyPaystackPayment } from "@/lib/paystack";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useStore();
  const [params] = useSearchParams();
  // Keep support for common reference query names.
  const reference = params.get("reference") || params.get("trxref") || params.get("ref");
  const purpose = params.get("purpose") || "order";
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [redirectSeconds, setRedirectSeconds] = useState(5);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;

    const verify = async () => {
      setVerifying(true);
      let data: Record<string, unknown>;
      try {
        data = await verifyPaystackPayment(reference);
      } catch (e: any) {
        toast.error(e?.message || "Payment verification failed");
        setVerifying(false);
        return;
      }

      if (data?.purpose === "agent_activation") {
        toast.success("Agent account activated successfully");
        setSuccessSummary("Your agent account is now active.");
        setRedirectTo("/dashboard");
        setRedirectSeconds(5);
        setVerifying(false);
        return;
      }

      if (data?.purpose === "wallet_topup") {
        toast.success("Wallet funded successfully");
        setSuccessSummary("Your wallet has been funded successfully.");
        setRedirectTo("/dashboard/wallet");
        setRedirectSeconds(5);
        setVerifying(false);
        return;
      }

      if (data?.order) {
        setOrder(data.order);
        // If user is signed in, return them to dashboard after showing success.
        if (user) {
          setSuccessSummary("Your data purchase is being processed.");
          setRedirectTo("/dashboard");
          setRedirectSeconds(6);
        }
      }
      setVerifying(false);
    };

    void verify();
  }, [reference, user]);

  useEffect(() => {
    if (!redirectTo || verifying) return;
    if (redirectSeconds <= 0) {
      navigate(redirectTo, { replace: true });
      return;
    }

    const timer = setTimeout(() => setRedirectSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [redirectTo, redirectSeconds, verifying, navigate]);

  useEffect(() => {
    if (!reference || purpose !== "order") return;
    const found = state.orders.find((o) => o.ref.toLowerCase() === reference.toLowerCase());
    if (found) {
      setOrder({
        ref: found.ref,
        product_label: found.productLabel,
        recipient: found.recipient,
        amount: found.amount,
        status: found.status,
        created_at: found.createdAt,
      });
    }
  }, [reference, state.orders, purpose]);

  const copy = () => {
    navigator.clipboard.writeText(String(order?.ref ?? reference ?? ""));
    setCopied(true);
    toast.success("Reference copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-background to-muted/30">
      <Card className="p-8 max-w-md w-full shadow-elegant">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-success/15 grid place-items-center mb-5 ring-4 ring-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold">Payment Successful!</h1>
          {verifying && <p className="text-sm text-muted-foreground mt-2">Verifying payment...</p>}
          {order && (
            <p className="text-muted-foreground mt-1.5 text-sm">
              <span className="font-medium text-foreground">{String(order.product_label)}</span>{" "}
              is being delivered to{" "}
              <span className="font-medium text-foreground">{String(order.recipient)}</span>.
            </p>
          )}
          {!order && successSummary && (
            <p className="text-muted-foreground mt-1.5 text-sm">{successSummary}</p>
          )}
          {redirectTo && !verifying && (
            <p className="text-xs text-muted-foreground mt-3">
              Redirecting in {redirectSeconds}s...
            </p>
          )}
        </div>

        {order && (
          <div className="mt-6 space-y-3">
            {/* Reference row */}
            <div className="rounded-xl bg-muted p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Order Reference</div>
                <div className="font-mono font-bold text-base truncate">{String(order.ref)}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={copy} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-0.5">Product</div>
                <div className="font-medium leading-snug">{String(order.product_label)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-0.5">Amount Paid</div>
                <div className="font-medium">{cedi(Number(order.amount))}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-0.5">Recipient</div>
                <div className="font-medium">{String(order.recipient)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-0.5">Status</div>
                <div className={`font-medium capitalize ${order.status === "delivered" ? "text-success" : order.status === "failed" ? "text-destructive" : "text-warning"}`}>
                  {String(order.status)}
                </div>
              </div>
            </div>

            {order.created_at && (
              <p className="text-xs text-muted-foreground text-right">
                Placed {shortDate(String(order.created_at))}
              </p>
            )}
          </div>
        )}

        {!order && (
          <div className="mt-6 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Reference: <span className="font-mono font-semibold text-foreground">{reference ?? "N/A"}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {redirectTo && !verifying && (
            <Button asChild variant="secondary" className="flex-1">
              <Link to={redirectTo}>Continue</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="flex-1">
            <Link to={`/track${order?.ref ? `?ref=${String(order.ref)}` : ""}`}>Track Order</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/products">Buy More Data</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
