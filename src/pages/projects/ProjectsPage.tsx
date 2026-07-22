import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, isOverdue } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge, PriorityBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, FolderKanban, AlertCircle } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Project = Database['public']['Tables']['projects']['Row']
type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectStatus = Project['status']
type Priority = Project['priority']
type Client = Database['public']['Tables']['clients']['Row']

const STATUS_OPTIONS: ProjectStatus[] = ['discovery', 'planning', 'development', 'testing', 'deployment', 'maintenance', 'completed']
const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high']

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState<(Project & { client?: { company_name: string } | null })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProjectInsert>(defaultForm())

  function defaultForm(): ProjectInsert {
    return { name: '', client_id: null, service: '', description: '', start_date: null, deadline: null, priority: 'medium', status: 'discovery', progress: 0 }
  }

  const loadProjects = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('projects').select('*, client:clients(company_name)').is('deleted_at', null).order('deadline', { nullsFirst: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as ProjectStatus)
    if (search) query = query.ilike('name', `%${search}%`)
    const { data } = await query
    setProjects(data || [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    supabase.from('clients').select('id, company_name').eq('status', 'active').is('deleted_at', null).order('company_name')
      .then(({ data }) => setClients((data || []) as Client[]))
  }, [])

  async function handleSave() {
    if (!form.name?.trim()) return
    setSaving(true)
    const { data } = await supabase.from('projects').insert({ ...form, created_by: user?.id }).select().single()
    if (data) await logActivity({ module: 'projects', activity_type: 'created', description: `Project ${form.name} dibuat`, entity_id: data.id, entity_type: 'project' })
    setShowForm(false)
    setSaving(false)
    loadProjects()
  }

  const overdueProjects = projects.filter(p => p.deadline && isOverdue(p.deadline) && p.status !== 'completed')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Kelola seluruh project Centrova"
        action={{ label: 'New Project', onClick: () => { setForm(defaultForm()); setShowForm(true) }, icon: <Plus className="size-4" /> }}
      />

      {overdueProjects.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{overdueProjects.length} project melewati deadline</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari project..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Deadline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FolderKanban className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada project</p>
                </TableCell>
              </TableRow>
            ) : (
              projects.map(project => (
                <TableRow key={project.id} className="cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.service && <p className="text-xs text-muted-foreground">{project.service}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{project.client?.company_name || '-'}</TableCell>
                  <TableCell><StatusBadge status={project.status} type="project" /></TableCell>
                  <TableCell><PriorityBadge priority={project.priority} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-24">
                      <Progress value={project.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground shrink-0">{project.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.deadline ? (
                      <span className={`text-sm ${isOverdue(project.deadline) && project.status !== 'completed' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {formatDate(project.deadline)}
                      </span>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Project Name *</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama project" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={form.client_id || ''} onValueChange={v => setForm(f => ({ ...f, client_id: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Service</Label>
                <Input value={form.service || ''} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="Web Development" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={form.priority || 'medium'} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status || 'discovery'} onValueChange={v => setForm(f => ({ ...f, status: v as ProjectStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value || null }))} /></div>
              <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={form.deadline || ''} onChange={e => setForm(f => ({ ...f, deadline: e.target.value || null }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name?.trim()}>{saving ? 'Saving...' : 'Create Project'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
