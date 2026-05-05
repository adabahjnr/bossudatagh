import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react";
import { cedi, shortDate } from "@/lib/format";
import { toast } from "sonner";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  // Paystack appends ?reference= and ?trxref= on redirect; we also support ?ref= for internal links
  const reference = params.get("reference") || params.get("trxref") || params.get("ref");

  const [pageState, setPageState] = useState<"loading" | "success" | "failed">("loading");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reference) {
      setPageState("failed");
      return;
    }

    (async () => {
      // 1. Verify payment is genuine via Paystack
      const { data: vData, error: vErr } = await supabase.functions.invoke("paystack-verify", {
        body: { reference },
      });

      if (vErr || !vData?.ok) {
        setPageState("failed");
        return;
      }

      // 2. Fetch the order from DB by ref
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .ilike("ref", reference)
        .maybeSingle();

      setOrder(orderData ?? null);
      setPageState("success");
    })();
  }, [reference]);

  const copy = () => {
    navigator.clipboard.writeText(String(order?.ref ?? reference ?? ""));
    setCopied(true);
    toast.success("Reference copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying your payment…</p>
        </div>
      </div>
    );
  }

  if (pageState === "failed") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="p-8 max-w-md w-full text-center shadow-elegant">
          <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Payment Not Verified</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            We could not verify your payment. If you were charged, please use the reference below to track your order or contact support.
          </p>
          {reference && (
            <div className="mt-4 rounded-lg bg-muted p-3 font-mono text-sm break-all">{reference}</div>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <Button asChild variant="outline"><Link to="/track">Track Order</Link></Button>
            <Button asChild><Link to="/products">Buy Again</Link></Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-background to-muted/30">
      <Card className="p-8 max-w-md w-full shadow-elegant">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-success/15 grid place-items-center mb-5 ring-4 ring-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold">Payment Successful!</h1>
          {order && (
            <p className="text-muted-foreground mt-1.5 text-sm">
              <span className="font-medium text-foreground">{String(order.product_label)}</span>{" "}
              is being delivered to{" "}
              <span className="font-medium text-foreground">{String(order.recipient)}</span>.
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

        <div className="mt-6 flex gap-3">
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
