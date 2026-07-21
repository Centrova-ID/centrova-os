import { supabase } from './supabase'

type Module = 'auth' | 'clients' | 'projects' | 'tasks' | 'invoices' | 'documents' | 'system' | 'finance' | 'delivery' | 'company' | 'knowledge' | 'ai'

interface LogParams {
  module: Module
  activity_type: string
  description: string
  entity_id?: string
  entity_type?: string
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await (supabase.from('activity_logs') as ReturnType<typeof supabase.from>).insert({
    user_id: user?.id ?? null,
    module: params.module,
    activity_type: params.activity_type,
    description: params.description,
    entity_id: params.entity_id ?? null,
    entity_type: params.entity_type ?? null,
    metadata: params.metadata ?? {},
  })
}
