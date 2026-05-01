export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaign_codes: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          id: string
          redeemed: boolean
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          id?: string
          redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          id?: string
          redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          created_at: string
          data_size: string
          id: string
          name: string
          network: Database["public"]["Enums"]["network_type"]
          redeemed: number
          total_codes: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          data_size: string
          id?: string
          name: string
          network: Database["public"]["Enums"]["network_type"]
          redeemed?: number
          total_codes?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          data_size?: string
          id?: string
          name?: string
          network?: Database["public"]["Enums"]["network_type"]
          redeemed?: number
          total_codes?: number
          updated_at?: string
        }
        Relationships: []
      }
      checker_packages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          price_agent: number
          price_public: number
          stock: number
          type: Database["public"]["Enums"]["checker_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          price_agent: number
          price_public: number
          stock?: number
          type: Database["public"]["Enums"]["checker_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          price_agent?: number
          price_public?: number
          stock?: number
          type?: Database["public"]["Enums"]["checker_type"]
          updated_at?: string
        }
        Relationships: []
      }
      data_packages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          network: Database["public"]["Enums"]["network_type"]
          price_agent: number
          price_public: number
          size: string
          updated_at: string
          validity: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          network: Database["public"]["Enums"]["network_type"]
          price_agent: number
          price_public: number
          size: string
          updated_at?: string
          validity: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          network?: Database["public"]["Enums"]["network_type"]
          price_agent?: number
          price_public?: number
          size?: string
          updated_at?: string
          validity?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: Database["public"]["Enums"]["notification_audience"]
          created_at: string
          id: string
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          created_at?: string
          id?: string
          message: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          audience?: Database["public"]["Enums"]["notification_audience"]
          created_at?: string
          id?: string
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: []
      }
      orders: {
        Row: {
          agent_id: string | null
          amount: number
          buyer_type: Database["public"]["Enums"]["buyer_type"]
          created_at: string
          email: string | null
          id: string
          network: Database["public"]["Enums"]["network_type"] | null
          pin_code: string | null
          product_label: string
          recipient: string
          ref: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          amount: number
          buyer_type?: Database["public"]["Enums"]["buyer_type"]
          created_at?: string
          email?: string | null
          id?: string
          network?: Database["public"]["Enums"]["network_type"] | null
          pin_code?: string | null
          product_label: string
          recipient: string
          ref: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          amount?: number
          buyer_type?: Database["public"]["Enums"]["buyer_type"]
          created_at?: string
          email?: string | null
          id?: string
          network?: Database["public"]["Enums"]["network_type"] | null
          pin_code?: string | null
          product_label?: string
          recipient?: string
          ref?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          api_key: string | null
          badges: string[]
          created_at: string
          id: string
          name: string
          parent_agent_id: string | null
          phone: string
          referral_code: string | null
          store_brand: string | null
          store_logo: string | null
          store_slug: string | null
          store_template: Database["public"]["Enums"]["store_template"] | null
          total_referrals: number
          total_sales: number
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          active?: boolean
          api_key?: string | null
          badges?: string[]
          created_at?: string
          id: string
          name?: string
          parent_agent_id?: string | null
          phone?: string
          referral_code?: string | null
          store_brand?: string | null
          store_logo?: string | null
          store_slug?: string | null
          store_template?: Database["public"]["Enums"]["store_template"] | null
          total_referrals?: number
          total_sales?: number
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          active?: boolean
          api_key?: string | null
          badges?: string[]
          created_at?: string
          id?: string
          name?: string
          parent_agent_id?: string | null
          phone?: string
          referral_code?: string | null
          store_brand?: string | null
          store_logo?: string | null
          store_slug?: string | null
          store_template?: Database["public"]["Enums"]["store_template"] | null
          total_referrals?: number
          total_sales?: number
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          campaign_id: string | null
          code: string
          created_at: string
          id: string
          phone: string
        }
        Insert: {
          campaign_id?: string | null
          code: string
          created_at?: string
          id?: string
          phone: string
        }
        Update: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          agent_fee: number
          banner: string | null
          id: number
          maintenance_message: string
          maintenance_mode: boolean
          min_withdrawal: number
          site_name: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          agent_fee?: number
          banner?: string | null
          id?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          min_withdrawal?: number
          site_name?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          agent_fee?: number
          banner?: string | null
          id?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          min_withdrawal?: number
          site_name?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          ref: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ref?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ref?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          account_name: string
          agent_id: string
          amount: number
          created_at: string
          id: string
          momo_number: string
          network: Database["public"]["Enums"]["network_type"]
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          account_name: string
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          momo_number: string
          network: Database["public"]["Enums"]["network_type"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          account_name?: string
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          momo_number?: string
          network?: Database["public"]["Enums"]["network_type"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      redeem_code: { Args: { _code: string; _phone: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "agent" | "subagent"
      buyer_type: "public" | "agent" | "subagent"
      checker_type: "BECE" | "WASSCE"
      network_type: "MTN" | "Telecel" | "AirtelTigo"
      notification_audience: "all" | "agents" | "public"
      notification_type: "info" | "success" | "warning" | "alert"
      order_status: "processing" | "delivered" | "failed" | "refunded"
      store_template: "neon" | "minimal" | "bold"
      wallet_tx_type:
        | "topup"
        | "purchase"
        | "commission"
        | "withdrawal"
        | "refund"
        | "adjustment"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "agent", "subagent"],
      buyer_type: ["public", "agent", "subagent"],
      checker_type: ["BECE", "WASSCE"],
      network_type: ["MTN", "Telecel", "AirtelTigo"],
      notification_audience: ["all", "agents", "public"],
      notification_type: ["info", "success", "warning", "alert"],
      order_status: ["processing", "delivered", "failed", "refunded"],
      store_template: ["neon", "minimal", "bold"],
      wallet_tx_type: [
        "topup",
        "purchase",
        "commission",
        "withdrawal",
        "refund",
        "adjustment",
      ],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
