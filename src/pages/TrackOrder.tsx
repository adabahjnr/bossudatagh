import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { cedi, shortDate } from "@/lib/format";
import { CheckCircle2, Loader2, XCircle, RotateCcw } from "lucide-react";
import type { Order } from "@/lib/types";

const statusMap = {
  processing: { icon: Loader2, color: "bg-warning text-warning-foreground", label: "Processing" },
  delivered: { icon: CheckCircle2, color: "bg-success text-success-foreground", label: "Delivered" },
  failed: { icon: XCircle, color: "bg-destructive text-destructive-foreground", label: "Failed" },
  refunded: { icon: RotateCcw, color: "bg-muted text-foreground", label: "Refunded" },
} as const;

export default function TrackOrder() {
  const { state } = useStore();
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Order | null | "notfound">(null);

  const search = () => {
    const order = state.orders.find(
      (o) => o.ref.toLowerCase() === ref.trim().toLowerCase() && o.recipient === phone.trim(),
    );
    setResult(order ?? "notfound");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-center">Track your order</h1>
      <p className="mt-2 text-muted-foreground text-center">Enter your reference and phone to view status.</p>

      <Card className="p-6 mt-8 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Order reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="BD-XXXXXX" />
          </div>
          <div className="space-y-2">
            <Label>Phone number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244000000" maxLength={10} />
          </div>
        </div>
        <Button className="w-full mt-6" onClick={search}>Track order</Button>
      </Card>

      {result === "notfound" && (
        <Card className="p-6 mt-6 text-center text-muted-foreground">
          No order found. Check the reference and phone number, then try again.
        </Card>
      )}

      {result && result !== "notfound" && (() => {
        const s = statusMap[result.status];
        const Icon = s.icon;
        return (
          <Card className="p-6 mt-6 shadow-elegant">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Reference</div>
                <div className="font-mono font-bold text-xl">{result.ref}</div>
              </div>
              <Badge className={`${s.color} px-3 py-1.5 text-sm`}>
                <Icon className={`h-4 w-4 mr-1.5 ${result.status === "processing" ? "animate-spin" : ""}`} /> {s.label}
              </Badge>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{result.productLabel}</span></div>
              <div><span className="text-muted-foreground">Recipient:</span> <span className="font-medium">{result.recipient}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{cedi(result.amount)}</span></div>
              <div><span className="text-muted-foreground">Placed:</span> <span className="font-medium">{shortDate(result.createdAt)}</span></div>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}