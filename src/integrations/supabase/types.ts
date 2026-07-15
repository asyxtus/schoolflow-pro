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
      boarding_assignments: {
        Row: {
          active: boolean
          assigned_on: string
          bed_number: string | null
          created_at: string
          dormitory_id: string
          id: string
          released_on: string | null
          room_id: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_on?: string
          bed_number?: string | null
          created_at?: string
          dormitory_id: string
          id?: string
          released_on?: string | null
          room_id?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_on?: string
          bed_number?: string | null
          created_at?: string
          dormitory_id?: string
          id?: string
          released_on?: string | null
          room_id?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boarding_assignments_dormitory_id_fkey"
            columns: ["dormitory_id"]
            isOneToOne: false
            referencedRelation: "dormitories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "dorm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      boarding_exeats: {
        Row: {
          actual_return_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          depart_at: string
          destination: string | null
          guardian_approval_note: string | null
          guardian_approved: boolean
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          notes: string | null
          reason: string
          return_by: string
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          actual_return_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          depart_at: string
          destination?: string | null
          guardian_approval_note?: string | null
          guardian_approved?: boolean
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          notes?: string | null
          reason: string
          return_by: string
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          actual_return_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          depart_at?: string
          destination?: string | null
          guardian_approval_note?: string | null
          guardian_approved?: boolean
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          notes?: string | null
          reason?: string
          return_by?: string
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boarding_exeats_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_exeats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_exeats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_exeats_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      boarding_roll_call: {
        Row: {
          created_at: string
          dormitory_id: string
          id: string
          note: string | null
          recorded_by: string | null
          roll_date: string
          school_id: string
          session: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          dormitory_id: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          roll_date?: string
          school_id: string
          session?: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          dormitory_id?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          roll_date?: string
          school_id?: string
          session?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boarding_roll_call_dormitory_id_fkey"
            columns: ["dormitory_id"]
            isOneToOne: false
            referencedRelation: "dormitories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_roll_call_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_roll_call_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_roll_call_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      boarding_visitors: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          created_at: string
          id: string
          id_document: string | null
          purpose: string | null
          recorded_by: string | null
          relationship: string | null
          school_id: string
          student_id: string | null
          visitor_name: string
          visitor_phone: string | null
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          id?: string
          id_document?: string | null
          purpose?: string | null
          recorded_by?: string | null
          relationship?: string | null
          school_id: string
          student_id?: string | null
          visitor_name: string
          visitor_phone?: string | null
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          id?: string
          id_document?: string | null
          purpose?: string | null
          recorded_by?: string | null
          relationship?: string | null
          school_id?: string
          student_id?: string | null
          visitor_name?: string
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boarding_visitors_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_visitors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boarding_visitors_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      dorm_rooms: {
        Row: {
          capacity: number
          created_at: string
          dormitory_id: string
          id: string
          notes: string | null
          room_number: string
          school_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          dormitory_id: string
          id?: string
          notes?: string | null
          room_number: string
          school_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          dormitory_id?: string
          id?: string
          notes?: string | null
          room_number?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dorm_rooms_dormitory_id_fkey"
            columns: ["dormitory_id"]
            isOneToOne: false
            referencedRelation: "dormitories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dorm_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      dormitories: {
        Row: {
          capacity: number
          created_at: string
          gender: string
          id: string
          name: string
          notes: string | null
          school_id: string
          updated_at: string
          warden_name: string | null
          warden_phone: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          gender: string
          id?: string
          name: string
          notes?: string | null
          school_id: string
          updated_at?: string
          warden_name?: string | null
          warden_phone?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          gender?: string
          id?: string
          name?: string
          notes?: string | null
          school_id?: string
          updated_at?: string
          warden_name?: string | null
          warden_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dormitories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      library_books: {
        Row: {
          author: string | null
          available_copies: number
          category: string | null
          cover_url: string | null
          created_at: string
          id: string
          isbn: string | null
          location: string | null
          publisher: string | null
          school_id: string
          title: string
          total_copies: number
          updated_at: string
          year: number | null
        }
        Insert: {
          author?: string | null
          available_copies?: number
          category?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          location?: string | null
          publisher?: string | null
          school_id: string
          title: string
          total_copies?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          author?: string | null
          available_copies?: number
          category?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string | null
          location?: string | null
          publisher?: string | null
          school_id?: string
          title?: string
          total_copies?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_copies: {
        Row: {
          barcode: string | null
          book_id: string
          created_at: string
          id: string
          note: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          book_id: string
          created_at?: string
          id?: string
          note?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          book_id?: string
          created_at?: string
          id?: string
          note?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_copies_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_loans: {
        Row: {
          book_id: string
          borrower_type: string
          copy_id: string
          created_at: string
          due_date: string
          id: string
          loaned_at: string
          note: string | null
          recorded_by: string | null
          returned_at: string | null
          school_id: string
          staff_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          book_id: string
          borrower_type?: string
          copy_id: string
          created_at?: string
          due_date: string
          id?: string
          loaned_at?: string
          note?: string | null
          recorded_by?: string | null
          returned_at?: string | null
          school_id: string
          staff_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          book_id?: string
          borrower_type?: string
          copy_id?: string
          created_at?: string
          due_date?: string
          id?: string
          loaned_at?: string
          note?: string | null
          recorded_by?: string | null
          returned_at?: string | null
          school_id?: string
          staff_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "library_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reservations: {
        Row: {
          book_id: string
          borrower_type: string
          created_at: string
          id: string
          note: string | null
          reserved_at: string
          school_id: string
          staff_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          book_id: string
          borrower_type?: string
          created_at?: string
          id?: string
          note?: string | null
          reserved_at?: string
          school_id: string
          staff_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          book_id?: string
          borrower_type?: string
          created_at?: string
          id?: string
          note?: string | null
          reserved_at?: string
          school_id?: string
          staff_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_reservations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_reservations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_reservations_student_id_fkey"
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
      payroll_runs: {
        Row: {
          created_at: string
          created_by: string | null
          finalized_at: string | null
          id: string
          notes: string | null
          period: string
          school_id: string
          status: Database["public"]["Enums"]["payroll_status"]
          total_deductions_fcfa: number
          total_gross_fcfa: number
          total_net_fcfa: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          period: string
          school_id: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions_fcfa?: number
          total_gross_fcfa?: number
          total_net_fcfa?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          period?: string
          school_id?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions_fcfa?: number
          total_gross_fcfa?: number
          total_net_fcfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          allowances: Json
          base_salary_fcfa: number
          created_at: string
          deductions: Json
          deductions_total_fcfa: number
          gross_fcfa: number
          id: string
          net_fcfa: number
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["pay_method"] | null
          reference: string | null
          run_id: string
          school_id: string
          staff_id: string
          status: Database["public"]["Enums"]["payslip_status"]
          updated_at: string
        }
        Insert: {
          allowances?: Json
          base_salary_fcfa?: number
          created_at?: string
          deductions?: Json
          deductions_total_fcfa?: number
          gross_fcfa?: number
          id?: string
          net_fcfa?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"] | null
          reference?: string | null
          run_id: string
          school_id: string
          staff_id: string
          status?: Database["public"]["Enums"]["payslip_status"]
          updated_at?: string
        }
        Update: {
          allowances?: Json
          base_salary_fcfa?: number
          created_at?: string
          deductions?: Json
          deductions_total_fcfa?: number
          gross_fcfa?: number
          id?: string
          net_fcfa?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"] | null
          reference?: string | null
          run_id?: string
          school_id?: string
          staff_id?: string
          status?: Database["public"]["Enums"]["payslip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
          wallet_default_daily_limit: number | null
          wallet_default_monthly_limit: number | null
          wallet_default_per_txn_limit: number | null
          wallet_default_weekly_limit: number | null
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
          wallet_default_daily_limit?: number | null
          wallet_default_monthly_limit?: number | null
          wallet_default_per_txn_limit?: number | null
          wallet_default_weekly_limit?: number | null
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
          wallet_default_daily_limit?: number | null
          wallet_default_monthly_limit?: number | null
          wallet_default_per_txn_limit?: number | null
          wallet_default_weekly_limit?: number | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          base_salary_fcfa: number
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          date_of_birth: string | null
          department: string | null
          email: string | null
          end_date: string | null
          first_name: string
          gender: string | null
          hire_date: string | null
          id: string
          last_name: string
          matricule: string | null
          momo_number: string | null
          national_id: string | null
          notes: string | null
          phone: string | null
          position: Database["public"]["Enums"]["staff_position"]
          school_id: string
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary_fcfa?: number
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          end_date?: string | null
          first_name: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          last_name: string
          matricule?: string | null
          momo_number?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["staff_position"]
          school_id: string
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary_fcfa?: number
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          end_date?: string | null
          first_name?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string
          matricule?: string | null
          momo_number?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["staff_position"]
          school_id?: string
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_allowances: {
        Row: {
          active: boolean
          amount_fcfa: number
          created_at: string
          id: string
          kind: string
          label: string
          school_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_fcfa?: number
          created_at?: string
          id?: string
          kind?: string
          label: string
          school_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_fcfa?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string
          school_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_allowances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_allowances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
          wallet_balance: number
          wallet_daily_limit: number | null
          wallet_monthly_limit: number | null
          wallet_per_txn_limit: number | null
          wallet_weekly_limit: number | null
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
          wallet_balance?: number
          wallet_daily_limit?: number | null
          wallet_monthly_limit?: number | null
          wallet_per_txn_limit?: number | null
          wallet_weekly_limit?: number | null
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
          wallet_balance?: number
          wallet_daily_limit?: number | null
          wallet_monthly_limit?: number | null
          wallet_per_txn_limit?: number | null
          wallet_weekly_limit?: number | null
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
      transport_boarding_log: {
        Row: {
          boarded: boolean
          created_at: string
          direction: string
          id: string
          log_date: string
          note: string | null
          recorded_by: string | null
          route_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          boarded?: boolean
          created_at?: string
          direction?: string
          id?: string
          log_date?: string
          note?: string | null
          recorded_by?: string | null
          route_id: string
          school_id: string
          student_id: string
        }
        Update: {
          boarded?: boolean
          created_at?: string
          direction?: string
          id?: string
          log_date?: string
          note?: string | null
          recorded_by?: string | null
          route_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_boarding_log_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_boarding_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_boarding_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_incidents: {
        Row: {
          cost_fcfa: number
          created_at: string
          description: string
          id: string
          incident_date: string
          kind: string
          resolved: boolean
          route_id: string | null
          school_id: string
          severity: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cost_fcfa?: number
          created_at?: string
          description: string
          id?: string
          incident_date?: string
          kind?: string
          resolved?: boolean
          route_id?: string | null
          school_id: string
          severity?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cost_fcfa?: number
          created_at?: string
          description?: string
          id?: string
          incident_date?: string
          kind?: string
          resolved?: boolean
          route_id?: string | null
          school_id?: string
          severity?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_incidents_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_incidents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "transport_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          monthly_fee_fcfa: number
          name: string
          notes: string | null
          school_id: string
          stops: Json
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          monthly_fee_fcfa?: number
          name: string
          notes?: string | null
          school_id: string
          stops?: Json
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          monthly_fee_fcfa?: number
          name?: string
          notes?: string | null
          school_id?: string
          stops?: Json
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "transport_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          monthly_fee_fcfa: number
          route_id: string
          school_id: string
          start_date: string
          status: string
          stop_name: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_fee_fcfa?: number
          route_id: string
          school_id: string
          start_date?: string
          status?: string
          stop_name?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_fee_fcfa?: number
          route_id?: string
          school_id?: string
          start_date?: string
          status?: string
          stop_name?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_subscriptions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_vehicles: {
        Row: {
          capacity: number
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          model: string | null
          notes: string | null
          plate_no: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          plate_no: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          plate_no?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_vehicles_school_id_fkey"
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
      wallet_transactions: {
        Row: {
          amount_fcfa: number
          created_at: string
          guardian_approval_note: string | null
          guardian_approved: boolean
          id: string
          kind: string
          method: string
          note: string | null
          occurred_at: string
          over_limit: boolean
          recorded_by: string | null
          reference: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          amount_fcfa: number
          created_at?: string
          guardian_approval_note?: string | null
          guardian_approved?: boolean
          id?: string
          kind: string
          method?: string
          note?: string | null
          occurred_at?: string
          over_limit?: boolean
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          amount_fcfa?: number
          created_at?: string
          guardian_approval_note?: string | null
          guardian_approved?: boolean
          id?: string
          kind?: string
          method?: string
          note?: string | null
          occurred_at?: string
          over_limit?: boolean
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_hr: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
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
      recompute_book_counts: { Args: { _book_id: string }; Returns: undefined }
      recompute_payroll_run: { Args: { _run_id: string }; Returns: undefined }
      recompute_student_balance: {
        Args: { _student_id: string }
        Returns: undefined
      }
      recompute_student_wallet: {
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
      contract_type:
        | "permanent"
        | "fixed_term"
        | "part_time"
        | "volunteer"
        | "intern"
      gender: "male" | "female"
      message_audience: "all" | "class" | "staff" | "guardians"
      pay_method: "cash" | "bank" | "momo" | "check"
      payment_method: "cash" | "momo" | "bank" | "cheque" | "other"
      payroll_status: "draft" | "finalized" | "paid"
      payslip_status: "pending" | "paid"
      staff_position:
        | "teacher"
        | "principal"
        | "vice_principal"
        | "bursar"
        | "secretary"
        | "discipline_master"
        | "librarian"
        | "nurse"
        | "driver"
        | "cook"
        | "cleaner"
        | "security"
        | "maintenance"
        | "other"
      staff_status: "active" | "on_leave" | "suspended" | "terminated"
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
      contract_type: [
        "permanent",
        "fixed_term",
        "part_time",
        "volunteer",
        "intern",
      ],
      gender: ["male", "female"],
      message_audience: ["all", "class", "staff", "guardians"],
      pay_method: ["cash", "bank", "momo", "check"],
      payment_method: ["cash", "momo", "bank", "cheque", "other"],
      payroll_status: ["draft", "finalized", "paid"],
      payslip_status: ["pending", "paid"],
      staff_position: [
        "teacher",
        "principal",
        "vice_principal",
        "bursar",
        "secretary",
        "discipline_master",
        "librarian",
        "nurse",
        "driver",
        "cook",
        "cleaner",
        "security",
        "maintenance",
        "other",
      ],
      staff_status: ["active", "on_leave", "suspended", "terminated"],
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
