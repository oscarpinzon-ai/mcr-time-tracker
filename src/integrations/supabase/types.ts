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
      admin_edits_log: {
        Row: {
          edited_at: string
          edited_by: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          time_entry_id: string
        }
        Insert: {
          edited_at?: string
          edited_by: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          time_entry_id: string
        }
        Update: {
          edited_at?: string
          edited_by?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_edits_log_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          hcp_employee_id: string | null
          id: string
          is_active: boolean
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          hcp_employee_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          role?: string
        }
        Update: {
          created_at?: string
          hcp_employee_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string
        }
        Relationships: []
      }
      hcp_jobs_cache: {
        Row: {
          assigned_employee_ids: string[] | null
          customer_name: string | null
          hcp_job_id: string
          id: string
          job_address: string | null
          job_number: string
          job_type: string | null
          last_synced_at: string
          raw_data: Json | null
          scheduled_date: string | null
          status: string | null
        }
        Insert: {
          assigned_employee_ids?: string[] | null
          customer_name?: string | null
          hcp_job_id: string
          id?: string
          job_address?: string | null
          job_number: string
          job_type?: string | null
          last_synced_at?: string
          raw_data?: Json | null
          scheduled_date?: string | null
          status?: string | null
        }
        Update: {
          assigned_employee_ids?: string[] | null
          customer_name?: string | null
          hcp_job_id?: string
          id?: string
          job_address?: string | null
          job_number?: string
          job_type?: string | null
          last_synced_at?: string
          raw_data?: Json | null
          scheduled_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      pause_logs: {
        Row: {
          id: string
          pause_end: string | null
          pause_start: string
          time_entry_id: string
        }
        Insert: {
          id?: string
          pause_end?: string | null
          pause_start: string
          time_entry_id: string
        }
        Update: {
          id?: string
          pause_end?: string | null
          pause_start?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pause_logs_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          customer_name: string | null
          employee_id: string
          hcp_job_id: string | null
          id: string
          job_address: string | null
          job_number: string
          job_type: string | null
          status: string
          total_minutes: number | null
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          customer_name?: string | null
          employee_id: string
          hcp_job_id?: string | null
          id?: string
          job_address?: string | null
          job_number: string
          job_type?: string | null
          status?: string
          total_minutes?: number | null
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          customer_name?: string | null
          employee_id?: string
          hcp_job_id?: string | null
          id?: string
          job_address?: string | null
          job_number?: string
          job_type?: string | null
          status?: string
          total_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
