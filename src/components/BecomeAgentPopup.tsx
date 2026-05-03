import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

const POPUP_KEY = "geteasydata.site.popup.seen";

export function BecomeAgentPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(POPUP_KEY)) return;
    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(POPUP_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl">🚀 Get your own GetEasyData store</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">Sell data & checkers, build your brand, and earn daily — for just ₵50.</p>
        <Button asChild size="lg" className="mt-2 bg-gradient-primary">
          <Link to="/become-agent" onClick={dismiss}>
            <Rocket className="h-4 w-4 mr-1" /> Become an Agent
          </Link>
        </Button>
        <button onClick={dismiss} className="text-xs text-muted-foreground hover:underline">
          No thanks, just shopping
        </button>
      </DialogContent>
    </Dialog>
  );
}