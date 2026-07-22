import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import {
  formatDate, isOverdue, MILESTONE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS,
  DELIVERABLE_STATUS_LABELS, PROJECT_NOTE_CATEGORY_LABELS,
} from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  ArrowLeft, Pencil, Trash2, Plus, Flag, Calendar, CheckCircle2,
  Package, FileText, Users, StickyNote, Clock, Link as LinkIcon, X,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Project = Database['public']['Tables']['projects']['Row']
type Milestone = Database['public']['Tables']['milestones']['Row']
type Task = Database['public']['Tables']['tasks']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']
type Document = Database['public']['Tables']['documents']['Row']
type Deliverable = Database['public']['Tables']['deliverables']['Row']
type MeetingNote = Database['public']['Tables']['meeting_notes']['Row']
type MeetingDecision = Database['public']['Tables']['meeting_decisions']['Row']
type MeetingActionItem = Database['public']['Tables']['meeting_action_items']['Row']
type ProjectNote = Database['public']['Tables']['project_notes']['Row']
type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
type ProjectStatus = Project['status']
type Priority = Project['priority']
type MilestoneStatus = Milestone['status']
type Profile = Database['public']['Tables']['profiles']['Row']

const MILESTONE_STATUSES: MilestoneStatus[] = ['planned', 'in_progress', 'review', 'completed', 'cancelled']
const DELIVERABLE_TYPES = Object.keys(DELIVERABLE_TYPE_LABELS)
const DELIVERABLE_STATUSES = Object.keys(DELIVERABLE_STATUS_LABELS)
const NOTE_CATEGORIES = Object.keys(PROJECT_NOTE_CATEGORY_LABELS)

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<(Project & { client?: { company_name: string } | null }) | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tasks, setTasks] = useState<(Task & { assignee_profile?: Pick<Profile, 'full_name'> | null })[]>([])
  const [_invoices, _setInvoices] = useState<Invoice[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [meetings, setMeetings] = useState<(MeetingNote & { decisions: MeetingDecision[]; action_items: MeetingActionItem[] })[]>([])
  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [timeline, setTimeline] = useState<ActivityLog[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showMilestone, setShowMilestone] = useState(false)
  const [showTask, setShowTask] = useState(false)
  const [showDeliverable, setShowDeliverable] = useState(false)
  const [showMeeting, setShowMeeting] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Project>>({})
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', deadline: '', status: 'planned' as MilestoneStatus, progress: 0 })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', deadline: '', priority: 'medium' as Task['priority'], assignee: '', status: 'todo' as Task['status'] })
  const [deliverableForm, setDeliverableForm] = useState({ name: '', description: '', type: 'website' as Deliverable['type'], due_date: '', status: 'pending' as Deliverable['status'], notes: '', link_url: '', milestone_id: '' })
  const [meetingForm, setMeetingForm] = useState({ title: '', meeting_date: new Date().toISOString().split('T')[0], location: '', participants: '', notes: '', decisions: [''], action_items: [''] as string[] })
  const [noteForm, setNoteForm] = useState({ title: '', content: '', category: 'technical' as ProjectNote['category'], tags: '' })
  const [saving, setSaving] = useState(false)

  const loadProject = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const projRes = await supabase.from('projects').select('*, client:clients(company_name)').eq('id', id).maybeSingle()
    const projectName = projRes.data?.name || ''
    const [msRes, taskRes, invRes, docRes, delivRes, meetRes, noteRes, tlRes, profRes] = await Promise.all([
      supabase.from('milestones').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('tasks').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('project_id', id).is('deleted_at', null),
      supabase.from('documents').select('*').eq('project_id', id).is('deleted_at', null),
      supabase.from('deliverables').select('*').eq('project_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('meeting_notes').select('*').eq('project_id', id).is('deleted_at', null).order('meeting_date', { ascending: false }),
      supabase.from('project_notes').select('*').eq('project_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('*').or(`entity_id.eq.${id},description.ilike.%${projectName}%`).order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*'),
    ])

    setProject(projRes.data)
    setMilestones(msRes.data || [])
    const allTasks = taskRes.data || []
    const profMap = new Map((profRes.data || []).map(p => [p.id, p]))
    setTasks(allTasks.map(t => ({ ...t, assignee_profile: t.assignee ? profMap.get(t.assignee) || null : null })))
    _setInvoices(invRes.data || [])
    setDocuments(docRes.data || [])
    setDeliverables(delivRes.data || [])

    const meetingsData = meetRes.data || []
    if (meetingsData.length > 0) {
      const meetingIds = meetingsData.map(m => m.id)
      const [decRes, actRes] = await Promise.all([
        supabase.from('meeting_decisions').select('*').in('meeting_id', meetingIds),
        supabase.from('meeting_action_items').select('*').in('meeting_id', meetingIds),
      ])
      const decMap = new Map<string, MeetingDecision[]>()
      ;(decRes.data || []).forEach(d => {
        const arr = decMap.get(d.meeting_id) || []
        arr.push(d)
        decMap.set(d.meeting_id, arr)
      })
      const actMap = new Map<string, MeetingActionItem[]>()
      ;(actRes.data || []).forEach(a => {
        const arr = actMap.get(a.meeting_id) || []
        arr.push(a)
        actMap.set(a.meeting_id, arr)
      })
      setMeetings(meetingsData.map(m => ({ ...m, decisions: decMap.get(m.id) || [], action_items: actMap.get(m.id) || [] })))
    } else {
      setMeetings([])
    }

    setNotes(noteRes.data || [])
    setTimeline(tlRes.data || [])
    setProfiles(profRes.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadProject() }, [loadProject])

  async function handleEdit() {
    if (!project) return
    setSaving(true)
    await supabase.from('projects').update({ ...editForm, updated_at: new Date().toISOString() }).eq('id', project.id)
    await logActivity({ module: 'projects', activity_type: 'updated', description: `Project ${editForm.name} diperbarui`, entity_id: project.id, entity_type: 'project' })
    setShowEdit(false)
    setSaving(false)
    loadProject()
  }

  async function handleDelete() {
    if (!project) return
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', project.id)
    await logActivity({ module: 'projects', activity_type: 'deleted', description: `Project ${project.name} dihapus`, entity_id: project.id, entity_type: 'project' })
    navigate('/projects')
  }

  async function handleAddMilestone() {
    if (!project || !milestoneForm.title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('milestones').insert({
      project_id: project.id,
      title: milestoneForm.title,
      description: milestoneForm.description || null,
      deadline: milestoneForm.deadline || null,
      status: milestoneForm.status,
      progress: milestoneForm.progress,
      sort_order: milestones.length,
    }).select().single()
    if (data) await logActivity({ module: 'delivery', activity_type: 'created', description: `Milestone ${milestoneForm.title} dibuat`, entity_id: data.id, entity_type: 'milestone' })
    setShowMilestone(false)
    setMilestoneForm({ title: '', description: '', deadline: '', status: 'planned', progress: 0 })
    setSaving(false)
    loadProject()
  }

  async function handleUpdateMilestoneStatus(ms: Milestone, newStatus: MilestoneStatus) {
    const newProgress = newStatus === 'completed' ? 100 : ms.progress
    await supabase.from('milestones').update({ status: newStatus, progress: newProgress, updated_at: new Date().toISOString() }).eq('id', ms.id)
    if (newStatus === 'completed') {
      await logActivity({ module: 'delivery', activity_type: 'completed', description: `Milestone ${ms.title} selesai`, entity_id: ms.id, entity_type: 'milestone' })
    }
    loadProject()
  }

  async function handleAddTask() {
    if (!project || !taskForm.title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('tasks').insert({
      project_id: project.id,
      title: taskForm.title,
      description: taskForm.description || null,
      deadline: taskForm.deadline || null,
      priority: taskForm.priority,
      assignee: taskForm.assignee || null,
      status: taskForm.status,
      created_by: user?.id,
    }).select().single()
    if (data) await logActivity({ module: 'tasks', activity_type: 'created', description: `Task ${taskForm.title} dibuat`, entity_id: data.id, entity_type: 'task' })
    setShowTask(false)
    setTaskForm({ title: '', description: '', deadline: '', priority: 'medium', assignee: '', status: 'todo' })
    setSaving(false)
    loadProject()
  }

  async function handleAddDeliverable() {
    if (!project || !deliverableForm.name.trim()) return
    setSaving(true)
    const { data } = await supabase.from('deliverables').insert({
      project_id: project.id,
      milestone_id: deliverableForm.milestone_id || null,
      name: deliverableForm.name,
      description: deliverableForm.description || null,
      type: deliverableForm.type,
      due_date: deliverableForm.due_date || null,
      status: deliverableForm.status,
      notes: deliverableForm.notes || null,
      link_url: deliverableForm.link_url || null,
      created_by: user?.id,
    }).select().single()
    if (data) await logActivity({ module: 'delivery', activity_type: 'created', description: `Deliverable ${deliverableForm.name} ditambahkan`, entity_id: data.id, entity_type: 'deliverable' })
    setShowDeliverable(false)
    setDeliverableForm({ name: '', description: '', type: 'website', due_date: '', status: 'pending', notes: '', link_url: '', milestone_id: '' })
    setSaving(false)
    loadProject()
  }

  async function handleUpdateDeliverableStatus(deliv: Deliverable, newStatus: Deliverable['status']) {
    await supabase.from('deliverables').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', deliv.id)
    if (newStatus === 'delivered') {
      await logActivity({ module: 'delivery', activity_type: 'delivered', description: `Deliverable ${deliv.name} dikirim`, entity_id: deliv.id, entity_type: 'deliverable' })
    }
    loadProject()
  }

  async function handleAddMeeting() {
    if (!project || !meetingForm.title.trim()) return
    setSaving(true)
    const participants = meetingForm.participants.split(',').map(p => p.trim()).filter(Boolean)
    const { data: meetingData } = await supabase.from('meeting_notes').insert({
      project_id: project.id,
      title: meetingForm.title,
      meeting_date: meetingForm.meeting_date,
      location: meetingForm.location || null,
      participants,
      notes: meetingForm.notes || null,
      created_by: user?.id,
    }).select().single()

    if (meetingData) {
      const decisions = meetingForm.decisions.filter(d => d.trim())
      if (decisions.length > 0) {
        await supabase.from('meeting_decisions').insert(decisions.map(d => ({ meeting_id: meetingData.id, decision: d.trim() })))
      }
      const actionItems = meetingForm.action_items.filter(a => a.trim())
      if (actionItems.length > 0) {
        await supabase.from('meeting_action_items').insert(actionItems.map(a => ({ meeting_id: meetingData.id, description: a.trim() })))
      }
      await logActivity({ module: 'delivery', activity_type: 'created', description: `Meeting ${meetingForm.title} dibuat`, entity_id: meetingData.id, entity_type: 'meeting' })
    }

    setShowMeeting(false)
    setMeetingForm({ title: '', meeting_date: new Date().toISOString().split('T')[0], location: '', participants: '', notes: '', decisions: [''], action_items: [''] })
    setSaving(false)
    loadProject()
  }

  async function handleAddNote() {
    if (!project || !noteForm.title.trim()) return
    setSaving(true)
    const tags = noteForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { data } = await supabase.from('project_notes').insert({
      project_id: project.id,
      title: noteForm.title,
      content: noteForm.content || null,
      category: noteForm.category,
      tags,
      created_by: user?.id,
    }).select().single()
    if (data) await logActivity({ module: 'delivery', activity_type: 'created', description: `Note ${noteForm.title} dibuat`, entity_id: data.id, entity_type: 'project_note' })
    setShowNote(false)
    setNoteForm({ title: '', content: '', category: 'technical', tags: '' })
    setSaving(false)
    loadProject()
  }

  async function handleToggleActionItem(item: MeetingActionItem) {
    await supabase.from('meeting_action_items').update({ completed: !item.completed }).eq('id', item.id)
    loadProject()
  }

  async function handleConvertActionItem(item: MeetingActionItem) {
    if (!project) return
    const { data: taskData } = await supabase.from('tasks').insert({
      project_id: project.id,
      title: item.description,
      status: 'todo',
      created_by: user?.id,
    }).select().single()
    if (taskData) {
      await supabase.from('meeting_action_items').update({ task_id: taskData.id }).eq('id', item.id)
      await logActivity({ module: 'tasks', activity_type: 'created', description: `Task ${item.description} dibuat dari meeting`, entity_id: taskData.id, entity_type: 'task' })
      toast.success('Action item converted to task')
      loadProject()
    }
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
  if (!project) return <div className="text-center py-20 text-muted-foreground">Project tidak ditemukan</div>

  const doneMs = milestones.filter(m => m.status === 'completed').length
  const doneTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{project.name}</h1>
              <StatusBadge status={project.status} type="project" />
              <PriorityBadge priority={project.priority} />
            </div>
            {project.client && <p className="text-sm text-muted-foreground mt-0.5">{project.client.company_name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={() => { setEditForm(project); setShowEdit(true) }}>
            <Pencil className="size-4" />Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive flex-1 sm:flex-initial" onClick={() => setShowDelete(true)}>
            <Trash2 className="size-4" />Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={project.progress} className="h-2 flex-1" />
              <span className="text-sm font-bold">{project.progress}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="size-3" />Start</p>
            <p className="text-sm font-medium mt-1">{formatDate(project.start_date)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Flag className="size-3" />Deadline</p>
            <p className={`text-sm font-medium mt-1 ${isOverdue(project.deadline) && project.status !== 'completed' ? 'text-destructive' : ''}`}>
              {formatDate(project.deadline)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Milestones</p>
            <p className="text-sm font-medium mt-1">{doneMs} / {milestones.length}</p>
          </CardContent>
        </Card>
      </div>

      {project.description && (
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{project.description}</p></CardContent></Card>
      )}

      <Tabs defaultValue="overview">
        <div className="w-full overflow-x-auto scrollbar-none">
          <TabsList className="w-full justify-start flex-nowrap min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables ({deliverables.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="meetings">Meetings ({meetings.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </div>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <OverviewStat label="Milestones" value={`${doneMs}/${milestones.length}`} icon={<Flag className="size-4 text-muted-foreground" />} />
            <OverviewStat label="Tasks Done" value={`${doneTasks}/${tasks.length}`} icon={<CheckCircle2 className="size-4 text-muted-foreground" />} />
            <OverviewStat label="Deliverables" value={String(deliverables.length)} icon={<Package className="size-4 text-muted-foreground" />} />
            <OverviewStat label="Meetings" value={String(meetings.length)} icon={<Users className="size-4 text-muted-foreground" />} />
          </div>
          {deliverables.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Deliverable Status</p>
                <div className="space-y-2">
                  {deliverables.map(d => (
                    <div key={d.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1 truncate">{d.name}</span>
                      <StatusBadge status={d.status} type="deliverable" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MILESTONES */}
        <TabsContent value="milestones" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowMilestone(true)}><Plus className="size-4" />Add Milestone</Button>
          </div>
          <div className="space-y-3">
            {milestones.map(ms => (
              <Card key={ms.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${ms.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{ms.title}</p>
                        <StatusBadge status={ms.status} type="milestone" />
                      </div>
                      {ms.description && <p className="text-xs text-muted-foreground mt-1">{ms.description}</p>}
                      {ms.deadline && (
                        <p className={`text-xs mt-1 ${isOverdue(ms.deadline) && ms.status !== 'completed' && ms.status !== 'cancelled' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Calendar className="size-3 inline mr-1" />{formatDate(ms.deadline)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={ms.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{ms.progress}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={ms.status} onValueChange={(v) => handleUpdateMilestoneStatus(ms, v as MilestoneStatus)}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MILESTONE_STATUSES.map(s => <SelectItem key={s} value={s}>{MILESTONE_STATUS_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {milestones.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada milestone</p>}
          </div>
        </TabsContent>

        {/* DELIVERABLES */}
        <TabsContent value="deliverables" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowDeliverable(true)}><Plus className="size-4" />Add Deliverable</Button>
          </div>
          <div className="space-y-2">
            {deliverables.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Package className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">{DELIVERABLE_TYPE_LABELS[d.type]}</Badge>
                    {d.due_date && <span className={`text-xs ${isOverdue(d.due_date) && d.status !== 'delivered' && d.status !== 'approved' ? 'text-destructive' : 'text-muted-foreground'}`}>{formatDate(d.due_date)}</span>}
                    {d.link_url && <a href={d.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"><LinkIcon className="size-3" />Link</a>}
                  </div>
                </div>
                <Select value={d.status} onValueChange={(v) => handleUpdateDeliverableStatus(d, v as Deliverable['status'])}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map(s => <SelectItem key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {deliverables.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada deliverable</p>}
          </div>
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{doneTasks} / {tasks.length} selesai</p>
            <Button size="sm" onClick={() => setShowTask(true)}><Plus className="size-4" />Add Task</Button>
          </div>
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <CheckCircle2 className={`size-4 shrink-0 ${task.status === 'done' ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                  {task.deadline && <p className={`text-xs mt-0.5 ${isOverdue(task.deadline) && task.status !== 'done' ? 'text-destructive' : 'text-muted-foreground'}`}>{formatDate(task.deadline)}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {task.assignee_profile && <Badge variant="outline" className="text-xs">{task.assignee_profile.full_name}</Badge>}
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} type="task" />
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada task</p>}
          </div>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-4 space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <FileText className="size-4 text-muted-foreground" />
              <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{doc.name}</p><p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p></div>
              <Badge variant="outline" className="text-xs">{doc.category}</Badge>
            </div>
          ))}
          {documents.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada dokumen</p>}
        </TabsContent>

        {/* MEETINGS */}
        <TabsContent value="meetings" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowMeeting(true)}><Plus className="size-4" />Add Meeting</Button>
          </div>
          <div className="space-y-3">
            {meetings.map(m => (
              <Card key={m.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(m.meeting_date)}
                        {m.location && ` • ${m.location}`}
                      </p>
                      {m.participants && m.participants.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {m.participants.map(p => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                        </div>
                      )}
                    </div>
                  </div>
                  {m.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.notes}</p>}
                  {m.decisions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Decisions</p>
                      <ul className="space-y-1">
                        {m.decisions.map(d => <li key={d.id} className="text-sm text-muted-foreground flex items-start gap-1.5"><CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-green-500" />{d.decision}</li>)}
                      </ul>
                    </div>
                  )}
                  {m.action_items.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Action Items</p>
                      <ul className="space-y-1">
                        {m.action_items.map(a => (
                          <li key={a.id} className="text-sm flex items-center gap-2">
                            <Checkbox checked={a.completed} onCheckedChange={() => handleToggleActionItem(a)} />
                            <span className={a.completed ? 'line-through text-muted-foreground flex-1' : 'flex-1'}>{a.description}</span>
                            {a.assignee && <Badge variant="outline" className="text-xs">{a.assignee}</Badge>}
                            {!a.task_id && !a.completed && (
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleConvertActionItem(a)}>→ Task</Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {meetings.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada meeting notes</p>}
          </div>
        </TabsContent>

        {/* NOTES */}
        <TabsContent value="notes" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowNote(true)}><Plus className="size-4" />Add Note</Button>
          </div>
          <div className="space-y-2">
            {notes.map(n => (
              <div key={n.id} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 flex-wrap">
                  <StickyNote className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium flex-1">{n.title}</p>
                  <Badge variant="outline" className="text-xs">{PROJECT_NOTE_CATEGORY_LABELS[n.category]}</Badge>
                </div>
                {n.content && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.content}</p>}
                {n.tags && n.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {n.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">#{t}</Badge>)}
                  </div>
                )}
              </div>
            ))}
            {notes.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada notes</p>}
          </div>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-2">
            {timeline.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Belum ada aktivitas</p>
            ) : (
              timeline.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Clock className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{log.module}</Badge>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as ProjectStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(['discovery','planning','development','testing','deployment','maintenance','completed'] as ProjectStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={v => setEditForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(['low','medium','high'] as Priority[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Progress ({editForm.progress ?? 0}%)</Label><Input type="range" min={0} max={100} value={editForm.progress ?? 0} onChange={e => setEditForm(f => ({ ...f, progress: Number(e.target.value) }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value || null }))} /></div>
              <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={editForm.deadline || ''} onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value || null }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone */}
      <Dialog open={showMilestone} onOpenChange={setShowMilestone}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Title *</Label><Input value={milestoneForm.title} onChange={e => setMilestoneForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={milestoneForm.deadline} onChange={e => setMilestoneForm(f => ({ ...f, deadline: e.target.value }))} /></div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={milestoneForm.status} onValueChange={v => setMilestoneForm(f => ({ ...f, status: v as MilestoneStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MILESTONE_STATUSES.map(s => <SelectItem key={s} value={s}>{MILESTONE_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Progress ({milestoneForm.progress}%)</Label><Input type="range" min={0} max={100} value={milestoneForm.progress} onChange={e => setMilestoneForm(f => ({ ...f, progress: Number(e.target.value) }))} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={2} value={milestoneForm.description} onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMilestone(false)}>Cancel</Button>
            <Button onClick={handleAddMilestone} disabled={saving || !milestoneForm.title.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task */}
      <Dialog open={showTask} onOpenChange={setShowTask}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Title *</Label><Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v as Task['priority'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(['low','medium','high'] as Task['priority'][]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Deadline</Label><Input type="date" value={taskForm.deadline} onChange={e => setTaskForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Assignee</Label>
              <Select value={taskForm.assignee} onValueChange={v => setTaskForm(f => ({ ...f, assignee: v }))}>
                <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTask(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={saving || !taskForm.title.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deliverable */}
      <Dialog open={showDeliverable} onOpenChange={setShowDeliverable}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Deliverable</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={deliverableForm.name} onChange={e => setDeliverableForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={deliverableForm.type} onValueChange={v => setDeliverableForm(f => ({ ...f, type: v as Deliverable['type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DELIVERABLE_TYPES.map(t => <SelectItem key={t} value={t}>{DELIVERABLE_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={deliverableForm.status} onValueChange={v => setDeliverableForm(f => ({ ...f, status: v as Deliverable['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DELIVERABLE_STATUSES.map(s => <SelectItem key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Due Date</Label><Input type="date" value={deliverableForm.due_date} onChange={e => setDeliverableForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div className="grid gap-2">
                <Label>Milestone (Optional)</Label>
                <Select value={deliverableForm.milestone_id} onValueChange={v => setDeliverableForm(f => ({ ...f, milestone_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {milestones.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Link URL (Optional)</Label><Input value={deliverableForm.link_url} onChange={e => setDeliverableForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={2} value={deliverableForm.description} onChange={e => setDeliverableForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea rows={2} value={deliverableForm.notes} onChange={e => setDeliverableForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliverable(false)}>Cancel</Button>
            <Button onClick={handleAddDeliverable} disabled={saving || !deliverableForm.name.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meeting */}
      <Dialog open={showMeeting} onOpenChange={setShowMeeting}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Meeting Notes</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Title *</Label><Input value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Weekly Sync" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Date *</Label><Input type="date" value={meetingForm.meeting_date} onChange={e => setMeetingForm(f => ({ ...f, meeting_date: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Location / Platform</Label><Input value={meetingForm.location} onChange={e => setMeetingForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Google Meet" /></div>
            </div>
            <div className="grid gap-2"><Label>Participants (comma separated)</Label><Input value={meetingForm.participants} onChange={e => setMeetingForm(f => ({ ...f, participants: e.target.value }))} placeholder="John, Jane" /></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea rows={3} value={meetingForm.notes} onChange={e => setMeetingForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="grid gap-2">
              <Label>Decisions</Label>
              {meetingForm.decisions.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={d} onChange={e => setMeetingForm(f => ({ ...f, decisions: f.decisions.map((x, j) => j === i ? e.target.value : x) }))} placeholder="Decision..." />
                  {meetingForm.decisions.length > 1 && <Button variant="ghost" size="icon" onClick={() => setMeetingForm(f => ({ ...f, decisions: f.decisions.filter((_, j) => j !== i) }))}><X className="size-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMeetingForm(f => ({ ...f, decisions: [...f.decisions, ''] }))}><Plus className="size-3" />Add Decision</Button>
            </div>
            <div className="grid gap-2">
              <Label>Action Items</Label>
              {meetingForm.action_items.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={a} onChange={e => setMeetingForm(f => ({ ...f, action_items: f.action_items.map((x, j) => j === i ? e.target.value : x) }))} placeholder="Action item..." />
                  {meetingForm.action_items.length > 1 && <Button variant="ghost" size="icon" onClick={() => setMeetingForm(f => ({ ...f, action_items: f.action_items.filter((_, j) => j !== i) }))}><X className="size-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMeetingForm(f => ({ ...f, action_items: [...f.action_items, ''] }))}><Plus className="size-3" />Add Action Item</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeeting(false)}>Cancel</Button>
            <Button onClick={handleAddMeeting} disabled={saving || !meetingForm.title.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note */}
      <Dialog open={showNote} onOpenChange={setShowNote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Title *</Label><Input value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={noteForm.category} onValueChange={v => setNoteForm(f => ({ ...f, category: v as ProjectNote['category'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{PROJECT_NOTE_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Tags (comma separated)</Label><Input value={noteForm.tags} onChange={e => setNoteForm(f => ({ ...f, tags: e.target.value }))} placeholder="api, urgent" /></div>
            <div className="grid gap-2"><Label>Content</Label><Textarea rows={4} value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNote(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={saving || !noteForm.title.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Project?</AlertDialogTitle>
            <AlertDialogDescription>Project <strong>{project.name}</strong> akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function OverviewStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">{icon}<p className="text-xs text-muted-foreground">{label}</p></div>
        <p className="text-lg font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
