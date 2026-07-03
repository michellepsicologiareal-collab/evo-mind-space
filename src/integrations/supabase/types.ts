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
      act_formulations: {
        Row: {
          apresentacao_problema: Json
          barreiras_geradas: string | null
          created_at: string
          direcionamento_gerado: string | null
          hexaflex: Json
          id: string
          matriz_act: Json
          observacoes_terapeuta: string | null
          patient_id: string
          therapist_id: string
          updated_at: string
          valores: Json
        }
        Insert: {
          apresentacao_problema?: Json
          barreiras_geradas?: string | null
          created_at?: string
          direcionamento_gerado?: string | null
          hexaflex?: Json
          id?: string
          matriz_act?: Json
          observacoes_terapeuta?: string | null
          patient_id: string
          therapist_id: string
          updated_at?: string
          valores?: Json
        }
        Update: {
          apresentacao_problema?: Json
          barreiras_geradas?: string | null
          created_at?: string
          direcionamento_gerado?: string | null
          hexaflex?: Json
          id?: string
          matriz_act?: Json
          observacoes_terapeuta?: string | null
          patient_id?: string
          therapist_id?: string
          updated_at?: string
          valores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "act_formulations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesis_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          revoked_at: string | null
          signed_anamnesis_id: string | null
          token: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_id: string
          revoked_at?: string | null
          signed_anamnesis_id?: string | null
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          revoked_at?: string | null
          signed_anamnesis_id?: string | null
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_invites_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_invites_signed_anamnesis_id_fkey"
            columns: ["signed_anamnesis_id"]
            isOneToOne: false
            referencedRelation: "child_anamneses"
            referencedColumns: ["id"]
          },
        ]
      }
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
      backup_history: {
        Row: {
          backup_date: string
          created_at: string
          csv_zip_path: string | null
          error_message: string | null
          id: string
          json_path: string | null
          kind: string
          size_bytes: number
          status: string
          tables_count: number
          user_id: string
        }
        Insert: {
          backup_date?: string
          created_at?: string
          csv_zip_path?: string | null
          error_message?: string | null
          id?: string
          json_path?: string | null
          kind?: string
          size_bytes?: number
          status?: string
          tables_count?: number
          user_id: string
        }
        Update: {
          backup_date?: string
          created_at?: string
          csv_zip_path?: string | null
          error_message?: string | null
          id?: string
          json_path?: string | null
          kind?: string
          size_bytes?: number
          status?: string
          tables_count?: number
          user_id?: string
        }
        Relationships: []
      }
      case_formulations: {
        Row: {
          ai_summary: string | null
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
          ai_summary?: string | null
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
          ai_summary?: string | null
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
          invite_id: string | null
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
          invite_id?: string | null
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
          invite_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "child_anamneses_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "anamnesis_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          patient_label: string | null
          revoked_at: string | null
          signed_contract_id: string | null
          template_id: string
          token: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_label?: string | null
          revoked_at?: string | null
          signed_contract_id?: string | null
          template_id: string
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          patient_label?: string | null
          revoked_at?: string | null
          signed_contract_id?: string | null
          template_id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_invites_signed_contract_fk"
            columns: ["signed_contract_id"]
            isOneToOne: false
            referencedRelation: "signed_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_invites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
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
      google_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          nonce: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
          user_id?: string
        }
        Relationships: []
      }
      homework_tasks: {
        Row: {
          actions: Json | null
          content: string
          created_at: string
          id: string
          patient_id: string
          sent_at: string | null
          session_points: string | null
          session_record_id: string | null
          title: string
          updated_at: string
          user_id: string
          weekly_observations: string | null
        }
        Insert: {
          actions?: Json | null
          content: string
          created_at?: string
          id?: string
          patient_id: string
          sent_at?: string | null
          session_points?: string | null
          session_record_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          weekly_observations?: string | null
        }
        Update: {
          actions?: Json | null
          content?: string
          created_at?: string
          id?: string
          patient_id?: string
          sent_at?: string | null
          session_points?: string | null
          session_record_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          weekly_observations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_tasks_session_record_id_fkey"
            columns: ["session_record_id"]
            isOneToOne: false
            referencedRelation: "session_records"
            referencedColumns: ["id"]
          },
        ]
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
      patient_ai_summaries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          edited_content: Json | null
          generated_at: string
          id: string
          last_approved_at: string | null
          last_approved_by: string | null
          last_approved_data: Json | null
          model_used: string | null
          patient_id: string
          pending_draft_data: Json | null
          pending_draft_generated_at: string | null
          pending_draft_model: string | null
          pending_draft_source_records: Json | null
          pending_draft_tokens: number | null
          source_records: Json
          status: string
          summary_data: Json
          tokens_used: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          edited_content?: Json | null
          generated_at?: string
          id?: string
          last_approved_at?: string | null
          last_approved_by?: string | null
          last_approved_data?: Json | null
          model_used?: string | null
          patient_id: string
          pending_draft_data?: Json | null
          pending_draft_generated_at?: string | null
          pending_draft_model?: string | null
          pending_draft_source_records?: Json | null
          pending_draft_tokens?: number | null
          source_records?: Json
          status?: string
          summary_data: Json
          tokens_used?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          edited_content?: Json | null
          generated_at?: string
          id?: string
          last_approved_at?: string | null
          last_approved_by?: string | null
          last_approved_data?: Json | null
          model_used?: string | null
          patient_id?: string
          pending_draft_data?: Json | null
          pending_draft_generated_at?: string | null
          pending_draft_model?: string | null
          pending_draft_source_records?: Json | null
          pending_draft_tokens?: number | null
          source_records?: Json
          status?: string
          summary_data?: Json
          tokens_used?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_ai_summaries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_ai_summary_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          note: string | null
          patient_id: string
          snapshot: Json | null
          summary_id: string | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          note?: string | null
          patient_id: string
          snapshot?: Json | null
          summary_id?: string | null
          to_status?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          note?: string | null
          patient_id?: string
          snapshot?: Json | null
          summary_id?: string | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_ai_summary_events_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "patient_ai_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_progress: {
        Row: {
          attention_flag: Database["public"]["Enums"]["attention_flag"]
          attention_set_at: string | null
          attention_set_by: string | null
          clinical_observation: string | null
          created_at: string
          data_model: Database["public"]["Enums"]["progress_data_model"]
          emotions: Json | null
          id: string
          mood_score: number | null
          note: string | null
          patient_context: string | null
          patient_id: string
          recorded_at: string
          session_id: string | null
          updated_at: string
          user_id: string
          wellbeing_score: number | null
          wellbeing_source:
            | Database["public"]["Enums"]["wellbeing_source"]
            | null
        }
        Insert: {
          attention_flag?: Database["public"]["Enums"]["attention_flag"]
          attention_set_at?: string | null
          attention_set_by?: string | null
          clinical_observation?: string | null
          created_at?: string
          data_model?: Database["public"]["Enums"]["progress_data_model"]
          emotions?: Json | null
          id?: string
          mood_score?: number | null
          note?: string | null
          patient_context?: string | null
          patient_id: string
          recorded_at?: string
          session_id?: string | null
          updated_at?: string
          user_id: string
          wellbeing_score?: number | null
          wellbeing_source?:
            | Database["public"]["Enums"]["wellbeing_source"]
            | null
        }
        Update: {
          attention_flag?: Database["public"]["Enums"]["attention_flag"]
          attention_set_at?: string | null
          attention_set_by?: string | null
          clinical_observation?: string | null
          created_at?: string
          data_model?: Database["public"]["Enums"]["progress_data_model"]
          emotions?: Json | null
          id?: string
          mood_score?: number | null
          note?: string | null
          patient_context?: string | null
          patient_id?: string
          recorded_at?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string
          wellbeing_score?: number | null
          wellbeing_source?:
            | Database["public"]["Enums"]["wellbeing_source"]
            | null
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
          homework_token: string | null
          id: string
          is_active: boolean
          medications: string | null
          modality: string
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
          homework_token?: string | null
          id?: string
          is_active?: boolean
          medications?: string | null
          modality?: string
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
          homework_token?: string | null
          id?: string
          is_active?: boolean
          medications?: string | null
          modality?: string
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
          terms_accepted_at: string | null
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
          terms_accepted_at?: string | null
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
          terms_accepted_at?: string | null
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
      schema_formulations: {
        Row: {
          adulto_saudavel_forca: number | null
          ambiente_familiar: string | null
          conexao_gerada: string | null
          created_at: string
          esquemas: Json
          eventos_marcantes: string | null
          figuras_vinculacao: string | null
          foco_terapeutico: string | null
          historia_origem: string | null
          id: string
          modos: Json
          necessidades: Json
          observacoes_terapeuta: string | null
          outras_necessidades: string | null
          padrao_identificado: string | null
          patient_id: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          adulto_saudavel_forca?: number | null
          ambiente_familiar?: string | null
          conexao_gerada?: string | null
          created_at?: string
          esquemas?: Json
          eventos_marcantes?: string | null
          figuras_vinculacao?: string | null
          foco_terapeutico?: string | null
          historia_origem?: string | null
          id?: string
          modos?: Json
          necessidades?: Json
          observacoes_terapeuta?: string | null
          outras_necessidades?: string | null
          padrao_identificado?: string | null
          patient_id: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          adulto_saudavel_forca?: number | null
          ambiente_familiar?: string | null
          conexao_gerada?: string | null
          created_at?: string
          esquemas?: Json
          eventos_marcantes?: string | null
          figuras_vinculacao?: string | null
          foco_terapeutico?: string | null
          historia_origem?: string | null
          id?: string
          modos?: Json
          necessidades?: Json
          observacoes_terapeuta?: string | null
          outras_necessidades?: string | null
          padrao_identificado?: string | null
          patient_id?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schema_formulations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      session_plans: {
        Row: {
          created_at: string
          id: string
          meta_id: string | null
          objetivo: string | null
          observacoes: string | null
          patient_id: string
          retomar: string | null
          session_id: string | null
          tecnicas: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_id?: string | null
          objetivo?: string | null
          observacoes?: string | null
          patient_id: string
          retomar?: string | null
          session_id?: string | null
          tecnicas?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_id?: string | null
          objetivo?: string | null
          observacoes?: string | null
          patient_id?: string
          retomar?: string | null
          session_id?: string | null
          tecnicas?: string[]
          updated_at?: string
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
          plan_id: string | null
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
          plan_id?: string | null
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
          plan_id?: string | null
          private_notes?: string | null
          risk_indicator?: string
          session_date?: string
          session_id?: string | null
          session_number?: number | null
          themes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_records_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          billing_sent_at: string | null
          confirmation_sent_at: string | null
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
          confirmation_sent_at?: string | null
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
          confirmation_sent_at?: string | null
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
          invite_id: string | null
          ip_address: string | null
          patient_address: string
          patient_birth_date: string | null
          patient_cpf: string
          patient_name: string
          patient_whatsapp: string
          template_id: string
          user_agent: string | null
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
          invite_id?: string | null
          ip_address?: string | null
          patient_address?: string
          patient_birth_date?: string | null
          patient_cpf?: string
          patient_name: string
          patient_whatsapp?: string
          template_id: string
          user_agent?: string | null
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
          invite_id?: string | null
          ip_address?: string | null
          patient_address?: string
          patient_birth_date?: string | null
          patient_cpf?: string
          patient_name?: string
          patient_whatsapp?: string
          template_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_contracts_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "contract_invites"
            referencedColumns: ["id"]
          },
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
      treatment_goals: {
        Row: {
          created_at: string
          descricao: string
          id: string
          ordem: number
          patient_id: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          patient_id: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          patient_id?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treatment_plans: {
        Row: {
          abordagem: string[]
          cid: string | null
          conceitualizacao: string | null
          created_at: string
          id: string
          patient_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abordagem?: string[]
          cid?: string | null
          conceitualizacao?: string | null
          created_at?: string
          id?: string
          patient_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abordagem?: string[]
          cid?: string | null
          conceitualizacao?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      treatment_revisions: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          patient_id: string
          sessao_ref: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          patient_id: string
          sessao_ref?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          patient_id?: string
          sessao_ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      treatment_techniques: {
        Row: {
          created_at: string
          id: string
          nome: string
          patient_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          patient_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          patient_id?: string
          user_id?: string
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
      get_child_anamnesis_by_invite_token: {
        Args: { _token: string }
        Returns: {
          child_name: string
          expires_at: string
          invite_id: string
          professional_crp: string
          professional_name: string
          status: string
        }[]
      }
      get_contract_by_invite_token: {
        Args: { _token: string }
        Returns: {
          clauses: Json
          expires_at: string
          invite_id: string
          lgpd_clause: string
          professional_crp: string
          professional_name: string
          status: string
          template_id: string
        }[]
      }
      get_homework_by_token: {
        Args: { _token: string }
        Returns: {
          actions: Json
          content: string
          created_at: string
          patient_name: string
          sent_at: string
          session_points: string
          task_id: string
          therapist_crp: string
          therapist_name: string
          title: string
          weekly_observations: string
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
      list_my_supervisees: {
        Args: never
        Returns: {
          avatar_url: string
          crp: string
          full_name: string
          id: string
          phone: string
          profile_type: Database["public"]["Enums"]["profile_type"]
          specialty: string
        }[]
      }
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
      submit_child_anamnesis: {
        Args: { _ip: string; _payload: Json; _token: string; _ua: string }
        Returns: string
      }
      submit_signed_contract: {
        Args: { _ip: string; _payload: Json; _token: string; _ua: string }
        Returns: string
      }
      unlink_supervisee: {
        Args: { _supervisee_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      attention_flag: "not_assessed" | "none" | "watch" | "urgent"
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
      progress_data_model: "legacy_unclassified" | "v2_structured"
      session_status:
        | "scheduled"
        | "completed"
        | "no_show"
        | "rescheduled"
        | "cancelled"
        | "confirmed"
      session_type: "clinical" | "supervision"
      subscription_status: "free" | "pending" | "active"
      wellbeing_source: "patient_self_report" | "professional_estimate"
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
      attention_flag: ["not_assessed", "none", "watch", "urgent"],
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
      progress_data_model: ["legacy_unclassified", "v2_structured"],
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
      wellbeing_source: ["patient_self_report", "professional_estimate"],
    },
  },
} as const
