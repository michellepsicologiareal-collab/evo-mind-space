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
      library_materials: {
        Row: {
          category: Database["public"]["Enums"]["library_category"]
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          is_premium: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["library_category"]
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          is_premium?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["library_category"]
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          is_premium?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_progress: {
        Row: {
          created_at: string
          id: string
          mood_score: number | null
          note: string | null
          patient_id: string
          recorded_at: string
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood_score?: number | null
          note?: string | null
          patient_id: string
          recorded_at?: string
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood_score?: number | null
          note?: string | null
          patient_id?: string
          recorded_at?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          anamnesis: string | null
          birth_date: string | null
          chief_complaint: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          session_price: number | null
          shared_with_supervisor: boolean
          treatment_plan: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anamnesis?: string | null
          birth_date?: string | null
          chief_complaint?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          session_price?: number | null
          shared_with_supervisor?: boolean
          treatment_plan?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anamnesis?: string | null
          birth_date?: string | null
          chief_complaint?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          session_price?: number | null
          shared_with_supervisor?: boolean
          treatment_plan?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clinic_name: string | null
          created_at: string
          crp: string | null
          full_name: string | null
          id: string
          phone: string | null
          pix_key: string | null
          profile_type: Database["public"]["Enums"]["profile_type"]
          reminder_enabled: boolean
          reminder_group_by_patient: boolean
          reminder_group_sort: string
          reminder_window_hours: number
          specialty: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clinic_name?: string | null
          created_at?: string
          crp?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          pix_key?: string | null
          profile_type?: Database["public"]["Enums"]["profile_type"]
          reminder_enabled?: boolean
          reminder_group_by_patient?: boolean
          reminder_group_sort?: string
          reminder_window_hours?: number
          specialty?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clinic_name?: string | null
          created_at?: string
          crp?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_key?: string | null
          profile_type?: Database["public"]["Enums"]["profile_type"]
          reminder_enabled?: boolean
          reminder_group_by_patient?: boolean
          reminder_group_sort?: string
          reminder_window_hours?: number
          specialty?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          paid_at: string | null
          patient_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number | null
          scheduled_at: string
          service_id: string | null
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          patient_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number | null
          scheduled_at: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          patient_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number | null
          scheduled_at?: string
          service_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      tcc_records: {
        Row: {
          automatic_thought: string | null
          behavior: string | null
          cognitive_distortion: string | null
          created_at: string
          emotion: string | null
          id: string
          patient_id: string
          rational_response: string | null
          session_id: string | null
          situation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          automatic_thought?: string | null
          behavior?: string | null
          cognitive_distortion?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          patient_id: string
          rational_response?: string | null
          session_id?: string | null
          situation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          automatic_thought?: string | null
          behavior?: string | null
          cognitive_distortion?: string | null
          created_at?: string
          emotion?: string | null
          id?: string
          patient_id?: string
          rational_response?: string | null
          session_id?: string | null
          situation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tcc_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tcc_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_supervisor_see_patient: {
        Args: { _patient_id: string }
        Returns: boolean
      }
      get_profile_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_supervisor_of: { Args: { _supervisee_id: string }; Returns: boolean }
      link_supervisee_by_email: { Args: { _email: string }; Returns: string }
      unlink_supervisee: {
        Args: { _supervisee_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      library_category:
        | "documentos_legais"
        | "materiais_pacientes"
        | "guias_tcc"
      payment_method: "pix" | "card" | "cash"
      payment_status: "pending" | "paid"
      profile_type: "standard" | "supervisee" | "supervisor"
      session_status:
        | "scheduled"
        | "completed"
        | "no_show"
        | "rescheduled"
        | "cancelled"
      subscription_status: "free" | "pending" | "active"
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
      app_role: ["admin", "moderator", "user"],
      library_category: [
        "documentos_legais",
        "materiais_pacientes",
        "guias_tcc",
      ],
      payment_method: ["pix", "card", "cash"],
      payment_status: ["pending", "paid"],
      profile_type: ["standard", "supervisee", "supervisor"],
      session_status: [
        "scheduled",
        "completed",
        "no_show",
        "rescheduled",
        "cancelled",
      ],
      subscription_status: ["free", "pending", "active"],
    },
  },
} as const
