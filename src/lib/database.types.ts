export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_name: string
          pic_name: string | null
          email: string | null
          whatsapp: string | null
          website: string | null
          industry: string | null
          address: string | null
          notes: string | null
          status: 'prospect' | 'active' | 'completed' | 'inactive'
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          company_name: string
          pic_name?: string | null
          email?: string | null
          whatsapp?: string | null
          website?: string | null
          industry?: string | null
          address?: string | null
          notes?: string | null
          status?: 'prospect' | 'active' | 'completed' | 'inactive'
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          company_name?: string
          pic_name?: string | null
          email?: string | null
          whatsapp?: string | null
          website?: string | null
          industry?: string | null
          address?: string | null
          notes?: string | null
          status?: 'prospect' | 'active' | 'completed' | 'inactive'
          updated_at?: string
          deleted_at?: string | null
        }
      }
      client_timeline: {
        Row: {
          id: string
          client_id: string
          type: 'meeting' | 'proposal' | 'negotiation' | 'agreement' | 'note'
          title: string
          description: string | null
          event_date: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          type: 'meeting' | 'proposal' | 'negotiation' | 'agreement' | 'note'
          title: string
          description?: string | null
          event_date?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          type?: 'meeting' | 'proposal' | 'negotiation' | 'agreement' | 'note'
          title?: string
          description?: string | null
          event_date?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          client_id: string | null
          service: string | null
          description: string | null
          start_date: string | null
          deadline: string | null
          priority: 'low' | 'medium' | 'high'
          status: 'discovery' | 'planning' | 'development' | 'testing' | 'deployment' | 'maintenance' | 'completed'
          progress: number
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          client_id?: string | null
          service?: string | null
          description?: string | null
          start_date?: string | null
          deadline?: string | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'discovery' | 'planning' | 'development' | 'testing' | 'deployment' | 'maintenance' | 'completed'
          progress?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          client_id?: string | null
          service?: string | null
          description?: string | null
          start_date?: string | null
          deadline?: string | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'discovery' | 'planning' | 'development' | 'testing' | 'deployment' | 'maintenance' | 'completed'
          progress?: number
          updated_at?: string
          deleted_at?: string | null
        }
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          deadline: string | null
          status: 'planned' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          progress: number
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          deadline?: string | null
          status?: 'planned' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          progress?: number
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          deadline?: string | null
          status?: 'planned' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          progress?: number
          sort_order?: number
          updated_at?: string
        }
      }
      deliverables: {
        Row: {
          id: string
          project_id: string
          milestone_id: string | null
          name: string
          description: string | null
          type: 'website' | 'web_app' | 'mobile_app' | 'ui_design' | 'api' | 'documentation' | 'other'
          due_date: string | null
          status: 'pending' | 'in_development' | 'ready_for_review' | 'approved' | 'delivered'
          notes: string | null
          link_url: string | null
          file_path: string | null
          file_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          milestone_id?: string | null
          name: string
          description?: string | null
          type?: 'website' | 'web_app' | 'mobile_app' | 'ui_design' | 'api' | 'documentation' | 'other'
          due_date?: string | null
          status?: 'pending' | 'in_development' | 'ready_for_review' | 'approved' | 'delivered'
          notes?: string | null
          link_url?: string | null
          file_path?: string | null
          file_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          project_id?: string
          milestone_id?: string | null
          name?: string
          description?: string | null
          type?: 'website' | 'web_app' | 'mobile_app' | 'ui_design' | 'api' | 'documentation' | 'other'
          due_date?: string | null
          status?: 'pending' | 'in_development' | 'ready_for_review' | 'approved' | 'delivered'
          notes?: string | null
          link_url?: string | null
          file_path?: string | null
          file_url?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      meeting_notes: {
        Row: {
          id: string
          project_id: string
          title: string
          meeting_date: string
          location: string | null
          participants: string[]
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          meeting_date: string
          location?: string | null
          participants?: string[]
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          meeting_date?: string
          location?: string | null
          participants?: string[]
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      meeting_decisions: {
        Row: {
          id: string
          meeting_id: string
          decision: string
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          decision: string
          created_at?: string
        }
        Update: {
          decision?: string
        }
      }
      meeting_action_items: {
        Row: {
          id: string
          meeting_id: string
          task_id: string | null
          description: string
          assignee: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          task_id?: string | null
          description: string
          assignee?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          task_id?: string | null
          description?: string
          assignee?: string | null
          completed?: boolean
        }
      }
      project_notes: {
        Row: {
          id: string
          project_id: string
          title: string
          content: string | null
          category: 'technical' | 'business' | 'client' | 'internal' | 'deployment' | 'miscellaneous'
          tags: string[]
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          content?: string | null
          category?: 'technical' | 'business' | 'client' | 'internal' | 'deployment' | 'miscellaneous'
          tags?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          content?: string | null
          category?: 'technical' | 'business' | 'client' | 'internal' | 'deployment' | 'miscellaneous'
          tags?: string[]
          updated_at?: string
          deleted_at?: string | null
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string | null
          title: string
          description: string | null
          deadline: string | null
          priority: 'low' | 'medium' | 'high'
          assignee: string | null
          status: 'todo' | 'in_progress' | 'review' | 'done'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          title: string
          description?: string | null
          deadline?: string | null
          priority?: 'low' | 'medium' | 'high'
          assignee?: string | null
          status?: 'todo' | 'in_progress' | 'review' | 'done'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          project_id?: string | null
          title?: string
          description?: string | null
          deadline?: string | null
          priority?: 'low' | 'medium' | 'high'
          assignee?: string | null
          status?: 'todo' | 'in_progress' | 'review' | 'done'
          updated_at?: string
        }
      }
      subtasks: {
        Row: {
          id: string
          task_id: string
          title: string
          completed: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          completed?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          title?: string
          completed?: boolean
          sort_order?: number
        }
      }
      task_checklists: {
        Row: {
          id: string
          task_id: string
          title: string
          completed: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          completed?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          title?: string
          completed?: boolean
          sort_order?: number
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          client_id: string | null
          project_id: string | null
          issue_date: string
          due_date: string
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          subtotal: number
          discount: number
          tax_rate: number
          tax_amount: number
          total: number
          notes: string | null
          payment_notes: string | null
          payment_proof_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          invoice_number: string
          client_id?: string | null
          project_id?: string | null
          issue_date: string
          due_date: string
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          subtotal?: number
          discount?: number
          tax_rate?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          invoice_number?: string
          client_id?: string | null
          project_id?: string | null
          issue_date?: string
          due_date?: string
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          subtotal?: number
          discount?: number
          tax_rate?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          discount: number
          total: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity?: number
          unit_price?: number
          discount?: number
          total?: number
          sort_order?: number
          created_at?: string
        }
        Update: {
          description?: string
          quantity?: number
          unit_price?: number
          discount?: number
          total?: number
          sort_order?: number
        }
      }
      documents: {
        Row: {
          id: string
          name: string
          original_name: string | null
          file_url: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          category: 'client' | 'proposal' | 'contract' | 'nda' | 'invoice' | 'legal' | 'internal'
          client_id: string | null
          project_id: string | null
          invoice_id: string | null
          tags: string[] | null
          uploaded_by: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          original_name?: string | null
          file_url: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          category?: 'client' | 'proposal' | 'contract' | 'nda' | 'invoice' | 'legal' | 'internal'
          client_id?: string | null
          project_id?: string | null
          invoice_id?: string | null
          tags?: string[] | null
          uploaded_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          original_name?: string | null
          file_url?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          category?: 'client' | 'proposal' | 'contract' | 'nda' | 'invoice' | 'legal' | 'internal'
          client_id?: string | null
          project_id?: string | null
          invoice_id?: string | null
          tags?: string[] | null
          deleted_at?: string | null
        }
      }
      assets: {
        Row: {
          id: string
          name: string
          category: string
          brand: string | null
          model: string | null
          serial_number: string | null
          purchase_date: string | null
          purchase_price: number
          warranty_expiration: string | null
          condition: string | null
          status: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          category?: string
          brand?: string | null
          model?: string | null
          serial_number?: string | null
          purchase_date?: string | null
          purchase_price?: number
          warranty_expiration?: string | null
          condition?: string | null
          status?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          category?: string
          brand?: string | null
          model?: string | null
          serial_number?: string | null
          purchase_date?: string | null
          purchase_price?: number
          warranty_expiration?: string | null
          condition?: string | null
          status?: string
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      software_licenses: {
        Row: {
          id: string
          name: string
          vendor: string | null
          license_type: string
          billing_cycle: string | null
          renewal_date: string | null
          cost: number
          status: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          vendor?: string | null
          license_type?: string
          billing_cycle?: string | null
          renewal_date?: string | null
          cost?: number
          status?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          vendor?: string | null
          license_type?: string
          billing_cycle?: string | null
          renewal_date?: string | null
          cost?: number
          status?: string
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      company_accounts: {
        Row: {
          id: string
          account_name: string
          platform: string | null
          category: string
          email: string | null
          username: string | null
          recovery_email: string | null
          description: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          account_name: string
          platform?: string | null
          category?: string
          email?: string | null
          username?: string | null
          recovery_email?: string | null
          description?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          account_name?: string
          platform?: string | null
          category?: string
          email?: string | null
          username?: string | null
          recovery_email?: string | null
          description?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      legal_documents: {
        Row: {
          id: string
          title: string
          category: string
          document_number: string | null
          issue_date: string | null
          expiration_date: string | null
          file_url: string | null
          file_path: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          title: string
          category?: string
          document_number?: string | null
          issue_date?: string | null
          expiration_date?: string | null
          file_url?: string | null
          file_path?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          category?: string
          document_number?: string | null
          issue_date?: string | null
          expiration_date?: string | null
          file_url?: string | null
          file_path?: string | null
          notes?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      company_profile: {
        Row: {
          id: string
          name: string
          legal_entity: string | null
          npwp: string | null
          nib: string | null
          address: string | null
          email: string | null
          phone: string | null
          website: string | null
          logo_url: string | null
          brand_guidelines_url: string | null
          company_profile_url: string | null
          description: string | null
          instagram: string | null
          linkedin: string | null
          threads: string | null
          bluesky: string | null
          youtube: string | null
          bank_name: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          legal_entity?: string | null
          npwp?: string | null
          nib?: string | null
          address?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          logo_url?: string | null
          brand_guidelines_url?: string | null
          company_profile_url?: string | null
          description?: string | null
          instagram?: string | null
          linkedin?: string | null
          threads?: string | null
          bluesky?: string | null
          youtube?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          name?: string
          legal_entity?: string | null
          npwp?: string | null
          nib?: string | null
          address?: string | null
          email?: string | null
          phone?: string | null
          website?: string | null
          logo_url?: string | null
          brand_guidelines_url?: string | null
          company_profile_url?: string | null
          description?: string | null
          instagram?: string | null
          linkedin?: string | null
          threads?: string | null
          bluesky?: string | null
          youtube?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          module: 'auth' | 'clients' | 'projects' | 'tasks' | 'invoices' | 'documents' | 'system' | 'finance' | 'delivery' | 'company' | 'knowledge' | 'ai'
          activity_type: string
          description: string
          entity_id: string | null
          entity_type: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          module: 'auth' | 'clients' | 'projects' | 'tasks' | 'invoices' | 'documents' | 'system' | 'finance' | 'delivery' | 'company' | 'knowledge' | 'ai'
          activity_type: string
          description: string
          entity_id?: string | null
          entity_type?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          description?: string
          metadata?: Json | null
        }
      }
      transactions: {
        Row: {
          id: string
          type: 'income' | 'expense'
          category: string
          description: string
          amount: number
          transaction_date: string
          reference: string | null
          client_id: string | null
          project_id: string | null
          invoice_id: string | null
          payment_method: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          status: 'completed' | 'pending'
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          type: 'income' | 'expense'
          category?: string
          description: string
          amount: number
          transaction_date: string
          reference?: string | null
          client_id?: string | null
          project_id?: string | null
          invoice_id?: string | null
          payment_method?: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          status?: 'completed' | 'pending'
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          type?: 'income' | 'expense'
          category?: string
          description?: string
          amount?: number
          transaction_date?: string
          reference?: string | null
          client_id?: string | null
          project_id?: string | null
          invoice_id?: string | null
          payment_method?: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          status?: 'completed' | 'pending'
          updated_at?: string
          deleted_at?: string | null
        }
      }
      recurring_expenses: {
        Row: {
          id: string
          name: string
          category: 'operational' | 'software' | 'hardware' | 'salary' | 'marketing' | 'tax' | 'office' | 'travel' | 'other'
          description: string | null
          vendor: string | null
          amount: number
          frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          start_date: string
          next_due_date: string
          end_date: string | null
          payment_method: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: 'operational' | 'software' | 'hardware' | 'salary' | 'marketing' | 'tax' | 'office' | 'travel' | 'other'
          description?: string | null
          vendor?: string | null
          amount: number
          frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          start_date: string
          next_due_date: string
          end_date?: string | null
          payment_method?: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          category?: 'operational' | 'software' | 'hardware' | 'salary' | 'marketing' | 'tax' | 'office' | 'travel' | 'other'
          description?: string | null
          vendor?: string | null
          amount?: number
          frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          start_date?: string
          next_due_date?: string
          end_date?: string | null
          payment_method?: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          is_active?: boolean
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          category: 'operational' | 'software' | 'hardware' | 'salary' | 'marketing' | 'tax' | 'office' | 'travel' | 'other'
          description: string
          vendor: string | null
          amount: number
          expense_date: string
          payment_method: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          receipt_url: string | null
          receipt_file_path: string | null
          is_recurring: boolean
          recurring_expense_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          category?: 'operational' | 'software' | 'hardware' | 'salary' | 'marketing' | 'tax' | 'office' | 'travel' | 'other'
          description: string
          vendor?: string | null
          amount: number
          expense_date: string
          payment_method?: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          receipt_url?: string | null
          receipt_file_path?: string | null
          is_recurring?: boolean
          recurring_expense_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          category?: 'operational' | 'software' | 'hardware' | 'salary' | 'marketing' | 'tax' | 'office' | 'travel' | 'other'
          description?: string
          vendor?: string | null
          amount?: number
          expense_date?: string
          payment_method?: 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other'
          receipt_url?: string | null
          receipt_file_path?: string | null
          is_recurring?: boolean
          recurring_expense_id?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      knowledge_articles: {
        Row: {
          id: string
          title: string
          content: string
          category: string
          tags: string[]
          status: string
          related_project_id: string | null
          related_client_id: string | null
          views: number
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          title: string
          content?: string
          category?: string
          tags?: string[]
          status?: string
          related_project_id?: string | null
          related_client_id?: string | null
          views?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          content?: string
          category?: string
          tags?: string[]
          status?: string
          related_project_id?: string | null
          related_client_id?: string | null
          views?: number
          updated_at?: string
          deleted_at?: string | null
        }
      }
      templates: {
        Row: {
          id: string
          name: string
          category: string
          content: string
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          category?: string
          content?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          category?: string
          content?: string
          is_active?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
      }
      service_catalog: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          billing_type: string
          default_price: number
          unit: string | null
          notes: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string
          billing_type?: string
          default_price?: number
          unit?: string | null
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          category?: string
          billing_type?: string
          default_price?: number
          unit?: string | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
      }
      ai_settings: {
        Row: {
          id: string
          provider: string
          model_name: string
          base_url: string
          api_key: string | null
          max_tokens: number
          temperature: number
          top_p: number
          system_prompt: string
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          provider?: string
          model_name?: string
          base_url?: string
          api_key?: string | null
          max_tokens?: number
          temperature?: number
          top_p?: number
          system_prompt?: string
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          provider?: string
          model_name?: string
          base_url?: string
          api_key?: string | null
          max_tokens?: number
          temperature?: number
          top_p?: number
          system_prompt?: string
          updated_by?: string | null
          updated_at?: string
        }
      }
      ai_chats: {
        Row: {
          id: string
          title: string
          is_favorite: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          title?: string
          is_favorite?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          is_favorite?: boolean
          updated_at?: string
          deleted_at?: string | null
        }
      }
      ai_messages: {
        Row: {
          id: string
          chat_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          role?: string
          content: string
          created_at?: string
        }
        Update: {
          role?: string
          content?: string
        }
      }
      invoice_versions: {
        Row: { id: string; invoice_id: string; version_number: number; snapshot: Json; items_snapshot: Json; change_summary: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; invoice_id: string; version_number?: number; snapshot: Json; items_snapshot?: Json; change_summary?: string | null; created_by?: string | null; created_at?: string }
        Update: never
      }
    }
    Functions: {
      get_next_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_next_recurring_date: {
        Args: { current_date_val: string; freq: string }
        Returns: string
      }
    }
  }
}
