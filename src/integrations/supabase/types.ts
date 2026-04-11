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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string
          user_id: string
          email: string
          service: string
          booking_date: string
          booking_time: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          service: string
          booking_date: string
          booking_time: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          service?: string
          booking_date?: string
          booking_time?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      owners: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          is_verified: boolean
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          is_verified?: boolean
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          is_verified?: boolean
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      queue: {
        Row: {
          barber_id: string | null
          booking_date: string | null
          booking_time: string | null
          completed_at: string | null
          created_at: string
          customer_first_name: string | null
          customer_last_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          position: number | null
          salon_id: string
          service_id: string
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          barber_id?: string | null
          booking_date?: string | null
          booking_time?: string | null
          completed_at?: string | null
          created_at?: string
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          position?: number | null
          salon_id: string
          service_id: string
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          barber_id?: string | null
          booking_date?: string | null
          booking_time?: string | null
          completed_at?: string | null
          created_at?: string
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          position?: number | null
          salon_id?: string
          service_id?: string
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          lat: number | null
          lng: number | null
          location: string | null
          name: string
          rating: number | null
          status: string
          owner_id: string | null
          owner_record_id: string | null
          owner_name: string | null
          owner_phone: string | null
          address: string | null
          city: string | null
          pincode: string | null
          open_time: string | null
          close_time: string | null
          auto_close: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          location?: string | null
          name: string
          rating?: number | null
          status?: string
          owner_id?: string | null
          owner_record_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          address?: string | null
          city?: string | null
          pincode?: string | null
          open_time?: string | null
          close_time?: string | null
          auto_close?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          location?: string | null
          name?: string
          rating?: number | null
          status?: string
          owner_id?: string | null
          owner_record_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          address?: string | null
          city?: string | null
          pincode?: string | null
          open_time?: string | null
          close_time?: string | null
          auto_close?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "salons_owner_record_id_fkey"
            columns: ["owner_record_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          }
        ]
      }
      services: {
        Row: {
          duration: number
          id: string
          name: string
          price: number
          salon_id: string
        }
        Insert: {
          duration: number
          id?: string
          name: string
          price: number
          salon_id: string
        }
        Update: {
          duration?: number
          id?: string
          name?: string
          price?: number
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          id: string
          salon_id: string
          name: string
          chair_number: number
          specialization: string | null
          is_available: boolean
          created_at: string
          experience: number
        }
        Insert: {
          id?: string
          salon_id: string
          name: string
          chair_number?: number
          specialization?: string | null
          is_available?: boolean
          created_at?: string
          experience?: number
        }
        Update: {
          id?: string
          salon_id?: string
          name?: string
          chair_number?: number
          specialization?: string | null
          is_available?: boolean
          created_at?: string
          experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "barbers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      join_queue: {
        Args: {
          p_salon_id: string
          p_user_id: string
          p_service_ids: string[]
          p_barber_id?: string
        }
        Returns: string
      }
      register_salon: {
        Args: {
          p_salon_name: string
          p_owner_name: string
          p_barber_name: string
          p_email: string
          p_price_list: number
          p_duration: number
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
