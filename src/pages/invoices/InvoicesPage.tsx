import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Receipt, Sparkles } from 'lucide-react'
import { AIInvoiceGenerator } from '@/components/invoices/AIInvoiceGenerator'
import type { Database } from '@/lib/database.types'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceStatus = Invoice['status']

export function InvoicesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<(Invoice & { client?: { company_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [aiOpen, setAiOpen] = useState(false)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('invoices').select('*, client:clients(company_name)').is('deleted_at', null).order('created_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as InvoiceStatus)
    if (search) query = query.ilike('invoice_number', `%${search}%`)
    const { data } = await query
    setInvoices(data || [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  async function handleCreateInvoice() {
    const { data: numData } = await supabase.rpc('get_next_invoice_number')
    let invoiceNumber = numData || `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`
    const today = new Date().toISOString().split('T')[0]
    const due = new Date()
    due.setDate(due.getDate() + 30)
    const dueStr = due.toISOString().split('T')[0]

    let { data } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      issue_date: today,
      due_date: dueStr,
      status: 'draft',
      created_by: user?.id,
    }).select().single()

    if (!data) {
      invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`
      const { data: retryData } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        issue_date: today,
        due_date: dueStr,
        status: 'draft',
        created_by: user?.id,
      }).select().single()
      data = retryData
    }

    if (data) {
      await logActivity({ module: 'invoices', activity_type: 'created', description: `Invoice ${invoiceNumber} dibuat`, entity_id: data.id, entity_type: 'invoice' })
      navigate(`/invoices/${data.id}`)
    }
  }

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  const totalOutstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola seluruh invoice client</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="size-4" />
            AI Generate
          </Button>
          <Button onClick={handleCreateInvoice}>
            <Plus className="size-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Invoices</p>
          <p className="text-2xl font-bold mt-1">{invoices.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Revenue (Paid)</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari invoice..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]).map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Receipt className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada invoice</p>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map(invoice => (
                <TableRow key={invoice.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell className="text-muted-foreground">{invoice.client?.company_name || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(invoice.issue_date)}</TableCell>
                  <TableCell>
                    <span className={`text-sm ${(invoice.status === 'sent' || invoice.status === 'overdue') && isOverdue(invoice.due_date) ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatDate(invoice.due_date)}
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={invoice.status} type="invoice" /></TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(invoice.total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AIInvoiceGenerator open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  )
}
