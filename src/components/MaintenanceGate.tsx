import { useLocation } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Wrench } from "lucide-react";

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { state, currentUser } = useStore();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");
  const isAdmin = currentUser?.role === "admin";

  if (state.settings.maintenanceMode && !isAdmin && !isAdminPath) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-hero text-primary-foreground p-6 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-accent text-accent-foreground shadow-gold mb-6">
          <Wrench className="h-10 w-10" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">{state.settings.siteName} is under maintenance</h1>
        <p className="max-w-md text-lg opacity-90">{state.settings.maintenanceMessage}</p>
        <p className="mt-8 text-sm opacity-70">We'll be back shortly. Thank you for your patience.</p>
      </div>
    );
  }
  return <>{children}</>;
}