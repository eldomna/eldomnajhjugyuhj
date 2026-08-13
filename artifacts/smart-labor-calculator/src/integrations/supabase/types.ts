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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ad_events: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          kind: string
          path: string | null
          session_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          kind: string
          path?: string | null
          session_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          kind?: string
          path?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module: string
          permission_code: string
          permission_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module: string
          permission_code: string
          permission_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          permission_code?: string
          permission_name?: string
        }
        Relationships: []
      }
      admin_role_assignments: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          mfa_enabled: boolean
          organization_id: string | null
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          mfa_enabled?: boolean
          organization_id?: string | null
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          mfa_enabled?: boolean
          organization_id?: string | null
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "admin_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          role_code: string
          role_name: string
          system_role: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          role_code: string
          role_name: string
          system_role?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          role_code?: string
          role_name?: string
          system_role?: boolean
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          created_at: string
          description: string | null
          display_seconds: number
          ends_at: string | null
          governorate: string | null
          id: string
          image_url: string
          is_active: boolean
          position: string
          redirect_url: string | null
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_seconds?: number
          ends_at?: string | null
          governorate?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          position?: string
          redirect_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_seconds?: number
          ends_at?: string | null
          governorate?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          position?: string
          redirect_url?: string | null
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          document_type: string | null
          error_message: string | null
          feature: string
          id: string
          latency_ms: number | null
          model: string | null
          quality_rating: number | null
          success: boolean
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          feature: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          quality_rating?: number | null
          success?: boolean
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          feature?: string
          id?: string
          latency_ms?: number | null
          model?: string | null
          quality_rating?: number | null
          success?: boolean
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string | null
          rate_limit_per_min: number
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id?: string | null
          rate_limit_per_min?: number
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          rate_limit_per_min?: number
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_ms: number | null
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          method?: string
          response_ms?: number | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_ms?: number | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      backups: {
        Row: {
          created_at: string
          id: string
          row_count: number
          snapshot: Json
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          row_count?: number
          snapshot: Json
          table_name: string
        }
        Update: {
          created_at?: string
          id?: string
          row_count?: number
          snapshot?: Json
          table_name?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          allow_pdf: boolean
          auto_renew: boolean
          calc_credits: number | null
          code: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          engines: string[]
          id: string
          is_active: boolean
          name: string
          period: string
          price: number
          show_details: boolean
          show_legal_refs: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_pdf?: boolean
          auto_renew?: boolean
          calc_credits?: number | null
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          engines?: string[]
          id?: string
          is_active?: boolean
          name: string
          period?: string
          price?: number
          show_details?: boolean
          show_legal_refs?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_pdf?: boolean
          auto_renew?: boolean
          calc_credits?: number | null
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          engines?: string[]
          id?: string
          is_active?: boolean
          name?: string
          period?: string
          price?: number
          show_details?: boolean
          show_legal_refs?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: {
          auto_renew: boolean
          created_at: string
          credits_remaining: number | null
          expires_at: string | null
          id: string
          notes: string | null
          payment_method_ref: string | null
          plan_code: string
          provider_code: string | null
          provider_ref: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          credits_remaining?: number | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method_ref?: string | null
          plan_code: string
          provider_code?: string | null
          provider_ref?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          credits_remaining?: number | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method_ref?: string | null
          plan_code?: string
          provider_code?: string | null
          provider_ref?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          discount_amount: number | null
          id: string
          metadata: Json
          payment_method_ref: string | null
          plan_code: string
          provider_code: string
          provider_txn_id: string | null
          receipt_url: string | null
          referral_code: string | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          discount_amount?: number | null
          id?: string
          metadata?: Json
          payment_method_ref?: string | null
          plan_code: string
          provider_code?: string
          provider_txn_id?: string | null
          receipt_url?: string | null
          referral_code?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          discount_amount?: number | null
          id?: string
          metadata?: Json
          payment_method_ref?: string | null
          plan_code?: string
          provider_code?: string
          provider_txn_id?: string | null
          receipt_url?: string | null
          referral_code?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          language: string | null
          name: string
          organization_id: string
          settings: Json
          timezone: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          name: string
          organization_id: string
          settings?: Json
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          name?: string
          organization_id?: string
          settings?: Json
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_logs: {
        Row: {
          calculation_id: string
          created_at: string
          error_message: string | null
          execution_time_ms: number
          formula_used: string | null
          id: string
          input_data: Json | null
          module_name: string
          output_data: Json | null
          rule_applied: string | null
          status: string
          step_number: number
          user_id: string
        }
        Insert: {
          calculation_id: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number
          formula_used?: string | null
          id?: string
          input_data?: Json | null
          module_name: string
          output_data?: Json | null
          rule_applied?: string | null
          status?: string
          step_number?: number
          user_id?: string
        }
        Update: {
          calculation_id?: string
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number
          formula_used?: string | null
          id?: string
          input_data?: Json | null
          module_name?: string
          output_data?: Json | null
          rule_applied?: string | null
          status?: string
          step_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_logs_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "case_calculations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_validations: {
        Row: {
          calculation_id: string
          created_at: string
          id: string
          message: string
          related_module: string | null
          resolved: boolean
          severity: string
          user_id: string
          validation_type: string
        }
        Insert: {
          calculation_id: string
          created_at?: string
          id?: string
          message: string
          related_module?: string | null
          resolved?: boolean
          severity?: string
          user_id?: string
          validation_type: string
        }
        Update: {
          calculation_id?: string
          created_at?: string
          id?: string
          message?: string
          related_module?: string | null
          resolved?: boolean
          severity?: string
          user_id?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_validations_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "case_calculations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculations: {
        Row: {
          created_at: string
          currency: string
          daily_rate: number
          day_overtime_amount: number
          day_overtime_hours: number
          employee_name: string
          employer_name: string
          eos_benefit: number
          hourly_rate: number
          id: string
          leave_compensation: number
          monthly_salary: number
          night_overtime_amount: number
          night_overtime_hours: number
          payload: Json | null
          serial_number: string | null
          service_end_date: string | null
          service_months: number
          service_start_date: string | null
          service_years: number
          total_due: number
          total_service_years: number
          unused_leave_days: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          daily_rate: number
          day_overtime_amount: number
          day_overtime_hours?: number
          employee_name: string
          employer_name: string
          eos_benefit: number
          hourly_rate: number
          id?: string
          leave_compensation: number
          monthly_salary: number
          night_overtime_amount: number
          night_overtime_hours?: number
          payload?: Json | null
          serial_number?: string | null
          service_end_date?: string | null
          service_months?: number
          service_start_date?: string | null
          service_years?: number
          total_due: number
          total_service_years: number
          unused_leave_days?: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          daily_rate?: number
          day_overtime_amount?: number
          day_overtime_hours?: number
          employee_name?: string
          employer_name?: string
          eos_benefit?: number
          hourly_rate?: number
          id?: string
          leave_compensation?: number
          monthly_salary?: number
          night_overtime_amount?: number
          night_overtime_hours?: number
          payload?: Json | null
          serial_number?: string | null
          service_end_date?: string | null
          service_months?: number
          service_start_date?: string | null
          service_years?: number
          total_due?: number
          total_service_years?: number
          unused_leave_days?: number
          user_id?: string
        }
        Relationships: []
      }
      case_annual_leave: {
        Row: {
          carried_forward_days: number
          case_id: string
          compensation_amount: number
          created_at: string
          currency: string
          daily_wage: number
          entitlement_days: number
          id: string
          legal_basis: string | null
          notes: string | null
          period_days: number
          period_end: string | null
          period_start: string | null
          remaining_days: number
          service_year: number
          sort_order: number
          updated_at: string
          used_days: number
          user_id: string
        }
        Insert: {
          carried_forward_days?: number
          case_id: string
          compensation_amount?: number
          created_at?: string
          currency?: string
          daily_wage?: number
          entitlement_days?: number
          id?: string
          legal_basis?: string | null
          notes?: string | null
          period_days?: number
          period_end?: string | null
          period_start?: string | null
          remaining_days?: number
          service_year: number
          sort_order?: number
          updated_at?: string
          used_days?: number
          user_id?: string
        }
        Update: {
          carried_forward_days?: number
          case_id?: string
          compensation_amount?: number
          created_at?: string
          currency?: string
          daily_wage?: number
          entitlement_days?: number
          id?: string
          legal_basis?: string | null
          notes?: string | null
          period_days?: number
          period_end?: string | null
          period_start?: string | null
          remaining_days?: number
          service_year?: number
          sort_order?: number
          updated_at?: string
          used_days?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_annual_leave_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_calculations: {
        Row: {
          blocked_reason: string | null
          calculated_by: string | null
          calculation_completed_at: string | null
          calculation_started_at: string | null
          calculation_status: string
          calculation_version: number
          case_id: string
          confidence_score: number
          conflicts: Json | null
          country: string
          created_at: string
          currency: string
          eligibility: Json | null
          engines: Json | null
          exceptions: Json | null
          final_claim_amount: number
          formulas: Json | null
          id: string
          notes: string | null
          results: Json | null
          rule_version: string | null
          snapshot: Json | null
          total_compensation: number
          total_excluded_rights: number
          total_gratuity: number
          total_insurance: number
          total_leave: number
          total_maternity: number
          total_other: number
          total_paid_rights: number
          total_rights: number
          total_salary: number
          total_sick_leave: number
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_reason?: string | null
          calculated_by?: string | null
          calculation_completed_at?: string | null
          calculation_started_at?: string | null
          calculation_status?: string
          calculation_version?: number
          case_id: string
          confidence_score?: number
          conflicts?: Json | null
          country?: string
          created_at?: string
          currency?: string
          eligibility?: Json | null
          engines?: Json | null
          exceptions?: Json | null
          final_claim_amount?: number
          formulas?: Json | null
          id?: string
          notes?: string | null
          results?: Json | null
          rule_version?: string | null
          snapshot?: Json | null
          total_compensation?: number
          total_excluded_rights?: number
          total_gratuity?: number
          total_insurance?: number
          total_leave?: number
          total_maternity?: number
          total_other?: number
          total_paid_rights?: number
          total_rights?: number
          total_salary?: number
          total_sick_leave?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          blocked_reason?: string | null
          calculated_by?: string | null
          calculation_completed_at?: string | null
          calculation_started_at?: string | null
          calculation_status?: string
          calculation_version?: number
          case_id?: string
          confidence_score?: number
          conflicts?: Json | null
          country?: string
          created_at?: string
          currency?: string
          eligibility?: Json | null
          engines?: Json | null
          exceptions?: Json | null
          final_claim_amount?: number
          formulas?: Json | null
          id?: string
          notes?: string | null
          results?: Json | null
          rule_version?: string | null
          snapshot?: Json | null
          total_compensation?: number
          total_excluded_rights?: number
          total_gratuity?: number
          total_insurance?: number
          total_leave?: number
          total_maternity?: number
          total_other?: number
          total_paid_rights?: number
          total_rights?: number
          total_salary?: number
          total_sick_leave?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      case_compensation: {
        Row: {
          agreement_amount: number | null
          agreement_conflicts_law: boolean
          agreement_method: string | null
          analysis: Json | null
          approved_wage: number
          base_compensation: number
          case_id: string
          claim_requested: string
          compensation_label: string | null
          compensation_type: string | null
          contract_type: string | null
          court_judgment_reference: string | null
          created_at: string
          excluded_from_claim: boolean
          final_compensation: number
          has_agreement_clause: boolean
          id: string
          legal_basis: string | null
          legal_reference: string | null
          legal_rule_version: string | null
          notes: string | null
          notice_actual_days: number | null
          notice_compensation: number
          notice_period_days: number | null
          notice_required: boolean
          notice_shortfall_days: number | null
          notice_status: string
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          proof_file: string | null
          remaining_amount: number
          remaining_contract_months: number | null
          service_years: number
          sort_order: number
          steps: Json
          termination_reason: string | null
          updated_at: string
          user_id: string
          warnings: Json
        }
        Insert: {
          agreement_amount?: number | null
          agreement_conflicts_law?: boolean
          agreement_method?: string | null
          analysis?: Json | null
          approved_wage?: number
          base_compensation?: number
          case_id: string
          claim_requested?: string
          compensation_label?: string | null
          compensation_type?: string | null
          contract_type?: string | null
          court_judgment_reference?: string | null
          created_at?: string
          excluded_from_claim?: boolean
          final_compensation?: number
          has_agreement_clause?: boolean
          id?: string
          legal_basis?: string | null
          legal_reference?: string | null
          legal_rule_version?: string | null
          notes?: string | null
          notice_actual_days?: number | null
          notice_compensation?: number
          notice_period_days?: number | null
          notice_required?: boolean
          notice_shortfall_days?: number | null
          notice_status?: string
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          remaining_amount?: number
          remaining_contract_months?: number | null
          service_years?: number
          sort_order?: number
          steps?: Json
          termination_reason?: string | null
          updated_at?: string
          user_id?: string
          warnings?: Json
        }
        Update: {
          agreement_amount?: number | null
          agreement_conflicts_law?: boolean
          agreement_method?: string | null
          analysis?: Json | null
          approved_wage?: number
          base_compensation?: number
          case_id?: string
          claim_requested?: string
          compensation_label?: string | null
          compensation_type?: string | null
          contract_type?: string | null
          court_judgment_reference?: string | null
          created_at?: string
          excluded_from_claim?: boolean
          final_compensation?: number
          has_agreement_clause?: boolean
          id?: string
          legal_basis?: string | null
          legal_reference?: string | null
          legal_rule_version?: string | null
          notes?: string | null
          notice_actual_days?: number | null
          notice_compensation?: number
          notice_period_days?: number | null
          notice_required?: boolean
          notice_shortfall_days?: number | null
          notice_status?: string
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          remaining_amount?: number
          remaining_contract_months?: number | null
          service_years?: number
          sort_order?: number
          steps?: Json
          termination_reason?: string | null
          updated_at?: string
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "case_compensation_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_contracts: {
        Row: {
          actual_end_date: string | null
          case_id: string
          contract_name: string | null
          contract_number: string
          contract_type: string
          created_at: string
          deleted_at: string | null
          end_date: string | null
          end_reason: string | null
          ended: boolean
          id: string
          is_qiwa_documented: boolean
          joining_date: string | null
          qiwa_contract_number: string | null
          renew_count: number
          renew_history: Json
          renewed: boolean
          sort_order: number
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_end_date?: string | null
          case_id: string
          contract_name?: string | null
          contract_number: string
          contract_type?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          end_reason?: string | null
          ended?: boolean
          id?: string
          is_qiwa_documented?: boolean
          joining_date?: string | null
          qiwa_contract_number?: string | null
          renew_count?: number
          renew_history?: Json
          renewed?: boolean
          sort_order?: number
          start_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_end_date?: string | null
          case_id?: string
          contract_name?: string | null
          contract_number?: string
          contract_type?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          end_reason?: string | null
          ended?: boolean
          id?: string
          is_qiwa_documented?: boolean
          joining_date?: string | null
          qiwa_contract_number?: string | null
          renew_count?: number
          renew_history?: Json
          renewed?: boolean
          sort_order?: number
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_contracts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_drafts: {
        Row: {
          country_code: string
          created_at: string
          current_step: number
          data: Json
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          current_step?: number
          data?: Json
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          current_step?: number
          data?: Json
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_drafts_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      case_eosb: {
        Row: {
          agreement_amount: number | null
          analysis: Json
          base_gratuity_amount: number
          case_id: string
          contract_type: string | null
          created_at: string
          eligibility_percentage: number
          eligible: boolean
          exceptions_notes: string | null
          final_gratuity_amount: number
          has_better_agreement: boolean
          has_court_ruling: boolean
          has_settlement: boolean
          id: string
          ineligibility_reason: string | null
          last_approved_wage: number
          legal_rule_version: string | null
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          proof_file: string | null
          remaining_amount: number
          service_end_date: string | null
          service_fraction_years: number
          service_start_date: string | null
          steps: Json
          termination_reason: string | null
          total_service_days: number
          total_service_months: number
          total_service_years: number
          updated_at: string
          user_id: string
          wage_breakdown: Json
          warnings: Json
        }
        Insert: {
          agreement_amount?: number | null
          analysis?: Json
          base_gratuity_amount?: number
          case_id: string
          contract_type?: string | null
          created_at?: string
          eligibility_percentage?: number
          eligible?: boolean
          exceptions_notes?: string | null
          final_gratuity_amount?: number
          has_better_agreement?: boolean
          has_court_ruling?: boolean
          has_settlement?: boolean
          id?: string
          ineligibility_reason?: string | null
          last_approved_wage?: number
          legal_rule_version?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          remaining_amount?: number
          service_end_date?: string | null
          service_fraction_years?: number
          service_start_date?: string | null
          steps?: Json
          termination_reason?: string | null
          total_service_days?: number
          total_service_months?: number
          total_service_years?: number
          updated_at?: string
          user_id?: string
          wage_breakdown?: Json
          warnings?: Json
        }
        Update: {
          agreement_amount?: number | null
          analysis?: Json
          base_gratuity_amount?: number
          case_id?: string
          contract_type?: string | null
          created_at?: string
          eligibility_percentage?: number
          eligible?: boolean
          exceptions_notes?: string | null
          final_gratuity_amount?: number
          has_better_agreement?: boolean
          has_court_ruling?: boolean
          has_settlement?: boolean
          id?: string
          ineligibility_reason?: string | null
          last_approved_wage?: number
          legal_rule_version?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          remaining_amount?: number
          service_end_date?: string | null
          service_fraction_years?: number
          service_start_date?: string | null
          steps?: Json
          termination_reason?: string | null
          total_service_days?: number
          total_service_months?: number
          total_service_years?: number
          updated_at?: string
          user_id?: string
          wage_breakdown?: Json
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "case_eosb_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_final_reports: {
        Row: {
          archived: boolean
          archived_at: string | null
          calculation_id: string | null
          calculation_version: number | null
          case_id: string
          confidence_score: number
          country: string
          created_at: string
          currency: string
          digital_signature_hash: string | null
          document: Json | null
          file_docx: string | null
          file_html: string | null
          file_json: string | null
          file_pdf: string | null
          file_xlsx: string | null
          final_balance: number
          generated_at: string
          generated_by: string | null
          id: string
          notes: string | null
          options: Json | null
          qr_code_hash: string | null
          report_language: string
          report_number: string
          report_type: string
          rule_version: string | null
          share_token: string | null
          system_version: string | null
          total_excluded: number
          total_paid: number
          total_rights: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          calculation_id?: string | null
          calculation_version?: number | null
          case_id: string
          confidence_score?: number
          country?: string
          created_at?: string
          currency?: string
          digital_signature_hash?: string | null
          document?: Json | null
          file_docx?: string | null
          file_html?: string | null
          file_json?: string | null
          file_pdf?: string | null
          file_xlsx?: string | null
          final_balance?: number
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          options?: Json | null
          qr_code_hash?: string | null
          report_language?: string
          report_number: string
          report_type?: string
          rule_version?: string | null
          share_token?: string | null
          system_version?: string | null
          total_excluded?: number
          total_paid?: number
          total_rights?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          calculation_id?: string | null
          calculation_version?: number | null
          case_id?: string
          confidence_score?: number
          country?: string
          created_at?: string
          currency?: string
          digital_signature_hash?: string | null
          document?: Json | null
          file_docx?: string | null
          file_html?: string | null
          file_json?: string | null
          file_pdf?: string | null
          file_xlsx?: string | null
          final_balance?: number
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          options?: Json | null
          qr_code_hash?: string | null
          report_language?: string
          report_number?: string
          report_type?: string
          rule_version?: string | null
          share_token?: string | null
          system_version?: string | null
          total_excluded?: number
          total_paid?: number
          total_rights?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_final_reports_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "case_calculations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_final_settlement: {
        Row: {
          ai_analysis: Json | null
          ai_analysis_status: string | null
          analysis: Json | null
          approved: boolean
          approved_at: string | null
          case_id: string
          court_ruling_after: boolean
          court_ruling_reference: string | null
          covers_all_rights: boolean
          created_at: string
          currency: string
          digital_signature_date: string | null
          digital_signature_provider: string | null
          digital_signature_reference: string | null
          digital_signature_type: string | null
          has_settlement: string
          id: string
          legal_analysis: Json | null
          legal_analysis_status: string | null
          legal_rule_version: string | null
          mentioned_rights: Json | null
          notes: string | null
          settlement_date: string | null
          settlement_file: string | null
          settlement_file_type: string | null
          settlement_language: string | null
          settlement_number: string | null
          settlement_type: string | null
          signature_status: string | null
          signing_date: string | null
          signing_place: string | null
          sort_order: number
          total_settlement_amount: number | null
          under_dispute: boolean
          updated_at: string
          user_id: string
          waived_rights: Json | null
          warnings: Json | null
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analysis_status?: string | null
          analysis?: Json | null
          approved?: boolean
          approved_at?: string | null
          case_id: string
          court_ruling_after?: boolean
          court_ruling_reference?: string | null
          covers_all_rights?: boolean
          created_at?: string
          currency?: string
          digital_signature_date?: string | null
          digital_signature_provider?: string | null
          digital_signature_reference?: string | null
          digital_signature_type?: string | null
          has_settlement?: string
          id?: string
          legal_analysis?: Json | null
          legal_analysis_status?: string | null
          legal_rule_version?: string | null
          mentioned_rights?: Json | null
          notes?: string | null
          settlement_date?: string | null
          settlement_file?: string | null
          settlement_file_type?: string | null
          settlement_language?: string | null
          settlement_number?: string | null
          settlement_type?: string | null
          signature_status?: string | null
          signing_date?: string | null
          signing_place?: string | null
          sort_order?: number
          total_settlement_amount?: number | null
          under_dispute?: boolean
          updated_at?: string
          user_id?: string
          waived_rights?: Json | null
          warnings?: Json | null
        }
        Update: {
          ai_analysis?: Json | null
          ai_analysis_status?: string | null
          analysis?: Json | null
          approved?: boolean
          approved_at?: string | null
          case_id?: string
          court_ruling_after?: boolean
          court_ruling_reference?: string | null
          covers_all_rights?: boolean
          created_at?: string
          currency?: string
          digital_signature_date?: string | null
          digital_signature_provider?: string | null
          digital_signature_reference?: string | null
          digital_signature_type?: string | null
          has_settlement?: string
          id?: string
          legal_analysis?: Json | null
          legal_analysis_status?: string | null
          legal_rule_version?: string | null
          mentioned_rights?: Json | null
          notes?: string | null
          settlement_date?: string | null
          settlement_file?: string | null
          settlement_file_type?: string | null
          settlement_language?: string | null
          settlement_number?: string | null
          settlement_type?: string | null
          signature_status?: string | null
          signing_date?: string | null
          signing_place?: string | null
          sort_order?: number
          total_settlement_amount?: number | null
          under_dispute?: boolean
          updated_at?: string
          user_id?: string
          waived_rights?: Json | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "case_final_settlement_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_holiday_work: {
        Row: {
          amount: number
          case_id: string
          compensated: boolean
          created_at: string
          days: number
          end_date: string | null
          holiday_date: string | null
          holiday_name: string | null
          hours: number
          id: string
          notes: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id: string
          compensated?: boolean
          created_at?: string
          days?: number
          end_date?: string | null
          holiday_date?: string | null
          holiday_name?: string | null
          hours?: number
          id?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          case_id?: string
          compensated?: boolean
          created_at?: string
          days?: number
          end_date?: string | null
          holiday_date?: string | null
          holiday_name?: string | null
          hours?: number
          id?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_holiday_work_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_leave_carryover: {
        Row: {
          case_id: string
          created_at: string
          days: number
          from_year: number | null
          id: string
          is_legal: boolean
          notes: string | null
          proof_file: string | null
          reason: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          days?: number
          from_year?: number | null
          id?: string
          is_legal?: boolean
          notes?: string | null
          proof_file?: string | null
          reason?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          days?: number
          from_year?: number | null
          id?: string
          is_legal?: boolean
          notes?: string | null
          proof_file?: string | null
          reason?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_leave_carryover_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_leave_settlement: {
        Row: {
          analysis: Json
          case_id: string
          compensation_amount: number
          created_at: string
          currency: string
          daily_wage: number
          has_carryover: boolean
          has_leave_claim: boolean
          id: string
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          proof_file: string | null
          proof_type: string | null
          remaining_amount: number
          still_employed: boolean
          updated_at: string
          user_id: string
          wage_basis: string
          wage_changed: boolean
        }
        Insert: {
          analysis?: Json
          case_id: string
          compensation_amount?: number
          created_at?: string
          currency?: string
          daily_wage?: number
          has_carryover?: boolean
          has_leave_claim?: boolean
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          proof_type?: string | null
          remaining_amount?: number
          still_employed?: boolean
          updated_at?: string
          user_id?: string
          wage_basis?: string
          wage_changed?: boolean
        }
        Update: {
          analysis?: Json
          case_id?: string
          compensation_amount?: number
          created_at?: string
          currency?: string
          daily_wage?: number
          has_carryover?: boolean
          has_leave_claim?: boolean
          id?: string
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          proof_type?: string | null
          remaining_amount?: number
          still_employed?: boolean
          updated_at?: string
          user_id?: string
          wage_basis?: string
          wage_changed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_leave_settlement_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_leave_taken: {
        Row: {
          case_id: string
          created_at: string
          days: number
          end_date: string | null
          id: string
          leave_type: string
          notes: string | null
          service_year: number | null
          sort_order: number
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          days?: number
          end_date?: string | null
          id?: string
          leave_type?: string
          notes?: string | null
          service_year?: number | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          days?: number
          end_date?: string | null
          id?: string
          leave_type?: string
          notes?: string | null
          service_year?: number | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_leave_taken_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_maternity_leaves: {
        Row: {
          applied_rule: Json
          case_id: string
          compensation_amount: number
          compensation_rate: number
          contract_id: string | null
          created_at: string
          currency: string
          daily_wage: number
          delivery_date: string | null
          extended: boolean
          extension_days: number
          extension_reason: string | null
          has_document: boolean
          id: string
          leave_days: number
          leave_end: string | null
          leave_start: string | null
          medical_report_file: string | null
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_proof_file: string | null
          payment_status: string
          pregnancy_start_date: string | null
          remaining_amount: number
          return_to_work_date: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_rule?: Json
          case_id: string
          compensation_amount?: number
          compensation_rate?: number
          contract_id?: string | null
          created_at?: string
          currency?: string
          daily_wage?: number
          delivery_date?: string | null
          extended?: boolean
          extension_days?: number
          extension_reason?: string | null
          has_document?: boolean
          id?: string
          leave_days?: number
          leave_end?: string | null
          leave_start?: string | null
          medical_report_file?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_proof_file?: string | null
          payment_status?: string
          pregnancy_start_date?: string | null
          remaining_amount?: number
          return_to_work_date?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          applied_rule?: Json
          case_id?: string
          compensation_amount?: number
          compensation_rate?: number
          contract_id?: string | null
          created_at?: string
          currency?: string
          daily_wage?: number
          delivery_date?: string | null
          extended?: boolean
          extension_days?: number
          extension_reason?: string | null
          has_document?: boolean
          id?: string
          leave_days?: number
          leave_end?: string | null
          leave_start?: string | null
          medical_report_file?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_proof_file?: string | null
          payment_status?: string
          pregnancy_start_date?: string | null
          remaining_amount?: number
          return_to_work_date?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_maternity_leaves_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_maternity_summary: {
        Row: {
          actual_delivery_date: string | null
          analysis: Json
          case_id: string
          created_at: string
          currency: string
          daily_wage: number
          delivery_date: string | null
          delivery_type: string | null
          early_delivery: boolean
          ended_during_protection: boolean
          excluded_amount: number
          gender: string
          had_pregnancy: boolean
          has_medical_document: boolean
          id: string
          is_nursing: boolean
          medical_complications: boolean
          medical_document_type: string | null
          medical_report_file: string | null
          multiple_birth: string | null
          newborn_deceased: boolean
          notes: string | null
          pregnancy_start_date: string | null
          remaining_amount: number
          returned_to_work: boolean
          termination_date: string | null
          termination_party: string | null
          termination_proof_file: string | null
          termination_reason: string | null
          total_due: number
          total_paid: number
          updated_at: string
          user_id: string
          wage_basis: string
          wage_changed: boolean
        }
        Insert: {
          actual_delivery_date?: string | null
          analysis?: Json
          case_id: string
          created_at?: string
          currency?: string
          daily_wage?: number
          delivery_date?: string | null
          delivery_type?: string | null
          early_delivery?: boolean
          ended_during_protection?: boolean
          excluded_amount?: number
          gender?: string
          had_pregnancy?: boolean
          has_medical_document?: boolean
          id?: string
          is_nursing?: boolean
          medical_complications?: boolean
          medical_document_type?: string | null
          medical_report_file?: string | null
          multiple_birth?: string | null
          newborn_deceased?: boolean
          notes?: string | null
          pregnancy_start_date?: string | null
          remaining_amount?: number
          returned_to_work?: boolean
          termination_date?: string | null
          termination_party?: string | null
          termination_proof_file?: string | null
          termination_reason?: string | null
          total_due?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
          wage_basis?: string
          wage_changed?: boolean
        }
        Update: {
          actual_delivery_date?: string | null
          analysis?: Json
          case_id?: string
          created_at?: string
          currency?: string
          daily_wage?: number
          delivery_date?: string | null
          delivery_type?: string | null
          early_delivery?: boolean
          ended_during_protection?: boolean
          excluded_amount?: number
          gender?: string
          had_pregnancy?: boolean
          has_medical_document?: boolean
          id?: string
          is_nursing?: boolean
          medical_complications?: boolean
          medical_document_type?: string | null
          medical_report_file?: string | null
          multiple_birth?: string | null
          newborn_deceased?: boolean
          notes?: string | null
          pregnancy_start_date?: string | null
          remaining_amount?: number
          returned_to_work?: boolean
          termination_date?: string | null
          termination_party?: string | null
          termination_proof_file?: string | null
          termination_reason?: string | null
          total_due?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
          wage_basis?: string
          wage_changed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_maternity_summary_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_nursing_hours: {
        Row: {
          applied_rule: Json
          case_id: string
          created_at: string
          daily_reduction_hours: number
          daily_working_hours: number
          delivery_date: string | null
          id: string
          notes: string | null
          nursing_end_date: string | null
          nursing_start_date: string | null
          paid: boolean
          return_to_work_date: string | null
          sort_order: number
          total_eligible_days: number
          total_reduction_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_rule?: Json
          case_id: string
          created_at?: string
          daily_reduction_hours?: number
          daily_working_hours?: number
          delivery_date?: string | null
          id?: string
          notes?: string | null
          nursing_end_date?: string | null
          nursing_start_date?: string | null
          paid?: boolean
          return_to_work_date?: string | null
          sort_order?: number
          total_eligible_days?: number
          total_reduction_hours?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          applied_rule?: Json
          case_id?: string
          created_at?: string
          daily_reduction_hours?: number
          daily_working_hours?: number
          delivery_date?: string | null
          id?: string
          notes?: string | null
          nursing_end_date?: string | null
          nursing_start_date?: string | null
          paid?: boolean
          return_to_work_date?: string | null
          sort_order?: number
          total_eligible_days?: number
          total_reduction_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_nursing_hours_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_overtime: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          end_date: string | null
          hours: number
          id: string
          notes: string | null
          period_label: string | null
          reason: string | null
          sort_order: number
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id: string
          created_at?: string
          end_date?: string | null
          hours?: number
          id?: string
          notes?: string | null
          period_label?: string | null
          reason?: string | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          end_date?: string | null
          hours?: number
          id?: string
          notes?: string | null
          period_label?: string | null
          reason?: string | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_overtime_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_report_sections: {
        Row: {
          generated_at: string
          id: string
          included: boolean
          report_id: string
          section_key: string
          section_name: string
          section_order: number
          user_id: string
          visibility: string
        }
        Insert: {
          generated_at?: string
          id?: string
          included?: boolean
          report_id: string
          section_key: string
          section_name: string
          section_order?: number
          user_id?: string
          visibility?: string
        }
        Update: {
          generated_at?: string
          id?: string
          included?: boolean
          report_id?: string
          section_key?: string
          section_name?: string
          section_order?: number
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_report_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "case_final_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      case_salaries: {
        Row: {
          actual_salary: number
          basic_salary: number
          case_id: string
          communication_allowance: number
          created_at: string
          currency: string
          daily_salary: number
          delegation_allowance: number
          fixed_bonus: number
          fixed_commission: number
          hourly_salary: number
          housing_allowance: number
          id: string
          other_allowances: number
          other_benefits: number
          risk_allowance: number
          transport_allowance: number
          updated_at: string
          user_id: string
          work_nature_allowance: number
        }
        Insert: {
          actual_salary?: number
          basic_salary?: number
          case_id: string
          communication_allowance?: number
          created_at?: string
          currency?: string
          daily_salary?: number
          delegation_allowance?: number
          fixed_bonus?: number
          fixed_commission?: number
          hourly_salary?: number
          housing_allowance?: number
          id?: string
          other_allowances?: number
          other_benefits?: number
          risk_allowance?: number
          transport_allowance?: number
          updated_at?: string
          user_id?: string
          work_nature_allowance?: number
        }
        Update: {
          actual_salary?: number
          basic_salary?: number
          case_id?: string
          communication_allowance?: number
          created_at?: string
          currency?: string
          daily_salary?: number
          delegation_allowance?: number
          fixed_bonus?: number
          fixed_commission?: number
          hourly_salary?: number
          housing_allowance?: number
          id?: string
          other_allowances?: number
          other_benefits?: number
          risk_allowance?: number
          transport_allowance?: number
          updated_at?: string
          user_id?: string
          work_nature_allowance?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_salaries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_settlement_payments: {
        Row: {
          amount_due: number
          amount_paid: number
          case_id: string
          converted_amount: number | null
          created_at: string
          currency: string
          exchange_rate: number | null
          id: string
          match_status: string
          mentioned_in_settlement: boolean
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          proof_file: string | null
          related_module: string | null
          remaining_amount: number
          right_label: string | null
          right_type: string
          settlement_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          case_id: string
          converted_amount?: number | null
          created_at?: string
          currency?: string
          exchange_rate?: number | null
          id?: string
          match_status?: string
          mentioned_in_settlement?: boolean
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          proof_file?: string | null
          related_module?: string | null
          remaining_amount?: number
          right_label?: string | null
          right_type: string
          settlement_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          case_id?: string
          converted_amount?: number | null
          created_at?: string
          currency?: string
          exchange_rate?: number | null
          id?: string
          match_status?: string
          mentioned_in_settlement?: boolean
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          proof_file?: string | null
          related_module?: string | null
          remaining_amount?: number
          right_label?: string | null
          right_type?: string
          settlement_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_settlement_payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_settlement_payments_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "case_final_settlement"
            referencedColumns: ["id"]
          },
        ]
      }
      case_sick_leave_summary: {
        Row: {
          analysis: Json
          case_id: string
          created_at: string
          currency: string
          daily_wage: number
          ended_during_sick_leave: boolean
          excluded_amount: number
          has_sick_leave: boolean
          id: string
          leaves_count: number
          notes: string | null
          remaining_amount: number
          total_days: number
          total_due: number
          total_paid: number
          updated_at: string
          user_id: string
          wage_basis: string
          wage_changed: boolean
        }
        Insert: {
          analysis?: Json
          case_id: string
          created_at?: string
          currency?: string
          daily_wage?: number
          ended_during_sick_leave?: boolean
          excluded_amount?: number
          has_sick_leave?: boolean
          id?: string
          leaves_count?: number
          notes?: string | null
          remaining_amount?: number
          total_days?: number
          total_due?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
          wage_basis?: string
          wage_changed?: boolean
        }
        Update: {
          analysis?: Json
          case_id?: string
          created_at?: string
          currency?: string
          daily_wage?: number
          ended_during_sick_leave?: boolean
          excluded_amount?: number
          has_sick_leave?: boolean
          id?: string
          leaves_count?: number
          notes?: string | null
          remaining_amount?: number
          total_days?: number
          total_due?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
          wage_basis?: string
          wage_changed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "case_sick_leave_summary_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_sick_leaves: {
        Row: {
          case_id: string
          compensation_amount: number
          compensation_rate: number
          contract_id: string | null
          created_at: string
          currency: string
          daily_wage: number
          end_date: string | null
          has_medical_report: boolean
          id: string
          illness_reason: string | null
          leave_kind: string
          medical_provider: string | null
          medical_report_file: string | null
          medical_report_number: string | null
          medical_report_type: string | null
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          proof_file: string | null
          proof_type: string | null
          remaining_amount: number
          sort_order: number
          stages: Json
          start_date: string | null
          total_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          compensation_amount?: number
          compensation_rate?: number
          contract_id?: string | null
          created_at?: string
          currency?: string
          daily_wage?: number
          end_date?: string | null
          has_medical_report?: boolean
          id?: string
          illness_reason?: string | null
          leave_kind?: string
          medical_provider?: string | null
          medical_report_file?: string | null
          medical_report_number?: string | null
          medical_report_type?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          proof_type?: string | null
          remaining_amount?: number
          sort_order?: number
          stages?: Json
          start_date?: string | null
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          case_id?: string
          compensation_amount?: number
          compensation_rate?: number
          contract_id?: string | null
          created_at?: string
          currency?: string
          daily_wage?: number
          end_date?: string | null
          has_medical_report?: boolean
          id?: string
          illness_reason?: string | null
          leave_kind?: string
          medical_provider?: string | null
          medical_report_file?: string | null
          medical_report_number?: string | null
          medical_report_type?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          proof_type?: string | null
          remaining_amount?: number
          sort_order?: number
          stages?: Json
          start_date?: string | null
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_sick_leaves_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_sick_leaves_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "case_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_social_insurance: {
        Row: {
          analysis: Json
          applied_rule: Json
          case_id: string
          coverage_end_date: string | null
          coverage_start_date: string | null
          created_at: string
          currency: string
          employee_contribution_amount: number
          employee_contribution_rate: number
          employer_contribution_amount: number
          employer_contribution_rate: number
          employment_category: string
          exemption_reason: string | null
          id: string
          insurable_wage: number
          is_subject: string
          nationality_category: string
          notes: string | null
          payment_date: string | null
          payment_proof_file: string | null
          payment_reference: string | null
          payment_status: string
          registration_date: string | null
          registration_number: string | null
          registration_status: string
          remaining_amount: number
          sector: string
          total_contribution: number
          total_difference: number
          total_due: number
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          applied_rule?: Json
          case_id: string
          coverage_end_date?: string | null
          coverage_start_date?: string | null
          created_at?: string
          currency?: string
          employee_contribution_amount?: number
          employee_contribution_rate?: number
          employer_contribution_amount?: number
          employer_contribution_rate?: number
          employment_category?: string
          exemption_reason?: string | null
          id?: string
          insurable_wage?: number
          is_subject?: string
          nationality_category?: string
          notes?: string | null
          payment_date?: string | null
          payment_proof_file?: string | null
          payment_reference?: string | null
          payment_status?: string
          registration_date?: string | null
          registration_number?: string | null
          registration_status?: string
          remaining_amount?: number
          sector?: string
          total_contribution?: number
          total_difference?: number
          total_due?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          analysis?: Json
          applied_rule?: Json
          case_id?: string
          coverage_end_date?: string | null
          coverage_start_date?: string | null
          created_at?: string
          currency?: string
          employee_contribution_amount?: number
          employee_contribution_rate?: number
          employer_contribution_amount?: number
          employer_contribution_rate?: number
          employment_category?: string
          exemption_reason?: string | null
          id?: string
          insurable_wage?: number
          is_subject?: string
          nationality_category?: string
          notes?: string | null
          payment_date?: string | null
          payment_proof_file?: string | null
          payment_reference?: string | null
          payment_status?: string
          registration_date?: string | null
          registration_number?: string | null
          registration_status?: string
          remaining_amount?: number
          sector?: string
          total_contribution?: number
          total_difference?: number
          total_due?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_social_insurance_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_social_insurance_monthly: {
        Row: {
          actual_wage: number
          case_id: string
          contribution_month: number
          contribution_year: number
          created_at: string
          currency: string
          difference_amount: number
          employee_contribution: number
          employee_rate: number
          employer_contribution: number
          employer_rate: number
          id: string
          insurable_wage: number
          insurance_id: string | null
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_entity: string | null
          payment_proof_file: string | null
          payment_proof_type: string | null
          payment_reference: string | null
          payment_status: string
          period_key: string
          registered_wage: number
          registration_state: string
          remaining_amount: number
          sort_order: number
          total_contribution: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_wage?: number
          case_id: string
          contribution_month?: number
          contribution_year?: number
          created_at?: string
          currency?: string
          difference_amount?: number
          employee_contribution?: number
          employee_rate?: number
          employer_contribution?: number
          employer_rate?: number
          id?: string
          insurable_wage?: number
          insurance_id?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_entity?: string | null
          payment_proof_file?: string | null
          payment_proof_type?: string | null
          payment_reference?: string | null
          payment_status?: string
          period_key?: string
          registered_wage?: number
          registration_state?: string
          remaining_amount?: number
          sort_order?: number
          total_contribution?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_wage?: number
          case_id?: string
          contribution_month?: number
          contribution_year?: number
          created_at?: string
          currency?: string
          difference_amount?: number
          employee_contribution?: number
          employee_rate?: number
          employer_contribution?: number
          employer_rate?: number
          id?: string
          insurable_wage?: number
          insurance_id?: string | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_entity?: string | null
          payment_proof_file?: string | null
          payment_proof_type?: string | null
          payment_reference?: string | null
          payment_status?: string
          period_key?: string
          registered_wage?: number
          registration_state?: string
          remaining_amount?: number
          sort_order?: number
          total_contribution?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_social_insurance_monthly_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_social_insurance_monthly_insurance_id_fkey"
            columns: ["insurance_id"]
            isOneToOne: false
            referencedRelation: "case_social_insurance"
            referencedColumns: ["id"]
          },
        ]
      }
      case_termination: {
        Row: {
          analysis: Json
          applied_rule: Json
          case_id: string
          created_at: string
          effective_termination_date: string | null
          employment_status: string
          has_document: boolean
          id: string
          incident_date: string | null
          incident_description: string | null
          initiated_by: string | null
          last_working_day: string | null
          legal_analysis_status: string | null
          legal_warnings: Json
          notes: string | null
          notice_date: string | null
          notice_given: boolean
          notice_method: string | null
          notice_period_days: number | null
          reason_details: string | null
          termination_category: string | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          applied_rule?: Json
          case_id: string
          created_at?: string
          effective_termination_date?: string | null
          employment_status?: string
          has_document?: boolean
          id?: string
          incident_date?: string | null
          incident_description?: string | null
          initiated_by?: string | null
          last_working_day?: string | null
          legal_analysis_status?: string | null
          legal_warnings?: Json
          notes?: string | null
          notice_date?: string | null
          notice_given?: boolean
          notice_method?: string | null
          notice_period_days?: number | null
          reason_details?: string | null
          termination_category?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          analysis?: Json
          applied_rule?: Json
          case_id?: string
          created_at?: string
          effective_termination_date?: string | null
          employment_status?: string
          has_document?: boolean
          id?: string
          incident_date?: string | null
          incident_description?: string | null
          initiated_by?: string | null
          last_working_day?: string | null
          legal_analysis_status?: string | null
          legal_warnings?: Json
          notes?: string | null
          notice_date?: string | null
          notice_given?: boolean
          notice_method?: string | null
          notice_period_days?: number | null
          reason_details?: string | null
          termination_category?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_termination_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_termination_documents: {
        Row: {
          case_id: string
          created_at: string
          doc_date: string | null
          doc_type: string
          file_path: string | null
          id: string
          issuer: string | null
          notes: string | null
          sort_order: number
          termination_id: string | null
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          doc_date?: string | null
          doc_type?: string
          file_path?: string | null
          id?: string
          issuer?: string | null
          notes?: string | null
          sort_order?: number
          termination_id?: string | null
          user_id?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          doc_date?: string | null
          doc_type?: string
          file_path?: string | null
          id?: string
          issuer?: string | null
          notes?: string | null
          sort_order?: number
          termination_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_termination_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_termination_documents_termination_id_fkey"
            columns: ["termination_id"]
            isOneToOne: false
            referencedRelation: "case_termination"
            referencedColumns: ["id"]
          },
        ]
      }
      case_unpaid_salaries: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          month: number | null
          notes: string | null
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          proof_file: string | null
          proof_type: string | null
          remaining_amount: number
          salary_type: string
          sort_order: number
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          amount?: number
          case_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          month?: number | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          proof_type?: string | null
          remaining_amount?: number
          salary_type?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          month?: number | null
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          proof_file?: string | null
          proof_type?: string | null
          remaining_amount?: number
          salary_type?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_unpaid_salaries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_weekend_work: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          days: number
          end_date: string | null
          hours: number
          id: string
          notes: string | null
          sort_order: number
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          case_id: string
          created_at?: string
          days?: number
          end_date?: string | null
          hours?: number
          id?: string
          notes?: string | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          days?: number
          end_date?: string | null
          hours?: number
          id?: string
          notes?: string | null
          sort_order?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_weekend_work_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_working_hours: {
        Row: {
          analysis: Json
          attendance_system: boolean
          case_id: string
          created_at: string
          daily_hours: number
          fingerprint_system: boolean
          has_holiday_work: boolean
          has_overtime: boolean
          has_weekend_work: boolean
          id: string
          overtime_entry_mode: string
          overtime_total_hours: number
          shift_type: string
          updated_at: string
          user_id: string
          weekly_days: number
        }
        Insert: {
          analysis?: Json
          attendance_system?: boolean
          case_id: string
          created_at?: string
          daily_hours?: number
          fingerprint_system?: boolean
          has_holiday_work?: boolean
          has_overtime?: boolean
          has_weekend_work?: boolean
          id?: string
          overtime_entry_mode?: string
          overtime_total_hours?: number
          shift_type?: string
          updated_at?: string
          user_id?: string
          weekly_days?: number
        }
        Update: {
          analysis?: Json
          attendance_system?: boolean
          case_id?: string
          created_at?: string
          daily_hours?: number
          fingerprint_system?: boolean
          has_holiday_work?: boolean
          has_overtime?: boolean
          has_weekend_work?: boolean
          id?: string
          overtime_entry_mode?: string
          overtime_total_hours?: number
          shift_type?: string
          updated_at?: string
          user_id?: string
          weekly_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_working_hours_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_trial_periods: {
        Row: {
          case_id: string
          contract_id: string
          created_at: string
          ended_during_trial: boolean
          extension_duration_days: number | null
          extension_end_date: string | null
          extension_reason: string | null
          extension_start_date: string | null
          has_trial_period: boolean
          id: string
          is_extended: boolean
          re_trial_analysis: Json
          termination_right: string | null
          trial_duration_days: number | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
          user_id: string
          who_terminated: string | null
        }
        Insert: {
          case_id: string
          contract_id: string
          created_at?: string
          ended_during_trial?: boolean
          extension_duration_days?: number | null
          extension_end_date?: string | null
          extension_reason?: string | null
          extension_start_date?: string | null
          has_trial_period?: boolean
          id?: string
          is_extended?: boolean
          re_trial_analysis?: Json
          termination_right?: string | null
          trial_duration_days?: number | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
          who_terminated?: string | null
        }
        Update: {
          case_id?: string
          contract_id?: string
          created_at?: string
          ended_during_trial?: boolean
          extension_duration_days?: number | null
          extension_end_date?: string | null
          extension_reason?: string | null
          extension_start_date?: string | null
          has_trial_period?: boolean
          id?: string
          is_extended?: boolean
          re_trial_analysis?: Json
          termination_right?: string | null
          trial_duration_days?: number | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
          user_id?: string
          who_terminated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_trial_periods_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_trial_periods_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "case_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          calculator_path: string
          code: string
          created_at: string
          currency: string
          description_ar: string | null
          description_en: string | null
          employment_law_name: string | null
          engine: string
          flag: string
          is_active: boolean
          language: string | null
          legislator: string | null
          name_ar: string
          name_en: string
          social_insurance_law: string | null
          sort_order: number
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          calculator_path?: string
          code: string
          created_at?: string
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          employment_law_name?: string | null
          engine?: string
          flag?: string
          is_active?: boolean
          language?: string | null
          legislator?: string | null
          name_ar: string
          name_en: string
          social_insurance_law?: string | null
          sort_order?: number
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          calculator_path?: string
          code?: string
          created_at?: string
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          employment_law_name?: string | null
          engine?: string
          flag?: string
          is_active?: boolean
          language?: string | null
          legislator?: string | null
          name_ar?: string
          name_en?: string
          social_insurance_law?: string | null
          sort_order?: number
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          custom_clauses: string | null
          employee_name: string | null
          employer_name: string | null
          id: string
          monthly_salary: number | null
          seq: number
          serial_number: string
          service_end_date: string | null
          service_months: number | null
          service_start_date: string | null
          service_years: number | null
          total_amount: number
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_clauses?: string | null
          employee_name?: string | null
          employer_name?: string | null
          id?: string
          monthly_salary?: number | null
          seq: number
          serial_number: string
          service_end_date?: string | null
          service_months?: number | null
          service_start_date?: string | null
          service_years?: number | null
          total_amount: number
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_clauses?: string | null
          employee_name?: string | null
          employer_name?: string | null
          id?: string
          monthly_salary?: number | null
          seq?: number
          serial_number?: string
          service_end_date?: string | null
          service_months?: number | null
          service_start_date?: string | null
          service_years?: number | null
          total_amount?: number
          year?: number
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          country_code: string | null
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          id: string
          organization_id: string | null
          plan_code: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          organization_id?: string | null
          plan_code?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          organization_id?: string | null
          plan_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      free_trial_usage: {
        Row: {
          email: string | null
          first_used_at: string
          id: string
          last_used_at: string
          mobile_number: string
          used_count: number
          user_id: string | null
        }
        Insert: {
          email?: string | null
          first_used_at?: string
          id?: string
          last_used_at?: string
          mobile_number: string
          used_count?: number
          user_id?: string | null
        }
        Update: {
          email?: string | null
          first_used_at?: string
          id?: string
          last_used_at?: string
          mobile_number?: string
          used_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      ip_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ip_value: string
          is_active: boolean
          note: string | null
          rule_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_value: string
          is_active?: boolean
          note?: string | null
          rule_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ip_value?: string
          is_active?: boolean
          note?: string | null
          rule_type?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          body: string
          category_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          body?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          body?: string
          category_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      lawyer_documents: {
        Row: {
          created_at: string
          file_url: string
          id: string
          kind: string
          lawyer_id: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          kind: string
          lawyer_id: string
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          kind?: string
          lawyer_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_documents_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lawyer_documents_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          is_hidden: boolean
          lawyer_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          lawyer_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          lawyer_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_reviews_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lawyer_reviews_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyers: {
        Row: {
          avg_rating: number
          bio: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          governorate: string
          id: string
          is_active: boolean
          office_name: string | null
          phone: string | null
          photo_url: string | null
          reviews_count: number
          slug: string
          specializations: string[] | null
          updated_at: string
          user_id: string | null
          verification_status: string
          whatsapp: string | null
          years_experience: number | null
        }
        Insert: {
          avg_rating?: number
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          governorate: string
          id?: string
          is_active?: boolean
          office_name?: string | null
          phone?: string | null
          photo_url?: string | null
          reviews_count?: number
          slug: string
          specializations?: string[] | null
          updated_at?: string
          user_id?: string | null
          verification_status?: string
          whatsapp?: string | null
          years_experience?: number | null
        }
        Update: {
          avg_rating?: number
          bio?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          governorate?: string
          id?: string
          is_active?: boolean
          office_name?: string | null
          phone?: string | null
          photo_url?: string | null
          reviews_count?: number
          slug?: string
          specializations?: string[] | null
          updated_at?: string
          user_id?: string | null
          verification_status?: string
          whatsapp?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      legal_articles: {
        Row: {
          article_number: string
          article_text: string
          article_title: string
          country_code: string
          created_at: string
          created_by: string | null
          effective_date: string
          expiry_date: string | null
          id: string
          interpretation: string | null
          source_url: string | null
          status: string
          system_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          article_number: string
          article_text: string
          article_title: string
          country_code: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          expiry_date?: string | null
          id?: string
          interpretation?: string | null
          source_url?: string | null
          status?: string
          system_id?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          article_number?: string
          article_text?: string
          article_title?: string
          country_code?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          expiry_date?: string | null
          id?: string
          interpretation?: string | null
          source_url?: string | null
          status?: string
          system_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_articles_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "legal_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_content: {
        Row: {
          archived: boolean
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          key: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      legal_references: {
        Row: {
          approval_status: string
          approved_by: string | null
          article_number: string
          created_at: string
          id: string
          last_review_date: string | null
          sort_order: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          article_number: string
          created_at?: string
          id?: string
          last_review_date?: string | null
          sort_order?: number
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          article_number?: string
          created_at?: string
          id?: string
          last_review_date?: string | null
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_rule_versions: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          rule_key: string
          status: string
          title: string | null
          updated_at: string
          value: Json
          version: string
        }
        Insert: {
          country_code: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          rule_key: string
          status?: string
          title?: string | null
          updated_at?: string
          value?: Json
          version: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          rule_key?: string
          status?: string
          title?: string | null
          updated_at?: string
          value?: Json
          version?: string
        }
        Relationships: []
      }
      legal_rules: {
        Row: {
          article_id: string | null
          claim_type: string | null
          contract_type: string | null
          country_code: string
          created_at: string
          created_by: string | null
          description: string | null
          effective_date: string
          expiry_date: string | null
          formula_id: string | null
          id: string
          priority: number
          published_at: string | null
          rule_code: string
          rule_name: string
          rule_type: string
          scheduled_at: string | null
          sector: string | null
          specificity: number
          status: string
          supersedes_id: string | null
          system_id: string | null
          updated_at: string
          value: Json
          version: string
          worker_type: string | null
        }
        Insert: {
          article_id?: string | null
          claim_type?: string | null
          contract_type?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date?: string
          expiry_date?: string | null
          formula_id?: string | null
          id?: string
          priority?: number
          published_at?: string | null
          rule_code: string
          rule_name: string
          rule_type?: string
          scheduled_at?: string | null
          sector?: string | null
          specificity?: number
          status?: string
          supersedes_id?: string | null
          system_id?: string | null
          updated_at?: string
          value?: Json
          version?: string
          worker_type?: string | null
        }
        Update: {
          article_id?: string | null
          claim_type?: string | null
          contract_type?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date?: string
          expiry_date?: string | null
          formula_id?: string | null
          id?: string
          priority?: number
          published_at?: string | null
          rule_code?: string
          rule_name?: string
          rule_type?: string
          scheduled_at?: string | null
          sector?: string | null
          specificity?: number
          status?: string
          supersedes_id?: string | null
          system_id?: string | null
          updated_at?: string
          value?: Json
          version?: string
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_rules_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "legal_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_rules_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "rule_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_rules_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "legal_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_rules_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "legal_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_systems: {
        Row: {
          authority: string | null
          country_code: string
          created_at: string
          created_by: string | null
          effective_date: string
          expiry_date: string | null
          id: string
          notes: string | null
          status: string
          system_code: string
          system_name: string
          system_type: string
          updated_at: string
          version: string
        }
        Insert: {
          authority?: string | null
          country_code: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          system_code: string
          system_name: string
          system_type?: string
          updated_at?: string
          version?: string
        }
        Update: {
          authority?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          system_code?: string
          system_name?: string
          system_type?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      notification_dispatches: {
        Row: {
          audience: string
          body: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string | null
          target: string | null
        }
        Insert: {
          audience?: string
          body: string
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          target?: string | null
        }
        Update: {
          audience?: string
          body?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          target?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json
          read: boolean
          read_at: string | null
          read_by: string | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          read?: boolean
          read_at?: string | null
          read_by?: string | null
          severity?: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          read?: boolean
          read_at?: string | null
          read_by?: string | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          country_code: string | null
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          language: string | null
          legal_name: string | null
          name: string
          settings: Json
          timezone: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          legal_name?: string | null
          name: string
          settings?: Json
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          legal_name?: string | null
          name?: string
          settings?: Json
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          account_holder: string | null
          account_number: string | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          code: string
          config: Json
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          kind: string
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          config?: Json
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          kind?: string
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          config?: Json
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          kind?: string
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          created_at: string
          disclaimer: string | null
          footer: string | null
          id: string
          is_active: boolean
          name: string
          signature_block: string | null
          updated_at: string
          verification_statement: string | null
          watermark: string | null
        }
        Insert: {
          created_at?: string
          disclaimer?: string | null
          footer?: string | null
          id?: string
          is_active?: boolean
          name?: string
          signature_block?: string | null
          updated_at?: string
          verification_statement?: string | null
          watermark?: string | null
        }
        Update: {
          created_at?: string
          disclaimer?: string | null
          footer?: string | null
          id?: string
          is_active?: boolean
          name?: string
          signature_block?: string | null
          updated_at?: string
          verification_statement?: string | null
          watermark?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          calculator_access_mode: string
          default_clauses: string | null
          enable_info_currency_conversion: boolean
          id: number
          logo_url: string | null
          platform_name: string
          report_footer: string | null
          updated_at: string
        }
        Insert: {
          calculator_access_mode?: string
          default_clauses?: string | null
          enable_info_currency_conversion?: boolean
          id?: number
          logo_url?: string | null
          platform_name?: string
          report_footer?: string | null
          updated_at?: string
        }
        Update: {
          calculator_access_mode?: string
          default_clauses?: string | null
          enable_info_currency_conversion?: boolean
          id?: number
          logo_url?: string | null
          platform_name?: string
          report_footer?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string
          created_at: string
          email: string
          free_trial_used: boolean
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          mobile_number: string | null
          must_change_password: boolean
          theme_preference: string | null
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          email?: string
          free_trial_used?: boolean
          full_name?: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          theme_preference?: string | null
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          email?: string
          free_trial_used?: boolean
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          mobile_number?: string | null
          must_change_password?: boolean
          theme_preference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          reward_chosen_at: string | null
          reward_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          reward_chosen_at?: string | null
          reward_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          reward_chosen_at?: string | null
          reward_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          free_days: number | null
          id: string
          kind: string
          notes: string | null
          referral_id: string | null
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          free_days?: number | null
          id?: string
          kind: string
          notes?: string | null
          referral_id?: string | null
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          free_days?: number | null
          id?: string
          kind?: string
          notes?: string | null
          referral_id?: string | null
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          allow_user_change_reward: boolean
          commission_percent: number
          credit_per_referral_sar: number
          credit_per_referral_yer: number
          discount_percent: number
          free_tier_1_count: number
          free_tier_1_days: number
          free_tier_2_count: number
          free_tier_2_days: number
          free_tier_3_count: number
          free_tier_3_days: number
          id: number
          is_active: boolean
          min_withdraw_sar: number
          min_withdraw_yer: number
          updated_at: string
        }
        Insert: {
          allow_user_change_reward?: boolean
          commission_percent?: number
          credit_per_referral_sar?: number
          credit_per_referral_yer?: number
          discount_percent?: number
          free_tier_1_count?: number
          free_tier_1_days?: number
          free_tier_2_count?: number
          free_tier_2_days?: number
          free_tier_3_count?: number
          free_tier_3_days?: number
          id?: number
          is_active?: boolean
          min_withdraw_sar?: number
          min_withdraw_yer?: number
          updated_at?: string
        }
        Update: {
          allow_user_change_reward?: boolean
          commission_percent?: number
          credit_per_referral_sar?: number
          credit_per_referral_yer?: number
          discount_percent?: number
          free_tier_1_count?: number
          free_tier_1_days?: number
          free_tier_2_count?: number
          free_tier_2_days?: number
          free_tier_3_count?: number
          free_tier_3_days?: number
          id?: number
          is_active?: boolean
          min_withdraw_sar?: number
          min_withdraw_yer?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_withdrawals: {
        Row: {
          account_details: string | null
          admin_notes: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          method: string | null
          paid_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_details?: string | null
          admin_notes?: string | null
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_details?: string | null
          admin_notes?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          paid_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code_id: string
          converted_at: string | null
          created_at: string
          currency: string | null
          discount_amount: number | null
          id: string
          order_amount: number | null
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          code_id: string
          converted_at?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number | null
          id?: string
          order_amount?: number | null
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          code_id?: string
          converted_at?: string | null
          created_at?: string
          currency?: string | null
          discount_amount?: number | null
          id?: string
          order_amount?: number | null
          referred_user_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          notes: string | null
          reviewer_id: string | null
          rule_id: string
          stage: string
          stage_order: number
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          rule_id: string
          stage: string
          stage_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          reviewer_id?: string | null
          rule_id?: string
          stage?: string
          stage_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_approvals_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "legal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_audit_log: {
        Row: {
          action: string
          approved_by: string | null
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          id: string
          new_version: string | null
          old_version: string | null
          rule_code: string | null
          rule_id: string | null
          snapshot: Json | null
        }
        Insert: {
          action: string
          approved_by?: string | null
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_version?: string | null
          old_version?: string | null
          rule_code?: string | null
          rule_id?: string | null
          snapshot?: Json | null
        }
        Update: {
          action?: string
          approved_by?: string | null
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_version?: string | null
          old_version?: string | null
          rule_code?: string | null
          rule_id?: string | null
          snapshot?: Json | null
        }
        Relationships: []
      }
      rule_conditions: {
        Row: {
          condition_expression: Json
          created_at: string
          description: string | null
          execution_order: number
          id: string
          logic_operator: string
          rule_id: string
        }
        Insert: {
          condition_expression?: Json
          created_at?: string
          description?: string | null
          execution_order?: number
          id?: string
          logic_operator?: string
          rule_id: string
        }
        Update: {
          condition_expression?: Json
          created_at?: string
          description?: string | null
          execution_order?: number
          id?: string
          logic_operator?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_conditions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "legal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_exceptions: {
        Row: {
          applies_to: Json
          article_id: string | null
          category: string
          country_code: string
          created_at: string
          description: string | null
          effect: Json
          exception_code: string
          exception_name: string
          id: string
          priority: number
          rule_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applies_to?: Json
          article_id?: string | null
          category?: string
          country_code: string
          created_at?: string
          description?: string | null
          effect?: Json
          exception_code: string
          exception_name: string
          id?: string
          priority?: number
          rule_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applies_to?: Json
          article_id?: string | null
          category?: string
          country_code?: string
          created_at?: string
          description?: string | null
          effect?: Json
          exception_code?: string
          exception_name?: string
          id?: string
          priority?: number
          rule_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_exceptions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "legal_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_exceptions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "legal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_formulas: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          formula_code: string
          formula_expression: string
          formula_name: string
          id: string
          return_type: string
          status: string
          updated_at: string
          variables: Json
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          formula_code: string
          formula_expression: string
          formula_name: string
          id?: string
          return_type?: string
          status?: string
          updated_at?: string
          variables?: Json
          version?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          formula_code?: string
          formula_expression?: string
          formula_name?: string
          id?: string
          return_type?: string
          status?: string
          updated_at?: string
          variables?: Json
          version?: string
        }
        Relationships: []
      }
      sa_case_audit: {
        Row: {
          case_id: string | null
          created_at: string
          data: Json
          decision: string
          id: string
          reason: string | null
          step: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          data?: Json
          decision: string
          id?: string
          reason?: string | null
          step: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          data?: Json
          decision?: string
          id?: string
          reason?: string | null
          step?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sa_case_audit_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "sa_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      sa_cases: {
        Row: {
          archived: boolean
          assigned_lawyer_id: string | null
          branch_id: string | null
          contract_type: string | null
          created_at: string
          currency: string
          employee_name: string | null
          employer_name: string | null
          end_date: string | null
          id: string
          input: Json
          job_title: string | null
          merged_into: string | null
          national_id: string | null
          nationality: string | null
          organization_id: string | null
          plan_code: string | null
          result: Json
          sector: string | null
          start_date: string | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          assigned_lawyer_id?: string | null
          branch_id?: string | null
          contract_type?: string | null
          created_at?: string
          currency?: string
          employee_name?: string | null
          employer_name?: string | null
          end_date?: string | null
          id?: string
          input?: Json
          job_title?: string | null
          merged_into?: string | null
          national_id?: string | null
          nationality?: string | null
          organization_id?: string | null
          plan_code?: string | null
          result?: Json
          sector?: string | null
          start_date?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          assigned_lawyer_id?: string | null
          branch_id?: string | null
          contract_type?: string | null
          created_at?: string
          currency?: string
          employee_name?: string | null
          employer_name?: string | null
          end_date?: string | null
          id?: string
          input?: Json
          job_title?: string | null
          merged_into?: string | null
          national_id?: string | null
          nationality?: string | null
          organization_id?: string | null
          plan_code?: string | null
          result?: Json
          sector?: string | null
          start_date?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sa_cases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sa_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sa_contract_rules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rule: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rule?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rule?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sa_official_holidays: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          kind: string
          name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      sa_regulatory_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sa_reports: {
        Row: {
          archived: boolean
          case_id: string | null
          checksum: string
          created_at: string
          currency: string
          deductions_total: number
          document: Json
          downloads: number
          employee_label: string | null
          employer_label: string | null
          gross_total: number
          id: string
          net_total: number
          plan_code: string
          report_number: string
          user_id: string
          version: number
        }
        Insert: {
          archived?: boolean
          case_id?: string | null
          checksum: string
          created_at?: string
          currency?: string
          deductions_total?: number
          document: Json
          downloads?: number
          employee_label?: string | null
          employer_label?: string | null
          gross_total?: number
          id?: string
          net_total?: number
          plan_code: string
          report_number: string
          user_id: string
          version?: number
        }
        Update: {
          archived?: boolean
          case_id?: string | null
          checksum?: string
          created_at?: string
          currency?: string
          deductions_total?: number
          document?: Json
          downloads?: number
          employee_label?: string | null
          employer_label?: string | null
          gross_total?: number
          id?: string
          net_total?: number
          plan_code?: string
          report_number?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sa_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "sa_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          ip_address: string | null
          message: string
          metadata: Json
          resolved: boolean
          resolved_at: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          message: string
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          message?: string
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          code: string
          country: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          period: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          country: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          period: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          country?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          period?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          admin_notes: string | null
          amount: number | null
          created_at: string
          currency: string
          discount_amount: number | null
          full_name: string | null
          id: string
          mobile_number: string | null
          payment_method_id: string | null
          plan_id: string | null
          receipt_url: string | null
          referral_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_reference: string | null
          updated_at: string
          user_id: string
          wallet_used: number
        }
        Insert: {
          admin_notes?: string | null
          amount?: number | null
          created_at?: string
          currency?: string
          discount_amount?: number | null
          full_name?: string | null
          id?: string
          mobile_number?: string | null
          payment_method_id?: string | null
          plan_id?: string | null
          receipt_url?: string | null
          referral_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_reference?: string | null
          updated_at?: string
          user_id: string
          wallet_used?: number
        }
        Update: {
          admin_notes?: string | null
          amount?: number | null
          created_at?: string
          currency?: string
          discount_amount?: number | null
          full_name?: string | null
          id?: string
          mobile_number?: string | null
          payment_method_id?: string | null
          plan_id?: string | null
          receipt_url?: string | null
          referral_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_reference?: string | null
          updated_at?: string
          user_id?: string
          wallet_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          activated_by: string | null
          created_at: string
          expires_at: string
          id: string
          notes: string | null
          plan_id: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          plan_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          data_type: string
          is_encrypted: boolean
          label: string | null
          module: string | null
          setting_key: string
          setting_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data_type?: string
          is_encrypted?: boolean
          label?: string | null
          module?: string | null
          setting_key: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data_type?: string
          is_encrypted?: boolean
          label?: string | null
          module?: string | null
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      unpaid_salary_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json
          read: boolean
          read_at: string | null
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          read?: boolean
          read_at?: string | null
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          read?: boolean
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wallet_balances: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          kind: string
          notes: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          kind: string
          notes?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          notes?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          last_delivery_at: string | null
          last_status: number | null
          name: string
          secret_hint: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          last_status?: number | null
          name: string
          secret_hint?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          last_status?: number | null
          name?: string
          secret_hint?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      lawyers_public: {
        Row: {
          avg_rating: number | null
          bio: string | null
          city: string | null
          created_at: string | null
          full_name: string | null
          governorate: string | null
          id: string | null
          is_active: boolean | null
          office_name: string | null
          photo_url: string | null
          reviews_count: number | null
          slug: string | null
          specializations: string[] | null
          verification_status: string | null
          years_experience: number | null
        }
        Insert: {
          avg_rating?: number | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          governorate?: string | null
          id?: string | null
          is_active?: boolean | null
          office_name?: string | null
          photo_url?: string | null
          reviews_count?: number | null
          slug?: string | null
          specializations?: string[] | null
          verification_status?: string | null
          years_experience?: number | null
        }
        Update: {
          avg_rating?: number | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          governorate?: string | null
          id?: string | null
          is_active?: boolean | null
          office_name?: string | null
          photo_url?: string | null
          reviews_count?: number | null
          slug?: string | null
          specializations?: string[] | null
          verification_status?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      payment_methods_public: {
        Row: {
          created_at: string | null
          id: string | null
          instructions: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          instructions?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          instructions?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_adjust_reward: {
        Args: {
          _amount?: number
          _notes?: string
          _reward_id: string
          _status?: string
        }
        Returns: boolean
      }
      admin_assign_admin_role: {
        Args: { _grant: boolean; _role_id: string; _user_id: string }
        Returns: boolean
      }
      admin_has_permission: { Args: { _code: string }; Returns: boolean }
      admin_lawyer_contacts: {
        Args: never
        Returns: {
          email: string
          id: string
          phone: string
          whatsapp: string
        }[]
      }
      admin_list_users: {
        Args: { _search?: string }
        Returns: {
          admin_roles: string[]
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string
          mobile_number: string
          roles: string[]
        }[]
      }
      admin_mark_reward_paid: {
        Args: { _notes?: string; _reward_id: string }
        Returns: boolean
      }
      admin_referral_overview: {
        Args: never
        Returns: {
          code: string
          code_id: string
          commission_pending: number
          converted_count: number
          email: string
          full_name: string
          is_active: boolean
          reward_type: string
          total_discounts: number
          total_sales: number
          user_id: string
          uses_count: number
          wallet_sar: number
          wallet_yer: number
        }[]
      }
      admin_reset_user_roles: { Args: { _user_id: string }; Returns: boolean }
      admin_review_withdrawal: {
        Args: { _id: string; _notes?: string; _status: string }
        Returns: boolean
      }
      admin_role_matrix: {
        Args: never
        Returns: {
          description: string
          permission_codes: string[]
          role_code: string
          role_id: string
          role_name: string
          system_role: boolean
        }[]
      }
      admin_set_reward_type: {
        Args: { _type: string; _user_id: string }
        Returns: boolean
      }
      admin_set_role_permission: {
        Args: { _grant: boolean; _permission_code: string; _role_id: string }
        Returns: boolean
      }
      admin_set_user_active: {
        Args: { _active: boolean; _user_id: string }
        Returns: boolean
      }
      admin_set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      admin_toggle_referral_code: {
        Args: { _active: boolean; _code_id: string }
        Returns: boolean
      }
      admin_withdrawals: {
        Args: never
        Returns: {
          account_details: string
          admin_notes: string
          amount: number
          created_at: string
          currency: string
          email: string
          full_name: string
          id: string
          method: string
          paid_at: string
          status: string
          user_id: string
        }[]
      }
      approve_subscription_request: {
        Args: { _notes?: string; _request_id: string }
        Returns: string
      }
      attach_referral_code: { Args: { _code: string }; Returns: boolean }
      check_referral_code: {
        Args: { _code: string }
        Returns: {
          discount_percent: number
          valid: boolean
        }[]
      }
      clear_must_change_password: { Args: never; Returns: boolean }
      consume_calc_credit: { Args: never; Returns: boolean }
      consume_free_trial: { Args: never; Returns: boolean }
      create_subscription_request: {
        Args: {
          _full_name?: string
          _mobile_number?: string
          _notes?: string
          _payment_method_id?: string
          _plan_id: string
          _receipt_url?: string
          _transfer_reference?: string
          _use_wallet?: boolean
        }
        Returns: {
          amount: number
          currency: string
          discount_amount: number
          request_id: string
          wallet_used: number
        }[]
      }
      expire_due_subscriptions: { Args: never; Returns: number }
      gen_referral_code: { Args: never; Returns: string }
      get_access_status: {
        Args: never
        Returns: {
          expires_at: string
          is_subscribed: boolean
          trial_limit: number
          trial_used: number
        }[]
      }
      get_lawyer_contact: {
        Args: { _lawyer_id: string }
        Returns: {
          email: string
          phone: string
          whatsapp: string
        }[]
      }
      get_my_country: { Args: never; Returns: string }
      get_my_plans: {
        Args: never
        Returns: {
          code: string
          currency: string
          description: string
          duration_days: number
          id: string
          name: string
          period: string
          price: number
          sort_order: number
        }[]
      }
      get_my_referral_code: {
        Args: never
        Returns: {
          code: string
          is_active: boolean
          reward_chosen_at: string
          reward_type: string
        }[]
      }
      get_my_referral_stats: {
        Args: never
        Returns: {
          allow_change: boolean
          code: string
          commission_paid: number
          commission_pending: number
          converted_count: number
          discount_percent: number
          free_rewards_count: number
          is_active: boolean
          reward_chosen_at: string
          reward_type: string
          total_discounts: number
          total_sales: number
          uses_count: number
          wallet_sar: number
          wallet_yer: number
        }[]
      }
      get_my_wallet_summary: {
        Args: never
        Returns: {
          balance: number
          currency: string
          min_withdraw: number
          pending_withdraw: number
          spent: number
          withdrawn: number
        }[]
      }
      get_platform_entitlements: {
        Args: never
        Returns: {
          allow_pdf: boolean
          auto_renew: boolean
          credits_remaining: number
          engines: string[]
          expires_at: string
          plan_code: string
          show_details: boolean
          show_legal_refs: boolean
          status: string
        }[]
      }
      grant_referral_reward: {
        Args: { _amount: number; _currency: string; _referred_user: string }
        Returns: undefined
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      must_change_password: { Args: never; Returns: boolean }
      my_admin_permissions: { Args: never; Returns: string[] }
      new_rule_version: {
        Args: { _reason?: string; _rule_id: string; _version: string }
        Returns: string
      }
      notify_user: {
        Args: {
          _link?: string
          _message: string
          _severity?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      publish_legal_rule: {
        Args: { _reason?: string; _rule_id: string; _scheduled?: string }
        Returns: boolean
      }
      register_document:
        | {
            Args: {
              p_custom_clauses?: string
              p_employee_name: string
              p_employer_name: string
              p_monthly_salary: number
              p_service_months: number
              p_service_years: number
              p_total_amount: number
            }
            Returns: {
              created_at: string
              serial_number: string
            }[]
          }
        | {
            Args: {
              p_currency?: string
              p_custom_clauses?: string
              p_employee_name: string
              p_employer_name: string
              p_monthly_salary: number
              p_service_end_date?: string
              p_service_months: number
              p_service_start_date?: string
              p_service_years: number
              p_total_amount: number
            }
            Returns: {
              created_at: string
              serial_number: string
            }[]
          }
      request_withdrawal: {
        Args: {
          _account_details?: string
          _amount: number
          _currency: string
          _method?: string
        }
        Returns: string
      }
      resolve_legal_rule: {
        Args: {
          _as_of?: string
          _contract_type?: string
          _country: string
          _rule_code: string
          _sector?: string
          _worker_type?: string
        }
        Returns: {
          article_id: string | null
          claim_type: string | null
          contract_type: string | null
          country_code: string
          created_at: string
          created_by: string | null
          description: string | null
          effective_date: string
          expiry_date: string | null
          formula_id: string | null
          id: string
          priority: number
          published_at: string | null
          rule_code: string
          rule_name: string
          rule_type: string
          scheduled_at: string | null
          sector: string | null
          specificity: number
          status: string
          supersedes_id: string | null
          system_id: string | null
          updated_at: string
          value: Json
          version: string
          worker_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "legal_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reverse_referral_reward: {
        Args: { _reason?: string; _referred_user: string }
        Returns: undefined
      }
      rollback_legal_rule: {
        Args: { _reason?: string; _rule_id: string }
        Returns: boolean
      }
      set_my_country: { Args: { _country: string }; Returns: string }
      set_my_reward_type: { Args: { _type: string }; Returns: boolean }
      spend_wallet_credit: {
        Args: { _amount: number; _currency: string; _notes?: string }
        Returns: number
      }
      sync_admin_role_for_email: {
        Args: { _email: string }
        Returns: undefined
      }
      unpublish_legal_rule: {
        Args: { _reason?: string; _rule_id: string }
        Returns: boolean
      }
      upsert_case_draft: {
        Args: { _country_code: string; _data: Json; _step: number }
        Returns: string
      }
      verify_document: {
        Args: { p_serial: string }
        Returns: {
          created_at: string
          currency: string
          serial_number: string
          service_end_date: string
          service_start_date: string
          total_amount: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "lawyer"
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
      app_role: ["admin", "user", "lawyer"],
    },
  },
} as const
