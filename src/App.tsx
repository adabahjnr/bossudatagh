import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthStoreBridge } from "@/components/AuthStoreBridge";
import { SupabaseDataBridge } from "@/components/SupabaseDataBridge";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import PublicLayout from "@/layouts/PublicLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import AdminLayout from "@/layouts/AdminLayout";

// Eagerly load pages that are on the critical path (public pages everyone sees first).
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound.tsx";

// Lazy-load everything else to reduce initial bundle size.
const Products = lazy(() => import("@/pages/Products"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));
const BecomeAgent = lazy(() => import("@/pages/BecomeAgent"));
const ActivateAgent = lazy(() => import("@/pages/ActivateAgent"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const MiniStore = lazy(() => import("@/pages/MiniStore"));

const Overview = lazy(() => import("@/pages/dashboard/Overview"));
const WalletPage = lazy(() => import("@/pages/dashboard/WalletPage"));
const BuyProducts = lazy(() => import("@/pages/dashboard/BuyProducts"));
const MyStore = lazy(() => import("@/pages/dashboard/MyStore"));
const StorePackages = lazy(() => import("@/pages/dashboard/StorePackages"));
const Withdrawals = lazy(() => import("@/pages/dashboard/Withdrawals"));
const Leaderboard = lazy(() => import("@/pages/dashboard/Leaderboard"));
const ApiDocs = lazy(() => import("@/pages/dashboard/ApiDocs"));
const AccountSettings = lazy(() => import("@/pages/dashboard/AccountSettings"));

const AdminPages = lazy(() => import("@/pages/admin/AdminPages"));

const queryClient = new QueryClient();

// Minimal inline fallback — avoids a flash of nothing.
const PageFallback = () => (
  <div className="min-h-[40vh] grid place-items-center">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <StoreProvider>
        <AuthProvider>
          <AuthStoreBridge />
          <SupabaseDataBridge />
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" richColors />
            <BrowserRouter>
              <MaintenanceGate>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route element={<PublicLayout />}>
                      <Route path="/" element={<Home />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/track" element={<TrackOrder />} />
                      <Route path="/become-agent" element={<BecomeAgent />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/payment-success" element={<PaymentSuccess />} />
                    </Route>
                    <Route path="/activate-agent" element={<ActivateAgent />} />
                    <Route path="/store/:slug" element={<MiniStore />} />
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<Overview />} />
                      <Route path="wallet" element={<WalletPage />} />
                      <Route path="buy" element={<BuyProducts />} />
                      <Route path="store" element={<MyStore />} />
                      <Route path="store/packages" element={<StorePackages />} />
                      <Route path="withdrawals" element={<Withdrawals />} />
                      <Route path="leaderboard" element={<Leaderboard />} />
                      <Route path="api" element={<ApiDocs />} />
                      <Route path="settings" element={<AccountSettings />} />
                    </Route>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route
                        index
                        element={<AdminPages section="overview" />}
                      />
                      <Route path="orders" element={<AdminPages section="orders" />} />
                      <Route path="packages" element={<AdminPages section="packages" />} />
                      <Route path="agents" element={<AdminPages section="agents" />} />
                      <Route path="withdrawals" element={<AdminPages section="withdrawals" />} />
                      <Route path="campaigns" element={<AdminPages section="campaigns" />} />
                      <Route path="notifications" element={<AdminPages section="notifications" />} />
                      <Route path="settings" element={<AdminPages section="settings" />} />
                      <Route path="maintenance" element={<AdminPages section="maintenance" />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </MaintenanceGate>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </StoreProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
