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
      barbers: {
        Row: {
          chair_number: number | null
          experience: number | null
          id: string
          name: string
          salon_id: string | null
          specialization: string | null
        }
        Insert: {
          chair_number?: number | null
          experience?: number | null
          id?: string
          name: string
          salon_id?: string | null
          specialization?: string | null
        }
        Update: {
          chair_number?: number | null
          experience?: number | null
          id?: string
          name?: string
          salon_id?: string | null
          specialization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_barbers_salon"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_barbers_salon"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          profile_complete_pct: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          profile_complete_pct?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          profile_complete_pct?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_notifications: {
        Row: {
          booking_id: string | null
          created_at: string | null
          id: string
          recipient: string
          salon_id: string | null
          sent_at: string | null
          status: string | null
          to_email: string
          type: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          id?: string
          recipient: string
          salon_id?: string | null
          sent_at?: string | null
          status?: string | null
          to_email: string
          type: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          id?: string
          recipient?: string
          salon_id?: string | null
          sent_at?: string | null
          status?: string | null
          to_email?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_active?: boolean | null
          is_verified?: boolean | null
          name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      queue: {
        Row: {
          alt_phone: string | null
          barber_id: string | null
          booking_date: string | null
          completed_at: string | null
          contact_phone: string | null
          created_at: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          customer_phone: string
          email: string | null
          id: string
          notes: string | null
          position: number | null
          salon_id: string | null
          service_id: string | null
          started_at: string | null
          status: string | null
          time_slot: string | null
          user_id: string | null
        }
        Insert: {
          alt_phone?: string | null
          barber_id?: string | null
          booking_date?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone: string
          email?: string | null
          id?: string
          notes?: string | null
          position?: number | null
          salon_id?: string | null
          service_id?: string | null
          started_at?: string | null
          status?: string | null
          time_slot?: string | null
          user_id?: string | null
        }
        Update: {
          alt_phone?: string | null
          barber_id?: string | null
          booking_date?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string
          email?: string | null
          id?: string
          notes?: string | null
          position?: number | null
          salon_id?: string | null
          service_id?: string | null
          started_at?: string | null
          status?: string | null
          time_slot?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
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
      salon_holidays: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_full_day: boolean
          name: string
          note: string | null
          salon_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_full_day?: boolean
          name: string
          note?: string | null
          salon_id: string
          type?: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_full_day?: boolean
          name?: string
          note?: string | null
          salon_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_holidays_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_holidays_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          address: string | null
          advance_booking_days: number | null
          allow_advance_on_closed: boolean | null
          city: string | null
          close_time: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_manual_closed: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          open_time: string | null
          owner_id: string | null
          phone: string | null
          pincode: string | null
        }
        Insert: {
          address?: string | null
          advance_booking_days?: number | null
          allow_advance_on_closed?: boolean | null
          city?: string | null
          close_time?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_manual_closed?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          open_time?: string | null
          owner_id?: string | null
          phone?: string | null
          pincode?: string | null
        }
        Update: {
          address?: string | null
          advance_booking_days?: number | null
          allow_advance_on_closed?: boolean | null
          city?: string | null
          close_time?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_manual_closed?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          open_time?: string | null
          owner_id?: string | null
          phone?: string | null
          pincode?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          duration: number | null
          id: string
          name: string
          price: number | null
          salon_id: string | null
        }
        Insert: {
          duration?: number | null
          id?: string
          name: string
          price?: number | null
          salon_id?: string | null
        }
        Update: {
          duration?: number | null
          id?: string
          name?: string
          price?: number | null
          salon_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_services_salon"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_services_salon"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      appointments: {
        Row: {
          alt_phone: string | null
          barber_id: string | null
          booking_date: string | null
          completed_at: string | null
          contact_phone: string | null
          created_at: string | null
          customer_first_name: string | null
          customer_last_name: string | null
          customer_phone: string | null
          email: string | null
          id: string | null
          notes: string | null
          position: number | null
          salon_id: string | null
          service_id: string | null
          started_at: string | null
          status: string | null
          time_slot: string | null
          user_id: string | null
        }
        Insert: {
          alt_phone?: string | null
          barber_id?: string | null
          booking_date?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          email?: string | null
          id?: string | null
          notes?: string | null
          position?: number | null
          salon_id?: string | null
          service_id?: string | null
          started_at?: string | null
          status?: string | null
          time_slot?: string | null
          user_id?: string | null
        }
        Update: {
          alt_phone?: string | null
          barber_id?: string | null
          booking_date?: string | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_first_name?: string | null
          customer_last_name?: string | null
          customer_phone?: string | null
          email?: string | null
          id?: string | null
          notes?: string | null
          position?: number | null
          salon_id?: string | null
          service_id?: string | null
          started_at?: string | null
          status?: string | null
          time_slot?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_with_stats"
            referencedColumns: ["id"]
          },
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
      salon_with_stats: {
        Row: {
          address: string | null
          advance_booking_days: number | null
          allow_advance_on_closed: boolean | null
          city: string | null
          close_time: string | null
          created_at: string | null
          id: string | null
          image_url: string | null
          is_manual_closed: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string | null
          open_time: string | null
          owner_id: string | null
          phone: string | null
          pincode: string | null
          queue_count: number | null
          wait_time: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      join_queue: {
        Args: {
          p_barber_id?: string
          p_salon_id: string
          p_service_ids: string[]
          p_user_id: string
        }
        Returns: string
      }
      register_salon: {
        Args: {
          p_barber_name: string
          p_duration: number
          p_email: string
          p_owner_name: string
          p_price: number
          p_salon_name: string
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
