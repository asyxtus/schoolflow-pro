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
      applicants: {
        Row: {
          class_applied_for: string | null
          created_at: string
          date_of_birth: string | null
          decided_at: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          notes: string | null
          prior_school: string | null
          reference_no: string | null
          school_id: string
          score: number | null
          stage: Database["public"]["Enums"]["admission_stage"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          class_applied_for?: string | null
          created_at?: string
          date_of_birth?: string | null
          decided_at?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          notes?: string | null
          prior_school?: string | null
          reference_no?: string | null
          school_id: string
          score?: number | null
          stage?: Database["public"]["Enums"]["admission_stage"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          class_applied_for?: string | null
          created_at?: string
          date_of_birth?: string | null
          decided_at?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          prior_school?: string | null
          reference_no?: string | null
          school_id?: string
          score?: number | null
          stage?: Database["public"]["Enums"]["admission_stage"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          school_id: string | null
          summary: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          school_id?: string | null
          summary?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          school_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_meta: {
        Row: {
          absences_justified: number | null
          absences_unjustified: number | null
          conduct: string | null
          created_at: string
          head_teacher_remark: string | null
          id: string
          principal_remark: string | null
          school_id: string
          sequence: number
          student_id: string
          updated_at: string
        }
        Insert: {
          absences_justified?: number | null
          absences_unjustified?: number | null
          conduct?: string | null
          created_at?: string
          head_teacher_remark?: string | null
          id?: string
          principal_remark?: string | null
          school_id: string
          sequence: number
          student_id: string
          updated_at?: string
        }
        Update: {
          absences_justified?: number | null
          absences_unjustified?: number | null
          conduct?: string | null
          created_at?: string
          head_teacher_remark?: string | null
          id?: string
          principal_remark?: string | null
          school_id?: string
          sequence?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_meta_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_meta_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year: string | null
          amount_fcfa: number
          class_name: string
          created_at: string
          id: string
          label: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          amount_fcfa: number
          class_name: string
          created_at?: string
          id?: string
          label: string
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          amount_fcfa?: number
          class_name?: string
          created_at?: string
          id?: string
          label?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          ca_score: number | null
          created_at: string
          exam_score: number | null
          id: string
          remark: string | null
          school_id: string
          sequence: number
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          ca_score?: number | null
          created_at?: string
          exam_score?: number | null
          id?: string
          remark?: string | null
          school_id: string
          sequence: number
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          ca_score?: number | null
          created_at?: string
          exam_score?: number | null
          id?: string
          remark?: string | null
          school_id?: string
          sequence?: number
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          occupation: string | null
          phone: string | null
          relationship: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          occupation?: string | null
          phone?: string | null
          relationship?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          occupation?: string | null
          phone?: string | null
          relationship?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audience: Database["public"]["Enums"]["message_audience"]
          audience_class: string | null
          body: string
          created_at: string
          id: string
          school_id: string
          sender_id: string | null
          subject: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["message_audience"]
          audience_class?: string | null
          body: string
          created_at?: string
          id?: string
          school_id: string
          sender_id?: string | null
          subject: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["message_audience"]
          audience_class?: string | null
          body?: string
          created_at?: string
          id?: string
          school_id?: string
          sender_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_fcfa: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          receipt_no: string | null
          recorded_by: string | null
          reference: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount_fcfa: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          receipt_no?: string | null
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          amount_fcfa?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          receipt_no?: string | null
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          code: string
          created_at: string
          id: string
          logo_url: string | null
          motto: string | null
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          created_at?: string
          id?: string
          logo_url?: string | null
          motto?: string | null
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          motto?: string | null
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          academic_year: string | null
          amount_fcfa: number
          created_at: string
          created_by: string | null
          discount_fcfa: number
          due_date: string | null
          fee_structure_id: string | null
          id: string
          label: string
          note: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          amount_fcfa: number
          created_at?: string
          created_by?: string | null
          discount_fcfa?: number
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          label: string
          note?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          amount_fcfa?: number
          created_at?: string
          created_by?: string | null
          discount_fcfa?: number
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          label?: string
          note?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          attendance_rate: number
          class_name: string | null
          created_at: string
          date_of_birth: string | null
          enrolment_date: string
          fee_balance: number
          first_name: string
          gender: Database["public"]["Enums"]["gender"] | null
          guardian_email: string | null
          guardian_phone: string | null
          id: string
          last_name: string
          matricule: string
          notes: string | null
          photo_url: string | null
          school_id: string
          section: string | null
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
        }
        Insert: {
          attendance_rate?: number
          class_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrolment_date?: string
          fee_balance?: number
          first_name: string
          gender?: Database["public"]["Enums"]["gender"] | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          last_name: string
          matricule: string
          notes?: string | null
          photo_url?: string | null
          school_id: string
          section?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Update: {
          attendance_rate?: number
          class_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrolment_date?: string
          fee_balance?: number
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          guardian_email?: string | null
          guardian_phone?: string | null
          id?: string
          last_name?: string
          matricule?: string
          notes?: string | null
          photo_url?: string | null
          school_id?: string
          section?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_coefficients: {
        Row: {
          class_name: string
          coefficient: number
          created_at: string
          id: string
          school_id: string
          subject: string
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          class_name: string
          coefficient?: number
          created_at?: string
          id?: string
          school_id: string
          subject: string
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          class_name?: string
          coefficient?: number
          created_at?: string
          id?: string
          school_id?: string
          subject?: string
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_coefficients_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_name: string
          created_at: string
          day_of_week: number
          id: string
          period: number
          room: string | null
          school_id: string
          subject: string
          teacher: string | null
          updated_at: string
        }
        Insert: {
          class_name: string
          created_at?: string
          day_of_week: number
          id?: string
          period: number
          room?: string | null
          school_id: string
          subject: string
          teacher?: string | null
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          day_of_week?: number
          id?: string
          period?: number
          room?: string | null
          school_id?: string
          subject?: string
          teacher?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_school_data: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      current_user_school_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_school: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _school_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_of_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _entity_id: string
          _entity_type: string
          _school_id: string
          _summary: string
        }
        Returns: string
      }
      recompute_student_balance: {
        Args: { _student_id: string }
        Returns: undefined
      }
    }
    Enums: {
      admission_stage:
        | "new"
        | "review"
        | "interview"
        | "offer"
        | "enrolled"
        | "rejected"
      app_role:
        | "super_admin"
        | "diocese_admin"
        | "principal"
        | "vice_principal"
        | "bursar"
        | "teacher"
        | "secretary"
        | "parent"
        | "student"
      attendance_status: "present" | "absent" | "late" | "excused"
      gender: "male" | "female"
      message_audience: "all" | "class" | "staff" | "guardians"
      payment_method: "cash" | "momo" | "bank" | "cheque" | "other"
      student_status:
        | "active"
        | "inactive"
        | "graduated"
        | "withdrawn"
        | "suspended"
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
      admission_stage: [
        "new",
        "review",
        "interview",
        "offer",
        "enrolled",
        "rejected",
      ],
      app_role: [
        "super_admin",
        "diocese_admin",
        "principal",
        "vice_principal",
        "bursar",
        "teacher",
        "secretary",
        "parent",
        "student",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      gender: ["male", "female"],
      message_audience: ["all", "class", "staff", "guardians"],
      payment_method: ["cash", "momo", "bank", "cheque", "other"],
      student_status: [
        "active",
        "inactive",
        "graduated",
        "withdrawn",
        "suspended",
      ],
    },
  },
} as const
