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
      audit_logs: {
        Row: {
          access_type: Database["public"]["Enums"]["audit_access_type"]
          block_reason: string | null
          created_at: string
          id: string
          patient_id: string | null
          resource_id: string
          resource_type: string
          result: Database["public"]["Enums"]["audit_result"]
          supervisee_id: string | null
          supervisor_id: string | null
          user_id: string
        }
        Insert: {
          access_type?: Database["public"]["Enums"]["audit_access_type"]
          block_reason?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          resource_id: string
          resource_type: string
          result?: Database["public"]["Enums"]["audit_result"]
          supervisee_id?: string | null
          supervisor_id?: string | null
          user_id: string
        }
        Update: {
          access_type?: Database["public"]["Enums"]["audit_access_type"]
          block_reason?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          resource_id?: string
          resource_type?: string
          result?: Database["public"]["Enums"]["audit_result"]
          supervisee_id?: string | null
          supervisor_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      case_formulations: {
        Row: {
          behaviors: string | null
          core_beliefs: string | null
          created_at: string
          emotions: string | null
          environment: string | null
          id: string
          patient_id: string
          physical_reactions: string | null
          thoughts: string | null
          treatment_goals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          behaviors?: string | null
          core_beliefs?: string | null
          created_at?: string
          emotions?: string | null
          environment?: string | null
          id?: string
          patient_id: string
          physical_reactions?: string | null
          thoughts?: string | null
          treatment_goals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          behaviors?: string | null
          core_beliefs?: string | null
          created_at?: string
          emotions?: string | null
          environment?: string | null
          id?: string
          patient_id?: string
          physical_reactions?: string | null
          thoughts?: string | null
          treatment_goals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      child_anamneses: {
        Row: {
          authorized_lgpd: boolean
          chief_complaint: string | null
          child_birth_date: string | null
          child_name: string | null
          created_at: string
          delivery_type: string | null
          email: string | null
          father_name: string | null
          father_profession: string | null
          father_schooling: string | null
          feeding: string | null
          has_disease: string | null
          id: string
          mother_name: string | null
          mother_profession: string | null
          mother_schooling: string | null
          parents_disorder: string | null
          parents_disorder_which: string | null
          parents_kinship: string | null
          parents_living_together: string | null
          parents_relationship: string | null
          patient_id: string
          pregnancy_health_issue: string | null
          pregnancy_health_which: string | null
          relationship_father: string | null
          relationship_mother: string | null
          school_relationship: string | null
          schooling: string | null
          sexual_curiosity: string | null
          sleep: string | null
          social_relationship: string | null
          updated_at: string
          user_id: string
          was_desired: string | null
          weeks_at_birth: string | null
        }
        Insert: {
          authorized_lgpd?: boolean
          chief_complaint?: string | null
          child_birth_date?: string | null
          child_name?: string | null
          created_at?: string
          delivery_type?: string | null
          email?: string | null
          father_name?: string | null
          father_profession?: string | null
          father_schooling?: string | null
          feeding?: string | null
          has_disease?: string | null
          id?: string
          mother_name?: string | null
          mother_profession?: string | null
          mother_schooling?: string | null
          parents_disorder?: string | null
          parents_disorder_which?: string | null
          parents_kinship?: string | null
          parents_living_together?: string | null
          parents_relationship?: string | null
          patient_id: string
          pregnancy_health_issue?: string | null
          pregnancy_health_which?: string | null
          relationship_father?: string | null
          relationship_mother?: string | null
          school_relationship?: string | null
          schooling?: string | null
          sexual_curiosity?: string | null
          sleep?: string | null
          social_relationship?: string | null
          updated_at?: string
          user_id: string
          was_desired?: string | null
          weeks_at_birth?: string | null
        }
        Update: {
          authorized_lgpd?: boolean
          chief_complaint?: string | null
          child_birth_date?: string | null
          child_name?: string | null
          created_at?: string
          delivery_type?: string | null
          email?: string | null
          father_name?: string | null
          father_profession?: string | null
          father_schooling?: string | null
          feeding?: string | null
          has_disease?: string | null
          id?: string
          mother_name?: string | null
          mother_profession?: string | null
          mother_schooling?: string | null
          parents_disorder?: string | null
          parents_disorder_which?: string | null
          parents_kinship?: string | null
          parents_living_together?: string | null
          parents_relationship?: string | null
          patient_id?: string
          pregnancy_health_issue?: string | null
          pregnancy_health_which?: string | null
          relationship_father?: string | null
          relationship_mother?: string | null
          school_relationship?: string | null
          schooling?: string | null
          sexual_curiosity?: string | null
          sleep?: string | null
          social_relationship?: string | null
          updated_at?: string
          user_id?: string
          was_desired?: string | null
          weeks_at_birth?: string | null
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          clauses: Json
          created_at: string
          id: string
          lgpd_clause: string
          professional_address: string
          professional_cpf: string
          professional_crp: string
          professional_email: string
          professional_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clauses?: Json
          created_at?: string
          id?: string
          lgpd_clause?: string
          professional_address?: string
          professional_cpf?: string
          professional_crp?: string
          professional_email?: string
          professional_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clauses?: Json
          created_at?: string
          id?: string
          lgpd_clause?: string
          professional_address?: string
          professional_cpf?: string
          professional_crp?: string
          professional_email?: string
          professional_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          session_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          session_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          session_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
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
          category: Database["public"]["Enums"]["patient_category"]
          chief_complaint: string | null
          created_at: string
          email: string | null
          financial_responsible_name: string | null
          financial_responsible_phone: string | null
          full_name: string
          has_financial_responsible: boolean
          has_psychiatrist: boolean
          id: string
          is_active: boolean
          medications: string | null
          notes: string | null
          phone: string | null
          psychiatrist_name: string | null
          psychiatrist_phone: string | null
          session_price: number | null
          shared_with_supervisor: boolean
          treatment_end_date: string | null
          treatment_plan: string | null
          treatment_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anamnesis?: string | null
          birth_date?: string | null
          category?: Database["public"]["Enums"]["patient_category"]
          chief_complaint?: string | null
          created_at?: string
          email?: string | null
          financial_responsible_name?: string | null
          financial_responsible_phone?: string | null
          full_name: string
          has_financial_responsible?: boolean
          has_psychiatrist?: boolean
          id?: string
          is_active?: boolean
          medications?: string | null
          notes?: string | null
          phone?: string | null
          psychiatrist_name?: string | null
          psychiatrist_phone?: string | null
          session_price?: number | null
          shared_with_supervisor?: boolean
          treatment_end_date?: string | null
          treatment_plan?: string | null
          treatment_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anamnesis?: string | null
          birth_date?: string | null
          category?: Database["public"]["Enums"]["patient_category"]
          chief_complaint?: string | null
          created_at?: string
          email?: string | null
          financial_responsible_name?: string | null
          financial_responsible_phone?: string | null
          full_name?: string
          has_financial_responsible?: boolean
          has_psychiatrist?: boolean
          id?: string
          is_active?: boolean
          medications?: string | null
          notes?: string | null
          phone?: string | null
          psychiatrist_name?: string | null
          psychiatrist_phone?: string | null
          session_price?: number | null
          shared_with_supervisor?: boolean
          treatment_end_date?: string | null
          treatment_plan?: string | null
          treatment_start_date?: string | null
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
          goal_records: number
          goal_revenue: number
          goal_sessions: number
          id: string
          is_approved: boolean
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
          goal_records?: number
          goal_revenue?: number
          goal_sessions?: number
          id: string
          is_approved?: boolean
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
          goal_records?: number
          goal_revenue?: number
          goal_sessions?: number
          id?: string
          is_approved?: boolean
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
      selfcare_checkins: {
        Row: {
          balance: boolean | null
          checked_at: string
          created_at: string
          food: boolean | null
          health: boolean | null
          id: string
          movement: boolean | null
          pauses_count: number
          sessions_count: number
          sleep: boolean | null
          stress_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: boolean | null
          checked_at?: string
          created_at?: string
          food?: boolean | null
          health?: boolean | null
          id?: string
          movement?: boolean | null
          pauses_count?: number
          sessions_count?: number
          sleep?: boolean | null
          stress_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: boolean | null
          checked_at?: string
          created_at?: string
          food?: boolean | null
          health?: boolean | null
          id?: string
          movement?: boolean | null
          pauses_count?: number
          sessions_count?: number
          sleep?: boolean | null
          stress_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      session_evolutions: {
        Row: {
          created_at: string
          homework: string | null
          id: string
          patient_id: string
          session_id: string | null
          session_summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          homework?: string | null
          id?: string
          patient_id: string
          session_id?: string | null
          session_summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          homework?: string | null
          id?: string
          patient_id?: string
          session_id?: string | null
          session_summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_gcal_events: {
        Row: {
          created_at: string
          gcal_event_id: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gcal_event_id: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          gcal_event_id?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      session_records: {
        Row: {
          chief_complaint: string | null
          clinical_observations: string | null
          created_at: string
          duration_minutes: number
          engagement: number | null
          id: string
          modality: string
          next_session_plan: string | null
          patient_id: string
          private_notes: string | null
          risk_indicator: string
          session_date: string
          session_id: string | null
          session_number: number | null
          themes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          chief_complaint?: string | null
          clinical_observations?: string | null
          created_at?: string
          duration_minutes?: number
          engagement?: number | null
          id?: string
          modality?: string
          next_session_plan?: string | null
          patient_id: string
          private_notes?: string | null
          risk_indicator?: string
          session_date?: string
          session_id?: string | null
          session_number?: number | null
          themes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          chief_complaint?: string | null
          clinical_observations?: string | null
          created_at?: string
          duration_minutes?: number
          engagement?: number | null
          id?: string
          modality?: string
          next_session_plan?: string | null
          patient_id?: string
          private_notes?: string | null
          risk_indicator?: string
          session_date?: string
          session_id?: string | null
          session_number?: number | null
          themes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          billing_sent_at: string | null
          confirmation_token: string | null
          created_at: string
          discussed_patient_id: string | null
          duration_minutes: number
          id: string
          is_expense: boolean
          meeting_link: string | null
          modality: string
          notes: string | null
          paid_at: string | null
          patient_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number | null
          scheduled_at: string
          service_id: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_sent_at?: string | null
          confirmation_token?: string | null
          created_at?: string
          discussed_patient_id?: string | null
          duration_minutes?: number
          id?: string
          is_expense?: boolean
          meeting_link?: string | null
          modality?: string
          notes?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number | null
          scheduled_at: string
          service_id?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_sent_at?: string | null
          confirmation_token?: string | null
          created_at?: string
          discussed_patient_id?: string | null
          duration_minutes?: number
          id?: string
          is_expense?: boolean
          meeting_link?: string | null
          modality?: string
          notes?: string | null
          paid_at?: string | null
          patient_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number | null
          scheduled_at?: string
          service_id?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_discussed_patient_id_fkey"
            columns: ["discussed_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
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
      signed_contracts: {
        Row: {
          accepted_at: string
          accepted_lgpd: boolean
          clause_responses: Json
          created_at: string
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          id: string
          ip_address: string | null
          patient_address: string
          patient_birth_date: string | null
          patient_cpf: string
          patient_name: string
          patient_whatsapp: string
          template_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_lgpd?: boolean
          clause_responses?: Json
          created_at?: string
          emergency_contact_name?: string
          emergency_contact_phone?: string
          emergency_contact_relationship?: string
          id?: string
          ip_address?: string | null
          patient_address?: string
          patient_birth_date?: string | null
          patient_cpf?: string
          patient_name: string
          patient_whatsapp?: string
          template_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          accepted_lgpd?: boolean
          clause_responses?: Json
          created_at?: string
          emergency_contact_name?: string
          emergency_contact_phone?: string
          emergency_contact_relationship?: string
          id?: string
          ip_address?: string | null
          patient_address?: string
          patient_birth_date?: string | null
          patient_cpf?: string
          patient_name?: string
          patient_whatsapp?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisee_goals: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          status: string
          supervisee_id: string
          supervisor_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          supervisee_id: string
          supervisor_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          supervisee_id?: string
          supervisor_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      supervision_records: {
        Row: {
          chief_complaint: string
          created_at: string
          general_observations: string
          id: string
          identified_beliefs: string
          patient_name: string
          planned_interventions: string
          problem_list: string
          shared_at: string | null
          shared_fields: string[]
          supervisee_id: string
          supervision_date: string
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          chief_complaint?: string
          created_at?: string
          general_observations?: string
          id?: string
          identified_beliefs?: string
          patient_name?: string
          planned_interventions?: string
          problem_list?: string
          shared_at?: string | null
          shared_fields?: string[]
          supervisee_id: string
          supervision_date?: string
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          chief_complaint?: string
          created_at?: string
          general_observations?: string
          id?: string
          identified_beliefs?: string
          patient_name?: string
          planned_interventions?: string
          problem_list?: string
          shared_at?: string | null
          shared_fields?: string[]
          supervisee_id?: string
          supervision_date?: string
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: []
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
      therapist_triggers: {
        Row: {
          checked_at: string
          created_at: string
          id: string
          mood_emoji: string
          patient_id: string | null
          reflective_note: string | null
          triggers: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          id?: string
          mood_emoji?: string
          patient_id?: string | null
          reflective_note?: string | null
          triggers?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          id?: string
          mood_emoji?: string
          patient_id?: string | null
          reflective_note?: string | null
          triggers?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_triggers_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      ensure_current_profile: {
        Args: never
        Returns: {
          is_approved: boolean
          profile_type: Database["public"]["Enums"]["profile_type"]
        }[]
      }
      get_profile_id_by_email: { Args: { _email: string }; Returns: string }
      get_session_by_token: {
        Args: { _token: string }
        Returns: {
          duration_minutes: number
          id: string
          modality: string
          patient_name: string
          scheduled_at: string
          status: string
          therapist_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_supervisor_of: { Args: { _supervisee_id: string }; Returns: boolean }
      link_supervisee_by_email: { Args: { _email: string }; Returns: string }
      log_clinical_access: {
        Args: {
          _access_type?: Database["public"]["Enums"]["audit_access_type"]
          _block_reason?: string
          _patient_id?: string
          _resource_id: string
          _resource_type: string
          _result?: Database["public"]["Enums"]["audit_result"]
        }
        Returns: undefined
      }
      log_supervision_access: {
        Args: {
          _block_reason?: string
          _patient_id: string
          _resource_id: string
          _resource_type: string
          _result?: Database["public"]["Enums"]["audit_result"]
          _supervisee_id: string
        }
        Returns: undefined
      }
      respond_to_confirmation: {
        Args: { _confirm: boolean; _token: string }
        Returns: string
      }
      unlink_supervisee: {
        Args: { _supervisee_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      audit_access_type: "own" | "supervision"
      audit_result: "success" | "blocked"
      library_category:
        | "documentos_legais"
        | "materiais_pacientes"
        | "guias_tcc"
      notification_type: "confirmation" | "cancellation" | "general"
      patient_category:
        | "individual"
        | "crianca"
        | "grupo"
        | "casal"
        | "adolescente"
        | "avaliacao"
        | "supervisao"
        | "sessao_breve"
      payment_method: "pix" | "card" | "cash"
      payment_status: "pending" | "paid"
      profile_type: "standard" | "supervisee" | "supervisor"
      session_status:
        | "scheduled"
        | "completed"
        | "no_show"
        | "rescheduled"
        | "cancelled"
        | "confirmed"
      session_type: "clinical" | "supervision"
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
      audit_access_type: ["own", "supervision"],
      audit_result: ["success", "blocked"],
      library_category: [
        "documentos_legais",
        "materiais_pacientes",
        "guias_tcc",
      ],
      notification_type: ["confirmation", "cancellation", "general"],
      patient_category: [
        "individual",
        "crianca",
        "grupo",
        "casal",
        "adolescente",
        "avaliacao",
        "supervisao",
        "sessao_breve",
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
        "confirmed",
      ],
      session_type: ["clinical", "supervision"],
      subscription_status: ["free", "pending", "active"],
    },
  },
} as const
