import { Outlet } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { RedemptionFloating } from "@/components/RedemptionFloating";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
      <WhatsAppButton />
      <RedemptionFloating />
    </div>
  );
}