import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Sparkles, FileDown, AlertCircle, FileText } from 'lucide-react'

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

const REPORT_TYPES = [
  { id: 'weekly', label: 'Weekly Report', desc: 'Ringkasan aktivitas minggu ini' },
  { id: 'monthly', label: 'Monthly Report', desc: 'Ringkasan bulanan lengkap' },
  { id: 'project', label: 'Project Summary', desc: 'Status seluruh project' },
  { id: 'client', label: 'Client Summary', desc: 'Ringkasan klien dan status' },
  { id: 'revenue', label: 'Revenue Summary', desc: 'Analisis pendapatan' },
  { id: 'expense', label: 'Expense Summary', desc: 'Analisis pengeluaran' },
]

export function AIReportsPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateReport(type: string) {
    setLoading(true)
    setError(null)
    setReport(null)

    try {
      const context = await collectData(type)
      const promptMap: Record<string, string> = {
        weekly: 'Buat laporan mingguan berdasarkan data berikut. Sertakan ringkasan project, task, invoice, dan expense.',
        monthly: 'Buat laporan bulanan komprehensif berdasarkan data berikut. Sertakan analisis revenue, expense, project status, dan rekomendasi.',
        project: 'Buat ringkasan status seluruh project berdasarkan data berikut. Sertakan progress, deadline, dan potential risks.',
        client: 'Buat ringkasan klien berdasarkan data berikut. Sertakan status, project aktif, dan outstanding invoice.',
        revenue: 'Buat analisis pendapatan berdasarkan data berikut. Sertakan total revenue, outstanding invoice, dan trend.',
        expense: 'Buat analisis pengeluaran berdasarkan data berikut. Sertakan total expense, breakdown kategori, dan rekomendasi efisiensi.',
      }

      const response = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptMap[type] || 'Buat laporan berdasarkan data berikut.' }],
          context,
        }),
      })
      const data = await response.json()
      if (response.ok && data.message) {
        setReport(data.message)
      } else {
        setError(data.error || 'Gagal generate report')
      }
    } catch (err) {
      setError('Gagal terhubung ke AI')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function collectData(_type: string): Promise<string> {
    try {
      const [clients, projects, invoices, expenses, tasks] = await Promise.all([
        supabase.from('clients').select('*').is('deleted_at', null),
        supabase.from('projects').select('*').is('deleted_at', null),
        supabase.from('invoices').select('*').is('deleted_at', null),
        supabase.from('expenses').select('*').is('deleted_at', null).order('expense_date', { ascending: false }).limit(30),
        supabase.from('tasks').select('*').is('deleted_at', null),
      ])
      const parts: string[] = []
      if (clients.data?.length) parts.push(`### Clients (${clients.data.length}):\n${JSON.stringify(clients.data.map(c => ({ name: c.name, status: c.status, email: c.email })), null, 2)}`)
      if (projects.data?.length) parts.push(`### Projects (${projects.data.length}):\n${JSON.stringify(projects.data.map(p => ({ name: p.name, status: p.status, deadline: p.deadline, budget: p.budget, progress: p.progress })), null, 2)}`)
      if (invoices.data?.length) parts.push(`### Invoices (${invoices.data.length}):\n${JSON.stringify(invoices.data.map(i => ({ number: i.invoice_number, status: i.status, total: i.total, due_date: i.due_date })), null, 2)}`)
      if (expenses.data?.length) parts.push(`### Recent Expenses:\n${JSON.stringify(expenses.data.map(e => ({ description: e.description, amount: e.amount, category: e.category, date: e.expense_date })), null, 2)}`)
      if (tasks.data?.length) parts.push(`### Tasks (${tasks.data.length}):\n${JSON.stringify(tasks.data.map(t => ({ title: t.title, status: t.status, priority: t.priority })), null, 2)}`)
      return parts.join('\n\n') || 'Tidak ada data tersedia.'
    } catch {
      return 'Data tidak dapat diambil.'
    }
  }

  function handleExportMarkdown() {
    if (!report) return
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `centrova-report-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report diexport sebagai Markdown')
  }

  function handleExportPDF() {
    if (!report) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Centrova Report</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}h1,h2,h3{color:#333}pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto}</style></head><body><pre style="white-space:pre-wrap">${report.replace(/</g, '&lt;')}</pre></body></html>`)
    win.document.close()
    win.print()
    toast.success('Report siap untuk PDF export')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Reports" description="Generate laporan otomatis berbasis data Centrova" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map(r => (
          <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => generateReport(r.id)}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="size-4 text-green-600" />
                <p className="font-medium text-sm">{r.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {loading && <Skeleton className="h-64 w-full" />}

      {report && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-violet-500" />
                <p className="font-medium text-sm">Generated Report</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportMarkdown}><FileDown className="size-3.5" /> Markdown</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}><FileDown className="size-3.5" /> PDF</Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">{report}</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
