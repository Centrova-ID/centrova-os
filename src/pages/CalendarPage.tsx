import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft, ChevronRight, CalendarDays,
  Flag, CheckSquare, Package, Users, Calendar as CalIcon,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Project = Database['public']['Tables']['projects']['Row']
type Milestone = Database['public']['Tables']['milestones']['Row']
type Task = Database['public']['Tables']['tasks']['Row']
type Deliverable = Database['public']['Tables']['deliverables']['Row']
type MeetingNote = Database['public']['Tables']['meeting_notes']['Row']

interface CalendarEvent {
  id: string
  date: string
  title: string
  type: 'project_deadline' | 'milestone' | 'task' | 'deliverable' | 'meeting'
  projectId: string
  projectName: string
  clientName?: string
}

const EVENT_CONFIG: Record<CalendarEvent['type'], { label: string; icon: React.ReactNode; className: string }> = {
  project_deadline: { label: 'Project Deadline', icon: <Flag className="size-3" />, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  milestone: { label: 'Milestone', icon: <Flag className="size-3" />, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  task: { label: 'Task', icon: <CheckSquare className="size-3" />, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  deliverable: { label: 'Deliverable', icon: <Package className="size-3" />, className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  meeting: { label: 'Meeting', icon: <Users className="size-3" />, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ViewMode = 'month' | 'week' | 'day'

export function CalendarPage() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('month')
  const [projectFilter, setProjectFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [projects, setProjects] = useState<(Project & { client?: { company_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCalendarData()
  }, [])

  async function loadCalendarData() {
    setLoading(true)
    const [projRes, msRes, taskRes, delivRes, meetRes] = await Promise.all([
      supabase.from('projects').select('*, client:clients(company_name)').is('deleted_at', null).order('name'),
      supabase.from('milestones').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('deliverables').select('*').is('deleted_at', null),
      supabase.from('meeting_notes').select('*').is('deleted_at', null),
    ])

    const allProjects = (projRes.data || []) as (Project & { client?: { company_name: string } | null })[]
    setProjects(allProjects)
    const projectMap = new Map(allProjects.map(p => [p.id, p]))
    const allEvents: CalendarEvent[] = []

    ;(projRes.data || []).forEach((p: Project) => {
      if (p.deadline && p.status !== 'completed') {
        allEvents.push({ id: `proj-${p.id}`, date: p.deadline, title: p.name, type: 'project_deadline', projectId: p.id, projectName: p.name, clientName: projectMap.get(p.id)?.client?.company_name || undefined })
      }
    })

    ;(msRes.data || []).forEach((m: Milestone) => {
      const proj = projectMap.get(m.project_id)
      if (m.deadline && m.status !== 'completed' && m.status !== 'cancelled' && proj) {
        allEvents.push({ id: `ms-${m.id}`, date: m.deadline, title: m.title, type: 'milestone', projectId: m.project_id, projectName: proj.name, clientName: proj.client?.company_name || undefined })
      }
    })

    ;(taskRes.data || []).forEach((t: Task) => {
      const proj = projectMap.get(t.project_id!)
      if (t.deadline && t.status !== 'done' && proj) {
        allEvents.push({ id: `task-${t.id}`, date: t.deadline!, title: t.title, type: 'task', projectId: t.project_id!, projectName: proj.name, clientName: proj.client?.company_name || undefined })
      }
    })

    ;(delivRes.data || []).forEach((d: Deliverable) => {
      const proj = projectMap.get(d.project_id)
      if (d.due_date && d.status !== 'delivered' && d.status !== 'approved' && proj) {
        allEvents.push({ id: `deliv-${d.id}`, date: d.due_date, title: d.name, type: 'deliverable', projectId: d.project_id, projectName: proj.name, clientName: proj.client?.company_name || undefined })
      }
    })

    ;(meetRes.data || []).forEach((m: MeetingNote) => {
      const proj = projectMap.get(m.project_id)
      if (proj) {
        allEvents.push({ id: `meet-${m.id}`, date: m.meeting_date, title: m.title, type: 'meeting', projectId: m.project_id, projectName: proj.name, clientName: proj.client?.company_name || undefined })
      }
    })

    setEvents(allEvents)
    setLoading(false)
  }

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (projectFilter !== 'all' && e.projectId !== projectFilter) return false
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      return true
    })
  }, [events, projectFilter, typeFilter])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    filteredEvents.forEach(e => {
      const arr = map.get(e.date) || []
      arr.push(e)
      map.set(e.date, arr)
    })
    return map
  }, [filteredEvents])

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const date = new Date(currentDate)
    const day = date.getDay()
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(date)
      d.setDate(date.getDate() - day + i)
      week.push(d)
    }
    return week
  }, [currentDate])

  function navigateCalendar(direction: number) {
    const newDate = new Date(currentDate)
    if (view === 'month') newDate.setMonth(newDate.getMonth() + direction)
    else if (view === 'week') newDate.setDate(newDate.getDate() + direction * 7)
    else newDate.setDate(newDate.getDate() + direction)
    setCurrentDate(newDate)
  }

  function dateKey(d: Date) {
    return d.toISOString().split('T')[0]
  }

  function isToday(d: Date) {
    return dateKey(d) === new Date().toISOString().split('T')[0]
  }

  const todayEvents = filteredEvents.filter(e => e.date === dateKey(currentDate))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="View all project deadlines and events in one calendar"
      />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateCalendar(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => navigateCalendar(1)}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <h2 className="text-lg font-semibold ml-2">
            {view === 'day'
              ? `${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(EVENT_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[600px]" />
      ) : view === 'month' ? (
        <div className="rounded-lg border">
          <div className="grid grid-cols-7 border-b">
            {DAY_NAMES.map(d => <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[100px] border-b border-r p-1 bg-muted/20" />
              const dayEvents = eventsByDate.get(dateKey(d)) || []
              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r p-1 ${isToday(d) ? 'bg-primary/5' : ''}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday(d) ? 'text-primary' : 'text-muted-foreground'}`}>
                    {d.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div
                        key={e.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${EVENT_CONFIG[e.type].className}`}
                        onClick={() => navigate(`/projects/${e.projectId}`)}
                        title={`${e.projectName} — ${e.title}`}
                      >
                        {EVENT_CONFIG[e.type].icon} {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        <div className="rounded-lg border">
          <div className="grid grid-cols-7 border-b">
            {weekDays.map((d, i) => (
              <div key={i} className={`p-2 text-center text-xs font-medium ${isToday(d) ? 'text-primary' : 'text-muted-foreground'}`}>
                {DAY_NAMES[i]} {d.getDate()}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weekDays.map((d, i) => {
              const dayEvents = eventsByDate.get(dateKey(d)) || []
              return (
                <div key={i} className={`min-h-[200px] border-r p-1 ${isToday(d) ? 'bg-primary/5' : ''}`}>
                  <div className="space-y-1">
                    {dayEvents.map(e => (
                      <div
                        key={e.id}
                        className={`text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 ${EVENT_CONFIG[e.type].className}`}
                        onClick={() => navigate(`/projects/${e.projectId}`)}
                      >
                        <div className="flex items-center gap-1 font-medium">{EVENT_CONFIG[e.type].icon} {e.title}</div>
                        <div className="text-xs opacity-70 truncate">{e.projectName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalIcon className="size-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">
              {DAY_NAMES[currentDate.getDay()]}, {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
          </div>
          {todayEvents.length === 0 ? (
            <Card className="p-12 text-center">
              <CalendarDays className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">No events on this day</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {todayEvents.map(e => (
                <Card key={e.id} className="p-4 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/projects/${e.projectId}`)}>
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 items-center justify-center rounded-full ${EVENT_CONFIG[e.type].className}`}>
                      {EVENT_CONFIG[e.type].icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.projectName}{e.clientName && ` • ${e.clientName}`}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{EVENT_CONFIG[e.type].label}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(EVENT_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`flex size-5 items-center justify-center rounded ${v.className}`}>{v.icon}</div>
            <span className="text-xs text-muted-foreground">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
