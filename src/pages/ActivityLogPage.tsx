import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Search } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

type Module = ActivityLog['module']

const MODULE_COLORS: Record<Module, string> = {
  auth: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  clients: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  projects: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  tasks: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  invoices: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  documents: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  system: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  finance: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  delivery: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  company: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  knowledge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  ai: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<(ActivityLog & { profile?: Pick<Profile, 'full_name'> | null })[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  const loadLogs = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('activity_logs').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)
    if (moduleFilter !== 'all') query = query.eq('module', moduleFilter as Module)
    if (userFilter !== 'all') query = query.eq('user_id', userFilter)
    if (search) query = query.ilike('description', `%${search}%`)
    const { data } = await query
    const profRes = await supabase.from('profiles').select('*')
    const profMap = new Map((profRes.data || []).map(p => [p.id, p]))
    setProfiles(profRes.data || [])
    setLogs((data || []).map(log => ({ ...log, profile: log.user_id ? profMap.get(log.user_id) || null : null })))
    setLoading(false)
  }, [moduleFilter, userFilter, search, page])

  useEffect(() => { loadLogs() }, [loadLogs])

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Log" description="Riwayat seluruh aktivitas di sistem" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari aktivitas..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <Select value={moduleFilter} onValueChange={v => { setModuleFilter(v); setPage(0) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {(['auth','clients','projects','tasks','invoices','documents','system','finance','delivery','company','knowledge','ai'] as Module[]).map(m => (
              <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={v => { setUserFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="User" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3 mt-2" /></div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="size-8 mx-auto mb-2 opacity-30" />
            <p>Belum ada aktivitas</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Activity className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{log.description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                    {log.profile && (
                      <span className="text-xs text-muted-foreground">· {log.profile.full_name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">· {log.activity_type}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${MODULE_COLORS[log.module]}`}>
                  {log.module}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {logs.length >= PER_PAGE && (
        <div className="flex justify-center gap-2">
          <button className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
