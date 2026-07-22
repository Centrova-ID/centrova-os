import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate, formatCurrency, formatRelative, isOverdue } from '@/lib/utils'
import {
  Users, FolderKanban, CheckSquare, Receipt, AlertCircle,
  TrendingUp, Calendar, Activity, ArrowRight,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Project = Database['public']['Tables']['projects']['Row']
type Task = Database['public']['Tables']['tasks']['Row']
type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

interface DashboardStats {
  totalClients: number
  activeProjects: number
  completedProjects: number
  totalInvoices: number
  outstandingInvoices: number
  revenue: number
  upcomingDeadlines: number
}

interface RecentActivity extends ActivityLog {
  profile?: { full_name: string; email: string } | null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [projects, setProjects] = useState<(Project & { client?: { company_name: string } | null })[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [clientsRes, projectsRes, invoicesRes, tasksRes, activityRes] = await Promise.all([
        supabase.from('clients').select('id, status').is('deleted_at', null),
        supabase.from('projects').select('*, client:clients(company_name)').is('deleted_at', null).order('deadline'),
        supabase.from('invoices').select('id, status, total').is('deleted_at', null),
        supabase.from('tasks').select('*').order('deadline'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ])

      const clients = clientsRes.data || []
      const allProjects = projectsRes.data || []
      const invoices = invoicesRes.data || []
      const allTasks = tasksRes.data || []
      const logs = activityRes.data || []

      const now = new Date().toISOString().split('T')[0]
      const sevenDays = new Date()
      sevenDays.setDate(sevenDays.getDate() + 7)
      const sevenDaysStr = sevenDays.toISOString().split('T')[0]

      setStats({
        totalClients: clients.filter(c => c.status === 'active' || c.status === 'prospect').length,
        activeProjects: allProjects.filter(p => p.status !== 'completed').length,
        completedProjects: allProjects.filter(p => p.status === 'completed').length,
        totalInvoices: invoices.length,
        outstandingInvoices: invoices.filter(i => i.status === 'sent' || i.status === 'overdue').length,
        revenue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0),
        upcomingDeadlines: allProjects.filter(p =>
          p.deadline && p.deadline >= now && p.deadline <= sevenDaysStr && p.status !== 'completed'
        ).length,
      })

      setProjects(allProjects.slice(0, 6))
      setTasks(allTasks.filter(t => t.status !== 'done').slice(0, 8))
      setRecentActivity(logs)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <DashboardSkeleton />

  const overdueTasks = tasks.filter(t => t.deadline && isOverdue(t.deadline))
  const todayTasks = tasks.filter(t => t.deadline === new Date().toISOString().split('T')[0])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Ringkasan operasional Centrova hari ini</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Client" value={stats?.totalClients ?? 0} icon={<Users className="size-4 text-muted-foreground" />} onClick={() => navigate('/clients')} />
        <StatCard title="Active Projects" value={stats?.activeProjects ?? 0} icon={<FolderKanban className="size-4 text-muted-foreground" />} onClick={() => navigate('/projects')} />
        <StatCard title="Outstanding Invoice" value={stats?.outstandingInvoices ?? 0} icon={<AlertCircle className="size-4 text-muted-foreground" />} onClick={() => navigate('/invoices')} />
        <StatCard title="Revenue" value={formatCurrency(stats?.revenue ?? 0)} icon={<TrendingUp className="size-4 text-muted-foreground" />} onClick={() => navigate('/invoices')} isText />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Completed Projects" value={stats?.completedProjects ?? 0} icon={<FolderKanban className="size-4 text-muted-foreground" />} />
        <StatCard title="Total Invoices" value={stats?.totalInvoices ?? 0} icon={<Receipt className="size-4 text-muted-foreground" />} onClick={() => navigate('/invoices')} />
        <StatCard title="Upcoming Deadlines" value={stats?.upcomingDeadlines ?? 0} icon={<Calendar className="size-4 text-muted-foreground" />} onClick={() => navigate('/projects')} />
        <StatCard title="Overdue Tasks" value={overdueTasks.length} icon={<CheckSquare className="size-4 text-muted-foreground" />} onClick={() => navigate('/tasks')} highlight={overdueTasks.length > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Active Projects</CardTitle>
            <button onClick={() => navigate('/projects')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight className="size-3" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada project</p>
            ) : (
              projects.map(project => (
                <div
                  key={project.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{project.name}</span>
                      <StatusBadge status={project.status} type="project" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{project.client?.company_name || 'No client'}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-1.5" />
                    </div>
                    {project.deadline && (
                      <p className={`text-xs mt-1 ${isOverdue(project.deadline) && project.status !== 'completed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Deadline: {formatDate(project.deadline)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Task Summary + Recent Activity */}
        <div className="space-y-4">
          {/* Task Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Task Summary</CardTitle>
              <button onClick={() => navigate('/tasks')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="size-3" />
              </button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{todayTasks.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Today</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <div className="text-2xl font-bold text-destructive">{overdueTasks.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Overdue</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{tasks.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Open</div>
                </div>
              </div>
              {tasks.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {tasks.slice(0, 4).map(task => (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <CheckSquare className={`size-3.5 shrink-0 ${task.deadline && isOverdue(task.deadline) ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <span className="flex-1 truncate">{task.title}</span>
                      {task.deadline && (
                        <span className={`text-xs shrink-0 ${isOverdue(task.deadline) ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {formatDate(task.deadline)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <button onClick={() => navigate('/activity')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                View all <ArrowRight className="size-3" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Belum ada aktivitas</p>
              ) : (
                recentActivity.slice(0, 6).map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{log.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(log.created_at)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{log.module}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title, value, icon, onClick, highlight, isText,
}: {
  title: string
  value: number | string
  icon?: React.ReactNode
  onClick?: () => void
  highlight?: boolean
  isText?: boolean
}) {
  return (
    <Card className={`${onClick ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''} ${highlight ? 'border-destructive/50' : ''}`} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`${isText ? 'text-xl' : 'text-2xl'} font-bold ${highlight ? 'text-destructive' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-8 w-16" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}
