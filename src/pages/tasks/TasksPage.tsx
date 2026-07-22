import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, isOverdue } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge, PriorityBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Calendar, CheckSquare, Trash2, Pencil } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Task = Database['public']['Tables']['tasks']['Row']
type TaskInsert = Database['public']['Tables']['tasks']['Insert']
type TaskStatus = Task['status']
type Priority = Task['priority']
type Subtask = Database['public']['Tables']['subtasks']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Project = Database['public']['Tables']['projects']['Row']

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
]

interface TaskWithRelations extends Task {
  project?: Pick<Project, 'name'> | null
  assignee_profile?: Pick<Profile, 'full_name'> | null
  subtasks?: Subtask[]
}

export function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [view, setView] = useState<'list' | 'kanban'>('kanban')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [saving, setSaving] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [form, setForm] = useState<TaskInsert>(defaultForm())

  function defaultForm(): TaskInsert {
    return { title: '', description: '', deadline: null, priority: 'medium', assignee: null, status: 'todo', project_id: null }
  }

  const loadTasks = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('tasks').select('*, project:projects(name)').order('created_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as TaskStatus)
    if (search) query = query.ilike('title', `%${search}%`)
    const { data } = await query

    const profRes = await supabase.from('profiles').select('*')
    const profs = profRes.data || []
    const profMap = new Map(profs.map(p => [p.id, p]))
    setProfiles(profs)

    const taskIds = (data || []).map(t => t.id)
    const { data: subtasksData } = taskIds.length > 0
      ? await supabase.from('subtasks').select('*').in('task_id', taskIds)
      : { data: [] }
    const subMap = new Map<string, Subtask[]>()
    ;(subtasksData || []).forEach(s => {
      if (!subMap.has(s.task_id)) subMap.set(s.task_id, [])
      subMap.get(s.task_id)!.push(s)
    })

    setTasks((data || []).map(t => ({
      ...t,
      assignee_profile: t.assignee ? profMap.get(t.assignee) || null : null,
      subtasks: subMap.get(t.id) || [],
    })))
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name')
      .then(({ data }) => setProjects((data || []) as Project[]))
  }, [])

  async function handleSave() {
    if (!form.title?.trim()) return
    setSaving(true)
    const { data } = await supabase.from('tasks').insert({ ...form, created_by: user?.id }).select().single()
    if (data) await logActivity({ module: 'tasks', activity_type: 'created', description: `Task ${form.title} dibuat`, entity_id: data.id, entity_type: 'task' })
    setShowForm(false)
    setSaving(false)
    loadTasks()
  }

  async function handleStatusChange(task: TaskWithRelations, newStatus: TaskStatus) {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (newStatus === 'done') {
      await logActivity({ module: 'tasks', activity_type: 'completed', description: `Task ${task.title} selesai`, entity_id: task.id, entity_type: 'task' })
    }
    loadTasks()
  }

  async function handleAddSubtask(taskId: string) {
    if (!newSubtask.trim()) return
    await supabase.from('subtasks').insert({ task_id: taskId, title: newSubtask })
    setNewSubtask('')
    loadTasks()
    if (selectedTask?.id === taskId) {
      const { data } = await supabase.from('subtasks').select('*').eq('task_id', taskId)
      setSelectedTask(t => t ? { ...t, subtasks: data || [] } : null)
    }
  }

  async function toggleSubtask(subtask: Subtask) {
    await supabase.from('subtasks').update({ completed: !subtask.completed }).eq('id', subtask.id)
    loadTasks()
    if (selectedTask) {
      const { data } = await supabase.from('subtasks').select('*').eq('task_id', selectedTask.id)
      setSelectedTask(t => t ? { ...t, subtasks: data || [] } : null)
    }
  }

  async function handleDeleteTask(task: TaskWithRelations) {
    await supabase.from('tasks').delete().eq('id', task.id)
    setShowDetail(false)
    loadTasks()
  }

  function openDetail(task: TaskWithRelations) {
    setSelectedTask(task)
    setShowDetail(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Kelola seluruh task dan pekerjaan"
        action={{ label: 'Add Task', onClick: () => { setForm(defaultForm()); setShowForm(true) }, icon: <Plus className="size-4" /> }}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari task..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {COLUMNS.map(c => <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tabs value={view} onValueChange={v => setView(v as 'list' | 'kanban')}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : view === 'kanban' ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.status)
            return (
              <div key={col.status} className="rounded-lg bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} className="bg-background rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openDetail(task)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{task.title}</p>
                        <PriorityBadge priority={task.priority} className="shrink-0" />
                      </div>
                      {task.project?.name && <p className="text-xs text-muted-foreground mt-1">{task.project.name}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {task.deadline && (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue(task.deadline) && task.status !== 'done' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            <Calendar className="size-3" />{formatDate(task.deadline)}
                          </span>
                        )}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span className="text-xs text-muted-foreground">{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>
                        )}
                      </div>
                      {task.assignee_profile && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">{task.assignee_profile.full_name}</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="divide-y">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckSquare className="size-8 mx-auto mb-2 opacity-30" />
                <p>Belum ada task</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => openDetail(task)}>
                  <Checkbox
                    checked={task.status === 'done'}
                    onCheckedChange={() => handleStatusChange(task, task.status === 'done' ? 'todo' : 'done')}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.project?.name && <span className="text-xs text-muted-foreground">{task.project.name}</span>}
                      {task.deadline && (
                        <span className={`text-xs ${isOverdue(task.deadline) && task.status !== 'done' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Calendar className="size-3 inline mr-0.5" />{formatDate(task.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.assignee_profile && <Badge variant="outline" className="text-xs">{task.assignee_profile.full_name}</Badge>}
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} type="task" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Task Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Title *</Label><Input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nama task" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={form.priority || 'medium'} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(['low','medium','high'] as Priority[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={form.deadline || ''} onChange={e => setForm(f => ({ ...f, deadline: e.target.value || null }))} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={form.project_id || ''} onValueChange={v => setForm(f => ({ ...f, project_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Pilih project (opsional)" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select value={form.assignee || ''} onValueChange={v => setForm(f => ({ ...f, assignee: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title?.trim()}>{saving ? 'Saving...' : 'Add Task'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      {selectedTask && (
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2 pr-6">
                <DialogTitle className="text-base">{selectedTask.title}</DialogTitle>
                <div className="flex items-center gap-1">
                  <PriorityBadge priority={selectedTask.priority} />
                  <StatusBadge status={selectedTask.status} type="task" />
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              {selectedTask.description && <p className="text-sm text-muted-foreground">{selectedTask.description}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {selectedTask.deadline && (
                  <div><span className="text-muted-foreground text-xs">Deadline</span><p className={isOverdue(selectedTask.deadline) && selectedTask.status !== 'done' ? 'text-destructive' : ''}>{formatDate(selectedTask.deadline)}</p></div>
                )}
                {selectedTask.assignee_profile && (
                  <div><span className="text-muted-foreground text-xs">Assignee</span><p>{selectedTask.assignee_profile.full_name}</p></div>
                )}
                {selectedTask.project?.name && (
                  <div><span className="text-muted-foreground text-xs">Project</span><p>{selectedTask.project.name}</p></div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {COLUMNS.map(c => (
                    <Button
                      key={c.status}
                      variant={selectedTask.status === c.status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { handleStatusChange(selectedTask, c.status); setSelectedTask(t => t ? { ...t, status: c.status } : null) }}
                    >{c.label}</Button>
                  ))}
                </div>
              </div>

              {/* Subtasks */}
              <div className="space-y-2">
                <Label className="text-sm">Subtasks</Label>
                <div className="space-y-1">
                  {(selectedTask.subtasks || []).map(sub => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <Checkbox checked={sub.completed} onCheckedChange={() => toggleSubtask(sub)} />
                      <span className={`text-sm flex-1 ${sub.completed ? 'line-through text-muted-foreground' : ''}`}>{sub.title}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add subtask..." value={newSubtask} onChange={e => setNewSubtask(e.target.value)} className="h-8 text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(selectedTask.id) }} />
                  <Button size="sm" variant="outline" onClick={() => handleAddSubtask(selectedTask.id)}><Plus className="size-3" /></Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTask(selectedTask)}>
                <Trash2 className="size-4" />Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDetail(false)}><Pencil className="size-4" />Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
