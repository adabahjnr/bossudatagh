import { useState } from "react";
import { Gift } from "lucide-react";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function RedemptionFloating() {
  const { state, redeemCode } = useStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");

  const hasActive = state.campaigns.some((c) => c.active);
  if (!hasActive) return null;

  const onRedeem = () => {
    const r = redeemCode(code, phone);
    if (r.ok) {
      toast.success(r.message);
      setOpen(false);
      setCode(""); setPhone("");
    } else {
      toast.error(r.message);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-3 font-semibold text-accent-foreground shadow-gold transition-smooth hover:scale-105"
      >
        <Gift className="h-5 w-5" /> Free Data
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem your free data code 🎁</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>8-digit code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234" maxLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244000000" maxLength={10} />
            </div>
            <Button className="w-full" onClick={onRedeem}>Redeem now</Button>
            <p className="text-xs text-muted-foreground text-center">Each code & phone number can be used once.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}