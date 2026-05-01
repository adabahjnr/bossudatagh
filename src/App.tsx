import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/hooks/useAuth";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import PublicLayout from "@/layouts/PublicLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import AdminLayout from "@/layouts/AdminLayout";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import TrackOrder from "@/pages/TrackOrder";
import BecomeAgent from "@/pages/BecomeAgent";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import MiniStore from "@/pages/MiniStore";
import Overview from "@/pages/dashboard/Overview";
import WalletPage from "@/pages/dashboard/WalletPage";
import BuyProducts from "@/pages/dashboard/BuyProducts";
import MyStore from "@/pages/dashboard/MyStore";
import Subagents from "@/pages/dashboard/Subagents";
import FlyerGenerator from "@/pages/dashboard/FlyerGenerator";
import Withdrawals from "@/pages/dashboard/Withdrawals";
import Leaderboard from "@/pages/dashboard/Leaderboard";
import ApiDocs from "@/pages/dashboard/ApiDocs";
import AccountSettings from "@/pages/dashboard/AccountSettings";
import {
  AdminOverview, AdminOrders, AdminPackages, AdminCheckers, AdminAgents,
  AdminWithdrawals, AdminCampaigns, AdminNotifications, AdminSettings, AdminMaintenance,
} from "@/pages/admin/AdminPages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" richColors />
            <BrowserRouter>
              <MaintenanceGate>
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/track" element={<TrackOrder />} />
                    <Route path="/become-agent" element={<BecomeAgent />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                  </Route>
                <Route path="/store/:slug" element={<MiniStore />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<Overview />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="buy" element={<BuyProducts />} />
                  <Route path="store" element={<MyStore />} />
                  <Route path="subagents" element={<Subagents />} />
                  <Route path="flyers" element={<FlyerGenerator />} />
                  <Route path="withdrawals" element={<Withdrawals />} />
                  <Route path="leaderboard" element={<Leaderboard />} />
                  <Route path="api" element={<ApiDocs />} />
                  <Route path="settings" element={<AccountSettings />} />
                </Route>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverview />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="packages" element={<AdminPackages />} />
                  <Route path="checkers" element={<AdminCheckers />} />
                  <Route path="agents" element={<AdminAgents />} />
                  <Route path="withdrawals" element={<AdminWithdrawals />} />
                  <Route path="campaigns" element={<AdminCampaigns />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="maintenance" element={<AdminMaintenance />} />
                </Route>
                <Route path="*" element={<NotFound />} />
                </Routes>
              </MaintenanceGate>
            </BrowserRouter>
          </TooltipProvider>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
