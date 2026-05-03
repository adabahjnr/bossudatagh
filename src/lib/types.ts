export type Network = "MTN" | "Telecel" | "AirtelTigo";
export type CheckerType = "BECE" | "WASSCE";
export type OrderStatus = "processing" | "delivered" | "failed" | "refunded";
export type Role = "guest" | "agent" | "subagent" | "admin";

export interface DataPackage {
  id: string;
  network: Network;
  size: string; // e.g. "1GB"
  validity: string; // e.g. "30 days"
  pricePublic: number;
  priceAgent: number;
  active: boolean;
}

export interface CheckerPackage {
  id: string;
  type: CheckerType;
  pricePublic: number;
  priceAgent: number;
  stock: number;
  active: boolean;
}

export interface AgentStorePackage {
  id: string;
  agentId: string;
  packageId: string;
  salePrice: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  ref: string;
  productLabel: string;
  network?: Network;
  recipient: string;
  email?: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
  buyerType: "public" | "agent" | "subagent";
  agentId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  walletBalance: number;
  storeSlug?: string;
  storeTemplate?: "neon" | "minimal" | "bold";
  storeLogo?: string;
  storeBrand?: string;
  parentAgentId?: string; // for subagents
  apiKey?: string;
  referralCode?: string;
  totalSales?: number;
  totalReferrals?: number;
  badges?: string[];
  createdAt: string;
  active: boolean;
}

export interface WithdrawalRequest {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  momoNumber: string;
  network: Network;
  accountName: string;
  status: "pending" | "approved" | "rejected" | "paid";
  createdAt: string;
}

export interface FreeDataCampaign {
  id: string;
  name: string;
  dataSize: string;
  network: Network;
  totalCodes: number;
  redeemed: number;
  codes: { code: string; redeemed: boolean; redeemedBy?: string }[];
  active: boolean;
  createdAt: string;
}

export interface SiteSettings {
  siteName: string;
  whatsappNumber: string;
  agentFee: number;
  minWithdrawal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  banner?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  audience: "all" | "agents" | "public";
  createdAt: string;
}