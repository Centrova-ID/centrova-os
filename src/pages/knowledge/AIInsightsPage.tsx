import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, AlertCircle, TrendingUp, AlertTriangle, Clock, DollarSign } from 'lucide-react'

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

export function AIInsightsPage() {
  const [loading, setLoading] = useState<'project' | 'finance' | null>(null)
  const [projectInsights, setProjectInsights] = useState<string | null>(null)
  const [financeInsights, setFinanceInsights] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateProjectInsights() {
    setLoading('project')
    setError(null)
    setProjectInsights(null)
    try {
      const [projects, milestones, deliverables, tasks] = await Promise.all([
        supabase.from('projects').select('*').is('deleted_at', null),
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('deliverables').select('*').is('deleted_at', null),
        supabase.from('tasks').select('*').is('deleted_at', null),
      ])
      const context = [
        `### Projects:\n${JSON.stringify(projects.data?.map(p => ({ name: p.name, status: p.status, deadline: p.deadline, progress: p.progress })), null, 2)}`,
        `### Milestones:\n${JSON.stringify(milestones.data?.map(m => ({ name: m.name, status: m.status, due_date: m.due_date, progress: m.progress })), null, 2)}`,
        `### Deliverables:\n${JSON.stringify(deliverables.data?.map(d => ({ name: d.name, status: d.status, due_date: d.due_date })), null, 2)}`,
        `### Tasks:\n${JSON.stringify(tasks.data?.map(t => ({ title: t.title, status: t.status, priority: t.priority, deadline: t.deadline })), null, 2)}`,
      ].join('\n\n')

      const response = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Berikan insight project berdasarkan data berikut. Identifikasi: project yang mendekati deadline, project dengan progress lambat, project tanpa update, deliverable terlambat, dan milestone belum selesai. Berikan rekomendasi tindakan.' }],
          context,
        }),
      })
      const data = await response.json()
      if (response.ok && data.message) setProjectInsights(data.message)
      else setError(data.error || 'Gagal generate insights')
    } catch (err) {
      setError('Gagal terhubung ke AI')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  async function generateFinanceInsights() {
    setLoading('finance')
    setError(null)
    setFinanceInsights(null)
    try {
      const [invoices, expenses, revenue] = await Promise.all([
        supabase.from('invoices').select('*').is('deleted_at', null),
        supabase.from('expenses').select('*').is('deleted_at', null).order('expense_date', { ascending: false }).limit(30),
        supabase.from('revenue').select('*').is('deleted_at', null).order('revenue_date', { ascending: false }).limit(30),
      ])
      const context = [
        `### Invoices:\n${JSON.stringify(invoices.data?.map(i => ({ number: i.invoice_number, status: i.status, total: i.total, due_date: i.due_date })), null, 2)}`,
        `### Recent Expenses:\n${JSON.stringify(expenses.data?.map(e => ({ description: e.description, amount: e.amount, category: e.category, date: e.expense_date })), null, 2)}`,
        `### Recent Revenue:\n${JSON.stringify(revenue.data?.map(r => ({ description: r.description, amount: r.amount, date: r.revenue_date })), null, 2)}`,
      ].join('\n\n')

      const response = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Berikan insight keuangan berdasarkan data berikut. Identifikasi: revenue trend, expense terbesar, client dengan pendapatan terbesar, invoice overdue, dan subscription yang akan jatuh tempo. Berikan rekomendasi.' }],
          context,
        }),
      })
      const data = await response.json()
      if (response.ok && data.message) setFinanceInsights(data.message)
      else setError(data.error || 'Gagal generate insights')
    } catch (err) {
      setError('Gagal terhubung ke AI')
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" description="Insight otomatis berbasis data project dan keuangan" />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-blue-600" />
              Project Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Identifikasi project yang mendekati deadline, progress lambat, deliverable terlambat, dan milestone belum selesai.
            </p>
            <Button onClick={generateProjectInsights} disabled={loading !== null}>
              <Sparkles className="size-4" /> Generate Insights
            </Button>
            {loading === 'project' && <Skeleton className="h-48 w-full mt-4" />}
            {projectInsights && loading !== 'project' && (
              <div className="mt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">{projectInsights}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="size-4 text-green-600" />
              Financial Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Analisis revenue trend, expense terbesar, invoice overdue, dan subscription yang akan jatuh tempo.
            </p>
            <Button onClick={generateFinanceInsights} disabled={loading !== null}>
              <Sparkles className="size-4" /> Generate Insights
            </Button>
            {loading === 'finance' && <Skeleton className="h-48 w-full mt-4" />}
            {financeInsights && loading !== 'finance' && (
              <div className="mt-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">{financeInsights}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-yellow-600" />
            <p className="font-medium text-sm">Quick Stats</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> Deadline Soon</div>
              <p className="text-lg font-bold mt-1">—</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><AlertCircle className="size-3" /> Overdue</div>
              <p className="text-lg font-bold mt-1">—</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="size-3" /> Active</div>
              <p className="text-lg font-bold mt-1">—</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><DollarSign className="size-3" /> Revenue</div>
              <p className="text-lg font-bold mt-1">—</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Klik "Generate Insights" untuk analisis lengkap dengan AI.</p>
        </CardContent>
      </Card>
    </div>
  )
}
