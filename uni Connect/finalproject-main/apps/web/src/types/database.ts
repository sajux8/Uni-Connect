// Generated from the Supabase schema (Supabase MCP generate_typescript_types). Do not edit by hand:
// regenerate after every migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type ProfileRefs<FK extends string, Col extends string> = [
  { foreignKeyName: FK; columns: [Col]; isOneToOne: false; referencedRelation: "profile_cards"; referencedColumns: ["id"] },
  { foreignKeyName: FK; columns: [Col]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          ...ProfileRefs<"account_deletion_requests_handled_by_fkey", "handled_by">,
          ...ProfileRefs<"account_deletion_requests_user_id_fkey", "user_id">,
        ]
      }
      ai_form_summaries: {
        Row: {
          answer_count: number
          form_id: string
          generated_at: string
          model: string
          summary: Json
        }
        Insert: {
          answer_count: number
          form_id: string
          generated_at?: string
          model: string
          summary: Json
        }
        Update: {
          answer_count?: number
          form_id?: string
          generated_at?: string
          model?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_form_summaries_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_index_queue: {
        Row: {
          queued_at: string
          source_id: string
          source_type: string
        }
        Insert: {
          queued_at?: string
          source_id: string
          source_type: string
        }
        Update: {
          queued_at?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      ai_summaries: {
        Row: {
          generated_at: string
          model: string
          post_id: string
          reply_count_at_generation: number
          summary: Json
        }
        Insert: {
          generated_at?: string
          model: string
          post_id: string
          reply_count_at_generation: number
          summary: Json
        }
        Update: {
          generated_at?: string
          model?: string
          post_id?: string
          reply_count_at_generation?: number
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          ask_count: number
          day: string
          related_count: number
          summary_count: number
          user_id: string
        }
        Insert: {
          ask_count?: number
          day: string
          related_count?: number
          summary_count?: number
          user_id: string
        }
        Update: {
          ask_count?: number
          day?: string
          related_count?: number
          summary_count?: number
          user_id?: string
        }
        Relationships: [
          ...ProfileRefs<"ai_usage_user_id_fkey", "user_id">,
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"announcement_reads_user_id_fkey", "user_id">,
        ]
      }
      announcements: {
        Row: {
          audience_all: boolean
          audience_department_ids: string[]
          audience_years: number[]
          body_html: string
          body_text: string
          category: Database["public"]["Enums"]["announcement_category"]
          created_at: string
          edited_at: string | null
          id: string
          is_important: boolean
          is_pinned: boolean
          pinned_until: string | null
          publish_at: string | null
          published_at: string | null
          publisher_id: string | null
          publishing_unit: string
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          tsv: unknown
          updated_at: string
        }
        Insert: {
          audience_all?: boolean
          audience_department_ids?: string[]
          audience_years?: number[]
          body_html: string
          body_text: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          edited_at?: string | null
          id?: string
          is_important?: boolean
          is_pinned?: boolean
          pinned_until?: string | null
          publish_at?: string | null
          published_at?: string | null
          publisher_id?: string | null
          publishing_unit: string
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          tsv?: unknown
          updated_at?: string
        }
        Update: {
          audience_all?: boolean
          audience_department_ids?: string[]
          audience_years?: number[]
          body_html?: string
          body_text?: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          edited_at?: string | null
          id?: string
          is_important?: boolean
          is_pinned?: boolean
          pinned_until?: string | null
          publish_at?: string | null
          published_at?: string | null
          publisher_id?: string | null
          publishing_unit?: string
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          ...ProfileRefs<"announcements_publisher_id_fkey", "publisher_id">,
        ]
      }
      attendance: {
        Row: {
          marked_at: string
          marked_by: string | null
          session_id: string
          source: string
          student_id: string
        }
        Insert: {
          marked_at?: string
          marked_by?: string | null
          session_id: string
          source: string
          student_id: string
        }
        Update: {
          marked_at?: string
          marked_by?: string | null
          session_id?: string
          source?: string
          student_id?: string
        }
        Relationships: [
          ...ProfileRefs<"attendance_marked_by_fkey", "marked_by">,
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"attendance_student_id_fkey", "student_id">,
        ]
      }
      attendance_alerts: {
        Row: {
          batch_id: string
          created_at: string
          first_missed_session_id: string
          id: string
          missed_count: number
          student_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          first_missed_session_id: string
          id?: string
          missed_count: number
          student_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          first_missed_session_id?: string
          id?: string
          missed_count?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_alerts_first_missed_session_id_fkey"
            columns: ["first_missed_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"attendance_alerts_student_id_fkey", "student_id">,
        ]
      }
      attendance_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          present: boolean
          reason: string
          session_id: string
          student_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          present: boolean
          reason: string
          session_id: string
          student_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          present?: boolean
          reason?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          ...ProfileRefs<"attendance_changes_changed_by_fkey", "changed_by">,
          {
            foreignKeyName: "attendance_changes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"attendance_changes_student_id_fkey", "student_id">,
        ]
      }
      batch_lecturers: {
        Row: {
          added_at: string
          batch_id: string
          lecturer_id: string
        }
        Insert: {
          added_at?: string
          batch_id: string
          lecturer_id: string
        }
        Update: {
          added_at?: string
          batch_id?: string
          lecturer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_lecturers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"batch_lecturers_lecturer_id_fkey", "lecturer_id">,
        ]
      }
      batches: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          name: string
          number: number
          rep_id: string | null
          space_id: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          name: string
          number: number
          rep_id?: string | null
          space_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          name?: string
          number?: number
          rep_id?: string | null
          space_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"batches_rep_id_fkey", "rep_id">,
          {
            foreignKeyName: "batches_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          target_id: string
          target_type: Database["public"]["Enums"]["bookmark_target"]
          user_id: string
        }
        Insert: {
          created_at?: string
          target_id: string
          target_type: Database["public"]["Enums"]["bookmark_target"]
          user_id: string
        }
        Update: {
          created_at?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["bookmark_target"]
          user_id?: string
        }
        Relationships: [
          ...ProfileRefs<"bookmarks_user_id_fkey", "user_id">,
        ]
      }
      class_sessions: {
        Row: {
          batch_id: string
          change_reason: string | null
          created_at: string
          ends_at: string
          entry_id: string | null
          id: string
          lecturer_id: string | null
          module_code: string | null
          module_name: string
          moved_from: string | null
          room: string | null
          session_date: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          change_reason?: string | null
          created_at?: string
          ends_at: string
          entry_id?: string | null
          id?: string
          lecturer_id?: string | null
          module_code?: string | null
          module_name: string
          moved_from?: string | null
          room?: string | null
          session_date: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          change_reason?: string | null
          created_at?: string
          ends_at?: string
          entry_id?: string | null
          id?: string
          lecturer_id?: string | null
          module_code?: string | null
          module_name?: string
          moved_from?: string | null
          room?: string | null
          session_date?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "timetable_entries"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"class_sessions_lecturer_id_fkey", "lecturer_id">,
        ]
      }
      content_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          id: string
          parent_id: string | null
          source_date: string | null
          source_id: string
          source_type: string
          title: string
          updated_at: string
        }
        Insert: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          id?: string
          parent_id?: string | null
          source_date?: string | null
          source_id: string
          source_type: string
          title: string
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string
          embedding?: string
          id?: string
          parent_id?: string | null
          source_date?: string | null
          source_id?: string
          source_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"conversation_participants_user_id_fkey", "user_id">,
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          mentorship_request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          mentorship_request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          mentorship_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_mentorship_request_id_fkey"
            columns: ["mentorship_request_id"]
            isOneToOne: true
            referencedRelation: "mentorship_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          to_user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          to_user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          template?: string
          to_email?: string
          to_user_id?: string | null
        }
        Relationships: [
          ...ProfileRefs<"email_outbox_to_user_id_fkey", "to_user_id">,
        ]
      }
      event_changes: {
        Row: {
          changed_by: string | null
          changes: Json
          created_at: string
          event_id: string
          id: string
          summary: string
        }
        Insert: {
          changed_by?: string | null
          changes?: Json
          created_at?: string
          event_id: string
          id?: string
          summary: string
        }
        Update: {
          changed_by?: string | null
          changes?: Json
          created_at?: string
          event_id?: string
          id?: string
          summary?: string
        }
        Relationships: [
          ...ProfileRefs<"event_changes_changed_by_fkey", "changed_by">,
          {
            foreignKeyName: "event_changes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          cancelled_at: string | null
          event_id: string
          registered_at: string
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          status: Database["public"]["Enums"]["registration_status"]
          user_id: string
          waitlist_position: number | null
        }
        Insert: {
          cancelled_at?: string | null
          event_id: string
          registered_at?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          status: Database["public"]["Enums"]["registration_status"]
          user_id: string
          waitlist_position?: number | null
        }
        Update: {
          cancelled_at?: string | null
          event_id?: string
          registered_at?: string
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          status?: Database["public"]["Enums"]["registration_status"]
          user_id?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"event_registrations_user_id_fkey", "user_id">,
        ]
      }
      events: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          capacity: number | null
          category: Database["public"]["Enums"]["event_category"]
          cover_url: string | null
          created_at: string
          description_html: string
          description_text: string
          eligibility_department_ids: string[]
          eligibility_note: string | null
          eligibility_years: number[]
          ends_at: string
          format: Database["public"]["Enums"]["event_format"]
          id: string
          location_details: string | null
          online_url: string | null
          organizer_id: string | null
          organizing_unit: string
          published_at: string | null
          registered_count: number
          registration_deadline: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          space_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          tsv: unknown
          updated_at: string
          venue: string | null
          waitlist_count: number
          waitlist_enabled: boolean
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          category?: Database["public"]["Enums"]["event_category"]
          cover_url?: string | null
          created_at?: string
          description_html: string
          description_text: string
          eligibility_department_ids?: string[]
          eligibility_note?: string | null
          eligibility_years?: number[]
          ends_at: string
          format?: Database["public"]["Enums"]["event_format"]
          id?: string
          location_details?: string | null
          online_url?: string | null
          organizer_id?: string | null
          organizing_unit: string
          published_at?: string | null
          registered_count?: number
          registration_deadline?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          space_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          tsv?: unknown
          updated_at?: string
          venue?: string | null
          waitlist_count?: number
          waitlist_enabled?: boolean
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          capacity?: number | null
          category?: Database["public"]["Enums"]["event_category"]
          cover_url?: string | null
          created_at?: string
          description_html?: string
          description_text?: string
          eligibility_department_ids?: string[]
          eligibility_note?: string | null
          eligibility_years?: number[]
          ends_at?: string
          format?: Database["public"]["Enums"]["event_format"]
          id?: string
          location_details?: string | null
          online_url?: string | null
          organizer_id?: string | null
          organizing_unit?: string
          published_at?: string | null
          registered_count?: number
          registration_deadline?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          space_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          tsv?: unknown
          updated_at?: string
          venue?: string | null
          waitlist_count?: number
          waitlist_enabled?: boolean
        }
        Relationships: [
          ...ProfileRefs<"events_organizer_id_fkey", "organizer_id">,
          ...ProfileRefs<"events_reviewed_by_fkey", "reviewed_by">,
          {
            foreignKeyName: "events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      form_answers: {
        Row: {
          answered_on: string
          form_id: string
          id: string
          question_id: string
          response_id: string
          value_number: number | null
          value_options: string[] | null
          value_text: string | null
        }
        Insert: {
          answered_on: string
          form_id: string
          id?: string
          question_id: string
          response_id: string
          value_number?: number | null
          value_options?: string[] | null
          value_text?: string | null
        }
        Update: {
          answered_on?: string
          form_id?: string
          id?: string
          question_id?: string
          response_id?: string
          value_number?: number | null
          value_options?: string[] | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_answers_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "form_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_questions: {
        Row: {
          form_id: string
          help_text: string
          id: string
          options: string[]
          position: number
          prompt: string
          required: boolean
          scale_max: number | null
          scale_max_label: string | null
          scale_min_label: string | null
          type: string
        }
        Insert: {
          form_id: string
          help_text?: string
          id?: string
          options?: string[]
          position: number
          prompt: string
          required?: boolean
          scale_max?: number | null
          scale_max_label?: string | null
          scale_min_label?: string | null
          type: string
        }
        Update: {
          form_id?: string
          help_text?: string
          id?: string
          options?: string[]
          position?: number
          prompt?: string
          required?: boolean
          scale_max?: number | null
          scale_max_label?: string | null
          scale_min_label?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          batch_id: string | null
          form_id: string
          submitted_on: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          form_id: string
          submitted_on: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          form_id?: string
          submitted_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"form_submissions_user_id_fkey", "user_id">,
        ]
      }
      forms: {
        Row: {
          about_lecturer_id: string | null
          batch_ids: string[]
          closes_at: string | null
          created_at: string
          created_by: string | null
          department_id: string
          description: string
          id: string
          published_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          about_lecturer_id?: string | null
          batch_ids?: string[]
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string
          id?: string
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          about_lecturer_id?: string | null
          batch_ids?: string[]
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string
          id?: string
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          ...ProfileRefs<"forms_about_lecturer_id_fkey", "about_lecturer_id">,
          ...ProfileRefs<"forms_created_by_fkey", "created_by">,
          {
            foreignKeyName: "forms_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_profiles: {
        Row: {
          about: string
          active_mentee_count: number
          availability_note: string | null
          created_at: string
          headline: string
          is_accepting: boolean
          max_active_mentees: number
          skills: string[]
          subjects: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          about?: string
          active_mentee_count?: number
          availability_note?: string | null
          created_at?: string
          headline: string
          is_accepting?: boolean
          max_active_mentees?: number
          skills?: string[]
          subjects?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          about?: string
          active_mentee_count?: number
          availability_note?: string | null
          created_at?: string
          headline?: string
          is_accepting?: boolean
          max_active_mentees?: number
          skills?: string[]
          subjects?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_requests: {
        Row: {
          conversation_id: string | null
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          mentee_id: string
          mentor_id: string
          message: string
          responded_at: string | null
          response_note: string | null
          status: Database["public"]["Enums"]["mentorship_status"]
          topic: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          mentee_id: string
          mentor_id: string
          message: string
          responded_at?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["mentorship_status"]
          topic: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          mentee_id?: string
          mentor_id?: string
          message?: string
          responded_at?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["mentorship_status"]
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_requests_conversation_fk"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"mentorship_requests_ended_by_fkey", "ended_by">,
          ...ProfileRefs<"mentorship_requests_mentee_id_fkey", "mentee_id">,
          ...ProfileRefs<"mentorship_requests_mentor_id_fkey", "mentor_id">,
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string | null
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"messages_sender_id_fkey", "sender_id">,
        ]
      }
      moderation_actions: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action_type"]
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          report_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action_type"]
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          report_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action_type"]
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          ...ProfileRefs<"moderation_actions_actor_id_fkey", "actor_id">,
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          type: string
          user_id: string
        }
        Insert: {
          email: boolean
          in_app: boolean
          type: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["type"]
          },
          ...ProfileRefs<"notification_preferences_user_id_fkey", "user_id">,
        ]
      }
      notification_types: {
        Row: {
          email_available: boolean
          email_default: boolean
          in_app_default: boolean
          locked: boolean
          sort_order: number
          type: string
        }
        Insert: {
          email_available?: boolean
          email_default?: boolean
          in_app_default?: boolean
          locked?: boolean
          sort_order?: number
          type: string
        }
        Update: {
          email_available?: boolean
          email_default?: boolean
          in_app_default?: boolean
          locked?: boolean
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          ...ProfileRefs<"notifications_actor_id_fkey", "actor_id">,
          {
            foreignKeyName: "notifications_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["type"]
          },
          ...ProfileRefs<"notifications_user_id_fkey", "user_id">,
        ]
      }
      opportunities: {
        Row: {
          apply_email: string | null
          apply_url: string | null
          batch_ids: string[]
          company: string
          created_at: string
          deadline: string | null
          department_id: string | null
          description: string
          id: string
          location: string | null
          mode: string
          posted_by: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          apply_email?: string | null
          apply_url?: string | null
          batch_ids?: string[]
          company: string
          created_at?: string
          deadline?: string | null
          department_id?: string | null
          description: string
          id?: string
          location?: string | null
          mode: string
          posted_by?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          apply_email?: string | null
          apply_url?: string | null
          batch_ids?: string[]
          company?: string
          created_at?: string
          deadline?: string | null
          department_id?: string | null
          description?: string
          id?: string
          location?: string | null
          mode?: string
          posted_by?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"opportunities_posted_by_fkey", "posted_by">,
        ]
      }
      post_follows: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_follows_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"post_follows_user_id_fkey", "user_id">,
        ]
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      post_votes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"post_votes_user_id_fkey", "user_id">,
        ]
      }
      posts: {
        Row: {
          accepted_reply_id: string | null
          audience: string
          author_id: string | null
          body_html: string
          body_text: string
          created_at: string
          edited_at: string | null
          helpful_count: number
          id: string
          is_locked: boolean
          is_pinned: boolean
          last_activity_at: string
          reply_count: number
          space_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string
          tsv: unknown
          type: Database["public"]["Enums"]["post_type"]
          updated_at: string
          vote_score: number
        }
        Insert: {
          accepted_reply_id?: string | null
          audience?: string
          author_id?: string | null
          body_html: string
          body_text: string
          created_at?: string
          edited_at?: string | null
          helpful_count?: number
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          reply_count?: number
          space_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          tsv?: unknown
          type: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          vote_score?: number
        }
        Update: {
          accepted_reply_id?: string | null
          audience?: string
          author_id?: string | null
          body_html?: string
          body_text?: string
          created_at?: string
          edited_at?: string | null
          helpful_count?: number
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          reply_count?: number
          space_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          tsv?: unknown
          type?: Database["public"]["Enums"]["post_type"]
          updated_at?: string
          vote_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_accepted_reply_fkey"
            columns: ["accepted_reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"posts_author_id_fkey", "author_id">,
          {
            foreignKeyName: "posts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          application_note: string | null
          id_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_note?: string | null
          id_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_note?: string | null
          id_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          batch_assigned_at: string | null
          batch_id: string | null
          bio: string | null
          created_at: string
          department_id: string | null
          expertise: string[]
          full_name: string
          id: string
          interests: string[]
          last_seen_at: string | null
          mentorship_requests_from: Database["public"]["Enums"]["request_permission"]
          onboarding_completed: boolean
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          requested_role: Database["public"]["Enums"]["requested_role"]
          role: Database["public"]["Enums"]["user_role"]
          show_year: boolean
          status: Database["public"]["Enums"]["account_status"]
          status_reason: string | null
          suspended_until: string | null
          updated_at: string
          username: string
          year_of_study: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          batch_assigned_at?: string | null
          batch_id?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          expertise?: string[]
          full_name: string
          id: string
          interests?: string[]
          last_seen_at?: string | null
          mentorship_requests_from?: Database["public"]["Enums"]["request_permission"]
          onboarding_completed?: boolean
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          requested_role?: Database["public"]["Enums"]["requested_role"]
          role?: Database["public"]["Enums"]["user_role"]
          show_year?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          status_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
          username: string
          year_of_study?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          batch_assigned_at?: string | null
          batch_id?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          expertise?: string[]
          full_name?: string
          id?: string
          interests?: string[]
          last_seen_at?: string | null
          mentorship_requests_from?: Database["public"]["Enums"]["request_permission"]
          onboarding_completed?: boolean
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          requested_role?: Database["public"]["Enums"]["requested_role"]
          role?: Database["public"]["Enums"]["user_role"]
          show_year?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          status_reason?: string | null
          suspended_until?: string | null
          updated_at?: string
          username?: string
          year_of_study?: number | null
        }
        Relationships: [
          ...ProfileRefs<"profiles_approved_by_fkey", "approved_by">,
          {
            foreignKeyName: "profiles_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      replies: {
        Row: {
          author_id: string | null
          body_html: string
          body_text: string
          created_at: string
          edited_at: string | null
          helpful_count: number
          id: string
          parent_reply_id: string | null
          post_id: string
          status: Database["public"]["Enums"]["content_status"]
          tsv: unknown
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_html: string
          body_text: string
          created_at?: string
          edited_at?: string | null
          helpful_count?: number
          id?: string
          parent_reply_id?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["content_status"]
          tsv?: unknown
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_html?: string
          body_text?: string
          created_at?: string
          edited_at?: string | null
          helpful_count?: number
          id?: string
          parent_reply_id?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          ...ProfileRefs<"replies_author_id_fkey", "author_id">,
          {
            foreignKeyName: "replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_votes: {
        Row: {
          created_at: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reply_votes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"reply_votes_user_id_fkey", "user_id">,
        ]
      }
      reports: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action_type"] | null
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string | null
          resolution_note: string | null
          snapshot: Json
          space_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_author_id: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          action?: Database["public"]["Enums"]["moderation_action_type"] | null
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution_note?: string | null
          snapshot?: Json
          space_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_author_id?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action_type"] | null
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution_note?: string | null
          snapshot?: Json
          space_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_author_id?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          ...ProfileRefs<"reports_handled_by_fkey", "handled_by">,
          ...ProfileRefs<"reports_reporter_id_fkey", "reporter_id">,
          {
            foreignKeyName: "reports_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"reports_target_author_id_fkey", "target_author_id">,
        ]
      }
      resource_tags: {
        Row: {
          resource_id: string
          tag_id: string
        }
        Insert: {
          resource_id: string
          tag_id: string
        }
        Update: {
          resource_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_tags_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          download_count: number
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          mime_type: string | null
          module_code: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          space_id: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string
          tsv: unknown
          updated_at: string
          uploader_id: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          download_count?: number
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind: Database["public"]["Enums"]["resource_kind"]
          mime_type?: string | null
          module_code?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title: string
          tsv?: unknown
          updated_at?: string
          uploader_id?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          download_count?: number
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          mime_type?: string | null
          module_code?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
          tsv?: unknown
          updated_at?: string
          uploader_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"resources_reviewed_by_fkey", "reviewed_by">,
          {
            foreignKeyName: "resources_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"resources_uploader_id_fkey", "uploader_id">,
        ]
      }
      space_members: {
        Row: {
          joined_at: string
          notify_level: Database["public"]["Enums"]["notify_level"]
          role: Database["public"]["Enums"]["member_role"]
          space_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          notify_level?: Database["public"]["Enums"]["notify_level"]
          role?: Database["public"]["Enums"]["member_role"]
          space_id: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          joined_at?: string
          notify_level?: Database["public"]["Enums"]["notify_level"]
          role?: Database["public"]["Enums"]["member_role"]
          space_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"space_members_user_id_fkey", "user_id">,
        ]
      }
      spaces: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          join_policy: Database["public"]["Enums"]["join_policy"]
          member_count: number
          module_code: string | null
          name: string
          parent_id: string | null
          rules: string | null
          slug: string
          type: Database["public"]["Enums"]["space_type"]
          updated_at: string
          year_of_study: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          join_policy?: Database["public"]["Enums"]["join_policy"]
          member_count?: number
          module_code?: string | null
          name: string
          parent_id?: string | null
          rules?: string | null
          slug: string
          type: Database["public"]["Enums"]["space_type"]
          updated_at?: string
          year_of_study?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          join_policy?: Database["public"]["Enums"]["join_policy"]
          member_count?: number
          module_code?: string | null
          name?: string
          parent_id?: string | null
          rules?: string | null
          slug?: string
          type?: Database["public"]["Enums"]["space_type"]
          updated_at?: string
          year_of_study?: number | null
        }
        Relationships: [
          ...ProfileRefs<"spaces_created_by_fkey", "created_by">,
          {
            foreignKeyName: "spaces_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_follows: {
        Row: {
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_follows_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"tag_follows_user_id_fkey", "user_id">,
        ]
      }
      tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          usage_count?: number
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          from_staff: boolean
          id: string
          kind: string
          status: string | null
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          from_staff: boolean
          id?: string
          kind?: string
          status?: string | null
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          from_staff?: boolean
          id?: string
          kind?: string
          status?: string | null
          ticket_id?: string
        }
        Relationships: [
          ...ProfileRefs<"ticket_messages_author_id_fkey", "author_id">,
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_owners: {
        Row: {
          ticket_id: string
          user_id: string
        }
        Insert: {
          ticket_id: string
          user_id: string
        }
        Update: {
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_owners_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"ticket_owners_user_id_fkey", "user_id">,
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          author_id: string | null
          batch_id: string | null
          body: string
          category: string
          created_at: string
          department_id: string | null
          id: string
          is_anonymous: boolean
          kind: string
          photo_path: string | null
          resolved_at: string | null
          route_to: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          author_id?: string | null
          batch_id?: string | null
          body: string
          category: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_anonymous?: boolean
          kind: string
          photo_path?: string | null
          resolved_at?: string | null
          route_to?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          author_id?: string | null
          batch_id?: string | null
          body?: string
          category?: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_anonymous?: boolean
          kind?: string
          photo_path?: string | null
          resolved_at?: string | null
          route_to?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          ...ProfileRefs<"tickets_assigned_to_fkey", "assigned_to">,
          ...ProfileRefs<"tickets_author_id_fkey", "author_id">,
          {
            foreignKeyName: "tickets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          end_time: string
          ends_on: string
          id: string
          lecturer_id: string | null
          module_code: string | null
          module_name: string
          room: string | null
          start_time: string
          starts_on: string
          updated_at: string
          weekday: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          ends_on: string
          id?: string
          lecturer_id?: string | null
          module_code?: string | null
          module_name: string
          room?: string | null
          start_time: string
          starts_on: string
          updated_at?: string
          weekday: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          ends_on?: string
          id?: string
          lecturer_id?: string | null
          module_code?: string | null
          module_name?: string
          room?: string | null
          start_time?: string
          starts_on?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          ...ProfileRefs<"timetable_entries_created_by_fkey", "created_by">,
          ...ProfileRefs<"timetable_entries_lecturer_id_fkey", "lecturer_id">,
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          ...ProfileRefs<"user_blocks_blocked_id_fkey", "blocked_id">,
          ...ProfileRefs<"user_blocks_blocker_id_fkey", "blocker_id">,
        ]
      }
    }
    Views: {
      profile_cards: {
        Row: {
          avatar_url: string | null
          batch_id: string | null
          batch_name: string | null
          bio: string | null
          created_at: string | null
          department_id: string | null
          department_name: string | null
          expertise: string[] | null
          full_name: string | null
          id: string | null
          interests: string[] | null
          is_class_rep: boolean | null
          profile_visibility:
            | Database["public"]["Enums"]["visibility_level"]
            | null
          role: Database["public"]["Enums"]["user_role"] | null
          username: string | null
          year_of_study: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_reply: { Args: { p_reply_id: string }; Returns: string }
      admin_list_accounts: {
        Args: {
          p_limit?: number
          p_status: Database["public"]["Enums"]["account_status"]
        }
        Returns: {
          application_note: string
          approved_at: string
          batch_id: string
          batch_name: string
          created_at: string
          department_id: string
          department_name: string
          email: string
          full_name: string
          id: string
          id_number: string
          requested_role: Database["public"]["Enums"]["requested_role"]
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          status_reason: string
          username: string
          year_of_study: number
        }[]
      }
      admin_search_users: {
        Args: {
          p_department?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_role?: Database["public"]["Enums"]["user_role"]
          p_status?: Database["public"]["Enums"]["account_status"]
        }
        Returns: {
          avatar_url: string
          batch_name: string
          created_at: string
          department_name: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          suspended_until: string
          total_count: number
          username: string
          year_of_study: number
        }[]
      }
      admin_set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: {
          p_batch_id?: string
          p_reason?: string
          p_role?: Database["public"]["Enums"]["user_role"]
          p_status: Database["public"]["Enums"]["account_status"]
          p_until?: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_stats: {
        Args: never
        Returns: {
          active_mentorships: number
          members: number
          new_users_7d: number
          open_reports: number
          pending_approvals: number
          pending_deletions: number
          pending_resources: number
          posts_7d: number
          replies_7d: number
          upcoming_events: number
        }[]
      }
      admin_user_detail: {
        Args: { p_user_id: string }
        Returns: {
          application_note: string
          approved_at: string
          avatar_url: string
          batch_id: string
          batch_name: string
          created_at: string
          deletion_reason: string
          deletion_request_id: string
          deletion_requested_at: string
          department_id: string
          department_name: string
          email: string
          full_name: string
          id: string
          id_number: string
          is_class_rep: boolean
          last_sign_in_at: string
          open_reports_against: number
          post_count: number
          reply_count: number
          reports_against: number
          reports_made: number
          requested_role: Database["public"]["Enums"]["requested_role"]
          resource_count: number
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          status_reason: string
          suspended_until: string
          username: string
          year_of_study: number
        }[]
      }
      admin_weekly_activity: {
        Args: { p_weeks?: number }
        Returns: {
          new_members: number
          posts: number
          registrations: number
          replies: number
          week_start: string
        }[]
      }
      announcement_for_me: {
        Args: { a: Database["public"]["Tables"]["announcements"]["Row"] }
        Returns: boolean
      }
      assign_student_batch: {
        Args: { p_batch_id: string; p_user_id: string }
        Returns: undefined
      }
      audience_includes: {
        Args: {
          p_all: boolean
          p_department: string
          p_departments: string[]
          p_year: number
          p_years: number[]
        }
        Returns: boolean
      }
      batch_attendance_overview: {
        Args: { p_batch_id: string }
        Returns: {
          attended: number
          avatar_url: string
          current_streak: number
          full_name: string
          held: number
          last_alert_at: string
          student_id: string
          username: string
        }[]
      }
      campus_time_label: { Args: { p_at: string }; Returns: string }
      can_handle_ticket: { Args: { p_ticket_id: string }; Returns: boolean }
      can_manage_event: { Args: { p_event_id: string }; Returns: boolean }
      can_manage_form: { Args: { p_form_id: string }; Returns: boolean }
      can_message: { Args: { p_conversation_id: string }; Returns: boolean }
      can_place_event_in: { Args: { p_space_id: string }; Returns: boolean }
      can_post_in_space: { Args: { p_space_id: string }; Returns: boolean }
      can_post_opportunity: {
        Args: { p_department_id: string }
        Returns: boolean
      }
      can_review_event_space: { Args: { p_space_id: string }; Returns: boolean }
      can_see_form_results: { Args: { p_form_id: string }; Returns: boolean }
      can_take_register: { Args: { p_session_id: string }; Returns: boolean }
      can_view_batch_timetable: {
        Args: { p_batch_id: string }
        Returns: boolean
      }
      can_view_post: { Args: { p_post_id: string }; Returns: boolean }
      can_view_resource: { Args: { p_resource_id: string }; Returns: boolean }
      can_view_space: { Args: { p_space_id: string }; Returns: boolean }
      cancel_class_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: undefined
      }
      cancel_mentorship_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      cancel_registration: { Args: { p_event_id: string }; Returns: undefined }
      check_attendance_streaks: { Args: never; Returns: number }
      claim_ai_index_batch: {
        Args: { p_limit?: number; p_newest_first?: boolean }
        Returns: {
          source_id: string
          source_type: string
        }[]
      }
      claim_email_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          template: string
          to_email: string
          to_user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clean_text_list: {
        Args: { p_items: string[]; p_max_len: number }
        Returns: string[]
      }
      cleanup_notifications: { Args: never; Returns: undefined }
      consume_ai_quota: {
        Args: { p_kind: string; p_limit: number }
        Returns: number
      }
      correct_attendance: {
        Args: {
          p_present: boolean
          p_reason: string
          p_session_id: string
          p_student_id: string
        }
        Returns: undefined
      }
      create_batch: {
        Args: { p_department_id: string; p_number: number }
        Returns: string
      }
      create_ticket: {
        Args: {
          p_anonymous: boolean
          p_body: string
          p_category: string
          p_kind: string
          p_route_to: string
          p_subject: string
        }
        Returns: string
      }
      current_profile: {
        Args: never
        Returns: {
          department_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
        }[]
      }
      decide_deletion_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string }
        Returns: string
      }
      decide_join_request: {
        Args: { p_approve: boolean; p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      delete_content: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      delete_form: { Args: { p_form_id: string }; Returns: undefined }
      delete_opportunity: { Args: { p_id: string }; Returns: undefined }
      delete_timetable_entry: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      display_name: { Args: { p_user_id: string }; Returns: string }
      end_mentorship: { Args: { p_request_id: string }; Returns: undefined }
      end_suspensions: { Args: never; Returns: number }
      enqueue_event_reminders: { Args: never; Returns: number }
      event_attendees: {
        Args: { p_event_id: string }
        Returns: {
          cancelled_at: string
          department_name: string
          full_name: string
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          user_id: string
          username: string
          waitlist_position: number
          year_of_study: number
        }[]
      }
      event_eligible: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      form_response_counts: {
        Args: { p_form_id: string }
        Returns: {
          batch_id: string
          batch_name: string
          responded: number
          students: number
        }[]
      }
      form_targets_me: {
        Args: { p_batch_ids: string[]; p_department_id: string }
        Returns: boolean
      }
      generate_class_sessions: {
        Args: { p_entry_id: string }
        Returns: undefined
      }
      handles_ticket_scope: {
        Args: { p_department_id: string; p_route_to: string }
        Returns: boolean
      }
      has_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      is_approved: { Args: never; Returns: boolean }
      is_blocked: { Args: { a: string; b: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_space_moderator: { Args: { p_space_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      list_announcements: {
        Args: {
          p_category?: Database["public"]["Enums"]["announcement_category"]
          p_limit?: number
          p_offset?: number
          p_scope?: string
        }
        Returns: {
          audience_all: boolean
          audience_department_ids: string[]
          audience_years: number[]
          category: Database["public"]["Enums"]["announcement_category"]
          edited_at: string
          excerpt: string
          for_me: boolean
          id: string
          is_important: boolean
          is_pinned: boolean
          is_read: boolean
          published_at: string
          publisher_id: string
          publisher_name: string
          publisher_role: Database["public"]["Enums"]["user_role"]
          publishing_unit: string
          title: string
        }[]
      }
      list_mentors: {
        Args: {
          p_accepting?: boolean
          p_department?: string
          p_query?: string
          p_subject?: string
          p_year?: number
        }
        Returns: {
          about: string
          active_mentee_count: number
          availability_note: string
          avatar_url: string
          department_id: string
          department_name: string
          full_name: string
          headline: string
          is_accepting: boolean
          max_active_mentees: number
          my_request_status: Database["public"]["Enums"]["mentorship_status"]
          request_block_reason: string
          skills: string[]
          subjects: string[]
          user_id: string
          username: string
          year_of_study: number
        }[]
      }
      manages_batch: { Args: { p_batch_id: string }; Returns: boolean }
      manages_department: {
        Args: { p_department_id: string }
        Returns: boolean
      }
      mark_all_announcements_read: { Args: never; Returns: number }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_attendance: { Args: { p_session_id: string }; Returns: string }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      match_chunks: {
        Args: { p_count?: number; p_embedding: string; p_types?: string[] }
        Returns: {
          chunk_index: number
          content: string
          id: string
          parent_id: string
          similarity: number
          source_date: string
          source_id: string
          source_type: string
          title: string
        }[]
      }
      mentor_request_block_reason: {
        Args: { p_mentor_id: string }
        Returns: string
      }
      mentor_subjects: {
        Args: { p_limit?: number }
        Returns: {
          mentors: number
          subject: string
        }[]
      }
      merge_tags: {
        Args: { p_from: string; p_into: string }
        Returns: undefined
      }
      moderate_post: {
        Args: {
          p_action: string
          p_post_id: string
          p_reason?: string
          p_space_id?: string
        }
        Returns: undefined
      }
      moderate_reply: {
        Args: { p_action: string; p_reason?: string; p_reply_id: string }
        Returns: undefined
      }
      moderate_report: {
        Args: {
          p_action: string
          p_note: string
          p_report_id: string
          p_until?: string
        }
        Returns: undefined
      }
      move_class_session: {
        Args: {
          p_ends_at: string
          p_reason: string
          p_room: string
          p_session_id: string
          p_starts_at: string
        }
        Returns: undefined
      }
      my_attendance: {
        Args: never
        Returns: {
          ends_at: string
          module_code: string
          module_name: string
          present: boolean
          session_id: string
          source: string
          starts_at: string
        }[]
      }
      my_batch_id: { Args: never; Returns: string }
      my_conversations: {
        Args: never
        Returns: {
          conversation_id: string
          i_am_mentor: boolean
          last_body: string
          last_deleted: boolean
          last_message_at: string
          last_sender_id: string
          mentorship_status: Database["public"]["Enums"]["mentorship_status"]
          partner_avatar: string
          partner_id: string
          partner_name: string
          partner_username: string
          request_id: string
          topic: string
          unread_count: number
        }[]
      }
      my_event_placements: {
        Args: never
        Returns: {
          name: string
          needs_review: boolean
          space_id: string
          type: Database["public"]["Enums"]["space_type"]
        }[]
      }
      my_profile: {
        Args: never
        Returns: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          batch_assigned_at: string | null
          batch_id: string | null
          bio: string | null
          created_at: string
          department_id: string | null
          expertise: string[]
          full_name: string
          id: string
          interests: string[]
          last_seen_at: string | null
          mentorship_requests_from: Database["public"]["Enums"]["request_permission"]
          onboarding_completed: boolean
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          requested_role: Database["public"]["Enums"]["requested_role"]
          role: Database["public"]["Enums"]["user_role"]
          show_year: boolean
          status: Database["public"]["Enums"]["account_status"]
          status_reason: string | null
          suspended_until: string | null
          updated_at: string
          username: string
          year_of_study: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notification_recipients: {
        Args: {
          p_actor_id: string
          p_any_status: boolean
          p_type: string
          p_user_ids: string[]
        }
        Returns: {
          email: boolean
          in_app: boolean
          user_id: string
        }[]
      }
      notify: {
        Args: {
          p_actor_id?: string
          p_allow_email?: boolean
          p_any_status?: boolean
          p_body?: string
          p_email_payload?: Json
          p_entity_id?: string
          p_entity_type?: string
          p_link?: string
          p_title: string
          p_type: string
          p_user_ids: string[]
        }
        Returns: number
      }
      notify_class_change: {
        Args: { p_body: string; p_session_id: string; p_title: string }
        Returns: undefined
      }
      notify_moderators_of_report: {
        Args: { p_report: Database["public"]["Tables"]["reports"]["Row"] }
        Returns: undefined
      }
      open_ticket_count: { Args: never; Returns: number }
      opportunity_for_me: {
        Args: { p_batch_ids: string[]; p_department_id: string }
        Returns: boolean
      }
      owns_ticket: { Args: { p_ticket_id: string }; Returns: boolean }
      profile_visible_details: {
        Args: { p_user_id: string }
        Returns: {
          bio: string
          expertise: string[]
          interests: string[]
          year_of_study: number
        }[]
      }
      promote_waitlist: { Args: { p_event_id: string }; Returns: number }
      publish_scheduled_announcements: { Args: never; Returns: number }
      record_resource_download: {
        Args: { p_resource_id: string }
        Returns: undefined
      }
      register_for_event: {
        Args: { p_event_id: string }
        Returns: {
          status: Database["public"]["Enums"]["registration_status"]
          waitlist_position: number
        }[]
      }
      related_questions: {
        Args: { p_count?: number; p_embedding: string; p_exclude?: string }
        Returns: {
          post_id: string
          similarity: number
        }[]
      }
      related_to_post: {
        Args: { p_count?: number; p_post_id: string }
        Returns: {
          post_id: string
          similarity: number
        }[]
      }
      renumber_waitlist: { Args: { p_event_id: string }; Returns: undefined }
      reply_ticket: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: undefined
      }
      report_content: {
        Args: {
          p_details?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
          p_target_id: string
          p_target_type: Database["public"]["Enums"]["report_target"]
        }
        Returns: string
      }
      report_target_info: {
        Args: {
          p_id: string
          p_type: Database["public"]["Enums"]["report_target"]
        }
        Returns: {
          author_id: string
          excerpt: string
          link: string
          space_id: string
          title: string
        }[]
      }
      request_mentorship: {
        Args: { p_mentor_id: string; p_message: string; p_topic: string }
        Returns: string
      }
      request_outbox_run: { Args: never; Returns: undefined }
      request_reindex_run: { Args: never; Returns: undefined }
      respond_mentorship_request: {
        Args: { p_accept: boolean; p_note?: string; p_request_id: string }
        Returns: string
      }
      restore_class_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      review_event: {
        Args: { p_approve: boolean; p_event_id: string; p_note?: string }
        Returns: undefined
      }
      review_resource: {
        Args: { p_approve: boolean; p_note?: string; p_resource_id: string }
        Returns: undefined
      }
      save_form: {
        Args: {
          p_about_lecturer_id: string
          p_batch_ids: string[]
          p_closes_at: string
          p_department_id: string
          p_description: string
          p_form_id: string
          p_questions: Json
          p_title: string
        }
        Returns: string
      }
      save_opportunity: {
        Args: {
          p_apply_email: string
          p_apply_url: string
          p_batch_ids: string[]
          p_company: string
          p_deadline: string
          p_department_id: string
          p_description: string
          p_id: string
          p_location: string
          p_mode: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      save_timetable_entry: {
        Args: {
          p_batch_id: string
          p_end_time: string
          p_ends_on: string
          p_entry_id: string
          p_lecturer_id: string
          p_module_code: string
          p_module_name: string
          p_room: string
          p_start_time: string
          p_starts_on: string
          p_weekday: number
        }
        Returns: string
      }
      search_all: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query: string
          p_since?: string
          p_sort?: string
          p_types?: string[]
        }
        Returns: {
          context: string
          created_at: string
          id: string
          kind: string
          rank: number
          snippet: string
          title: string
          url: string
        }[]
      }
      set_batch_lecturer: {
        Args: { p_assign: boolean; p_batch_id: string; p_lecturer_id: string }
        Returns: undefined
      }
      set_batch_rep: {
        Args: { p_batch_id: string; p_user_id: string }
        Returns: undefined
      }
      set_cron_config: {
        Args: { p_app_url: string; p_cron_secret: string }
        Returns: undefined
      }
      set_form_status: {
        Args: { p_form_id: string; p_status: string }
        Returns: undefined
      }
      set_opportunity_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      set_space_moderator: {
        Args: { p_moderator: boolean; p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      set_space_role: {
        Args: {
          p_role: Database["public"]["Enums"]["member_role"]
          p_space_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      set_ticket_status: {
        Args: { p_note: string; p_status: string; p_ticket_id: string }
        Returns: undefined
      }
      submit_form: {
        Args: { p_answers: Json; p_form_id: string }
        Returns: undefined
      }
      sync_auto_memberships: { Args: { p_user_id: string }; Returns: undefined }
      teaches_batch: { Args: { p_batch_id: string }; Returns: boolean }
      ticket_handlers: { Args: { p_ticket_id: string }; Returns: string[] }
      unpin_expired_announcements: { Args: never; Returns: number }
      unread_announcement_count: { Args: never; Returns: number }
      unread_conversation_count: { Args: never; Returns: number }
      update_space_details: {
        Args: {
          p_description: string
          p_join_policy: Database["public"]["Enums"]["join_policy"]
          p_rules: string
          p_space_id: string
        }
        Returns: undefined
      }
      user_can_view_space: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "suspended"
      announcement_category:
        | "academic"
        | "deadline"
        | "general"
        | "event"
        | "urgent"
      bookmark_target:
        | "post"
        | "event"
        | "announcement"
        | "resource"
        | "opportunity"
      chunk_source: "post" | "reply" | "resource" | "announcement" | "event"
      content_status: "visible" | "hidden" | "removed" | "deleted"
      email_status: "queued" | "sent" | "failed"
      event_category:
        | "academic"
        | "career"
        | "workshop"
        | "social"
        | "cultural"
        | "sports"
        | "club"
        | "other"
      event_format: "in_person" | "online" | "hybrid"
      event_status:
        | "draft"
        | "pending_review"
        | "rejected"
        | "published"
        | "cancelled"
      join_policy: "open" | "approval"
      member_role: "member" | "moderator" | "captain"
      member_status: "active" | "pending" | "banned"
      mentorship_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
        | "ended"
      moderation_action_type:
        | "approve_account"
        | "reject_account"
        | "change_role"
        | "suspend_user"
        | "unsuspend_user"
        | "warn_user"
        | "hide_content"
        | "remove_content"
        | "restore_content"
        | "lock_post"
        | "unlock_post"
        | "pin_post"
        | "unpin_post"
        | "move_post"
        | "ban_from_space"
        | "approve_member"
        | "reject_member"
        | "approve_resource"
        | "reject_resource"
        | "dismiss_report"
        | "delete_account"
        | "assign_batch"
        | "assign_lecturer"
        | "remove_lecturer"
        | "set_class_rep"
        | "set_space_role"
        | "approve_event"
        | "reject_event"
      notify_level: "all" | "important" | "muted"
      post_type: "discussion" | "question"
      publish_status: "draft" | "scheduled" | "published" | "archived"
      registration_status: "registered" | "waitlisted" | "cancelled"
      report_reason:
        | "spam"
        | "harassment"
        | "hate"
        | "misinformation"
        | "impersonation"
        | "inappropriate"
        | "privacy"
        | "other"
      report_status: "open" | "resolved" | "dismissed"
      report_target:
        | "post"
        | "reply"
        | "resource"
        | "message"
        | "event"
        | "announcement"
        | "user"
        | "space"
      request_permission: "everyone" | "department" | "nobody"
      requested_role: "student" | "staff"
      resource_kind: "file" | "link"
      review_status: "pending" | "approved" | "rejected"
      space_type: "department" | "batch" | "module" | "club" | "general"
      user_role: "student" | "lecturer" | "coordinator" | "super_admin"
      visibility_level: "everyone" | "department" | "only_me"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["pending", "approved", "rejected", "suspended"],
      announcement_category: [
        "academic",
        "deadline",
        "general",
        "event",
        "urgent",
      ],
      bookmark_target: [
        "post",
        "event",
        "announcement",
        "resource",
        "opportunity",
      ],
      chunk_source: ["post", "reply", "resource", "announcement", "event"],
      content_status: ["visible", "hidden", "removed", "deleted"],
      email_status: ["queued", "sent", "failed"],
      event_category: [
        "academic",
        "career",
        "workshop",
        "social",
        "cultural",
        "sports",
        "club",
        "other",
      ],
      event_format: ["in_person", "online", "hybrid"],
      event_status: [
        "draft",
        "pending_review",
        "rejected",
        "published",
        "cancelled",
      ],
      join_policy: ["open", "approval"],
      member_role: ["member", "moderator", "captain"],
      member_status: ["active", "pending", "banned"],
      mentorship_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "ended",
      ],
      moderation_action_type: [
        "approve_account",
        "reject_account",
        "change_role",
        "suspend_user",
        "unsuspend_user",
        "warn_user",
        "hide_content",
        "remove_content",
        "restore_content",
        "lock_post",
        "unlock_post",
        "pin_post",
        "unpin_post",
        "move_post",
        "ban_from_space",
        "approve_member",
        "reject_member",
        "approve_resource",
        "reject_resource",
        "dismiss_report",
        "delete_account",
        "assign_batch",
        "assign_lecturer",
        "remove_lecturer",
        "set_class_rep",
        "set_space_role",
        "approve_event",
        "reject_event",
      ],
      notify_level: ["all", "important", "muted"],
      post_type: ["discussion", "question"],
      publish_status: ["draft", "scheduled", "published", "archived"],
      registration_status: ["registered", "waitlisted", "cancelled"],
      report_reason: [
        "spam",
        "harassment",
        "hate",
        "misinformation",
        "impersonation",
        "inappropriate",
        "privacy",
        "other",
      ],
      report_status: ["open", "resolved", "dismissed"],
      report_target: [
        "post",
        "reply",
        "resource",
        "message",
        "event",
        "announcement",
        "user",
        "space",
      ],
      request_permission: ["everyone", "department", "nobody"],
      requested_role: ["student", "staff"],
      resource_kind: ["file", "link"],
      review_status: ["pending", "approved", "rejected"],
      space_type: ["department", "batch", "module", "club", "general"],
      user_role: ["student", "lecturer", "coordinator", "super_admin"],
      visibility_level: ["everyone", "department", "only_me"],
    },
  },
} as const
