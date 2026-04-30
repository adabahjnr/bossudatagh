import type { DataPackage, CheckerPackage, Order, User, WithdrawalRequest, FreeDataCampaign, SiteSettings, Notification } from "./types";

export const mockPackages: DataPackage[] = [
  { id: "p1", network: "MTN", size: "1GB", validity: "30 days", pricePublic: 6, priceAgent: 5, active: true },
  { id: "p2", network: "MTN", size: "2GB", validity: "30 days", pricePublic: 11, priceAgent: 9.5, active: true },
  { id: "p3", network: "MTN", size: "5GB", validity: "30 days", pricePublic: 26, priceAgent: 23, active: true },
  { id: "p4", network: "MTN", size: "10GB", validity: "30 days", pricePublic: 49, priceAgent: 44, active: true },
  { id: "p5", network: "Telecel", size: "1GB", validity: "30 days", pricePublic: 6, priceAgent: 5, active: true },
  { id: "p6", network: "Telecel", size: "3GB", validity: "30 days", pricePublic: 16, priceAgent: 14, active: true },
  { id: "p7", network: "Telecel", size: "10GB", validity: "30 days", pricePublic: 48, priceAgent: 43, active: true },
  { id: "p8", network: "AirtelTigo", size: "1GB", validity: "30 days", pricePublic: 5.5, priceAgent: 4.8, active: true },
  { id: "p9", network: "AirtelTigo", size: "5GB", validity: "30 days", pricePublic: 24, priceAgent: 21, active: true },
  { id: "p10", network: "AirtelTigo", size: "15GB", validity: "30 days", pricePublic: 60, priceAgent: 54, active: true },
];

export const mockCheckers: CheckerPackage[] = [
  { id: "c1", type: "BECE", pricePublic: 18, priceAgent: 15, stock: 240, active: true },
  { id: "c2", type: "WASSCE", pricePublic: 22, priceAgent: 18, stock: 180, active: true },
];

export const mockOrders: Order[] = [
  { id: "o1", ref: "BD-A1B2C3", productLabel: "MTN 2GB", network: "MTN", recipient: "0244111222", amount: 11, status: "delivered", createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), buyerType: "public" },
  { id: "o2", ref: "BD-D4E5F6", productLabel: "WASSCE Checker", recipient: "0207654321", amount: 22, status: "processing", createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(), buyerType: "public" },
  { id: "o3", ref: "BD-G7H8I9", productLabel: "Telecel 5GB", network: "Telecel", recipient: "0501112233", amount: 26, status: "failed", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), buyerType: "agent", agentId: "u-agent-1" },
  { id: "o4", ref: "BD-J0K1L2", productLabel: "AirtelTigo 5GB", network: "AirtelTigo", recipient: "0277889900", amount: 24, status: "delivered", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), buyerType: "public" },
];

export const mockAgents: User[] = [
  {
    id: "u-agent-1",
    name: "Kwame Mensah",
    email: "kwame@example.com",
    phone: "0244000111",
    role: "agent",
    walletBalance: 320.5,
    storeSlug: "kwame",
    storeTemplate: "neon",
    storeBrand: "Kwame Data Hub",
    referralCode: "BOSS-KWAME",
    apiKey: "bd_live_4f8a12c0e3b7",
    totalSales: 1240,
    totalReferrals: 8,
    badges: ["Top Seller", "Elite Agent"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    active: true,
  },
  {
    id: "u-agent-2",
    name: "Ama Owusu",
    email: "ama@example.com",
    phone: "0207000222",
    role: "agent",
    walletBalance: 180,
    storeSlug: "ama",
    storeTemplate: "minimal",
    storeBrand: "Ama Bundles",
    referralCode: "BOSS-AMA",
    apiKey: "bd_live_9c2d44a1ff10",
    totalSales: 880,
    totalReferrals: 4,
    badges: ["Rising Star"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    active: true,
  },
  {
    id: "u-agent-3",
    name: "Yaw Boateng",
    email: "yaw@example.com",
    phone: "0500000333",
    role: "agent",
    walletBalance: 60,
    storeSlug: "yaw",
    storeTemplate: "bold",
    storeBrand: "Yaw Express Data",
    referralCode: "BOSS-YAW",
    apiKey: "bd_live_a17fcc28b9e5",
    totalSales: 540,
    totalReferrals: 2,
    badges: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    active: true,
  },
  {
    id: "u-sub-1",
    name: "Akua Sarpong",
    email: "akua@example.com",
    phone: "0246000444",
    role: "subagent",
    walletBalance: 40,
    parentAgentId: "u-agent-1",
    referralCode: "BOSS-AKUA",
    totalSales: 120,
    badges: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    active: true,
  },
];

export const mockWithdrawals: WithdrawalRequest[] = [
  { id: "w1", agentId: "u-agent-1", agentName: "Kwame Mensah", amount: 200, momoNumber: "0244000111", network: "MTN", accountName: "Kwame Mensah", status: "pending", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
  { id: "w2", agentId: "u-agent-2", agentName: "Ama Owusu", amount: 100, momoNumber: "0207000222", network: "Telecel", accountName: "Ama Owusu", status: "approved", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
];

export const mockCampaigns: FreeDataCampaign[] = [
  {
    id: "fc1",
    name: "May Madness 1GB",
    dataSize: "1GB",
    network: "MTN",
    totalCodes: 50,
    redeemed: 12,
    active: true,
    codes: Array.from({ length: 50 }, (_, i) => ({
      code: `BOSS${(10000000 + i).toString(36).toUpperCase().padStart(8, "0").slice(0, 8)}`,
      redeemed: i < 12,
    })),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

export const defaultSiteSettings: SiteSettings = {
  siteName: "BossuData",
  whatsappNumber: "233244000000",
  agentFee: 50,
  minWithdrawal: 50,
  maintenanceMode: false,
  maintenanceMessage: "We're upgrading BossuData. Be right back!",
};

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    title: "Welcome to BossuData",
    message: "New rewards system live this week. Top sellers earn bonus credits!",
    type: "info",
    audience: "agents",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];