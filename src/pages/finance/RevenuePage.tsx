import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  formatCurrency, formatDate, PAYMENT_METHOD_LABELS, REVENUE_CATEGORY_LABELS,
} from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, TrendingUp, FileText,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row']

interface RevenueTransaction extends Transaction {
  client?: { id: string; company_name: string } | null
  project?: { id: string; name: string } | null
  invoice?: { id: string; invoice_number: string } | null
}

interface Client { id: string; company_name: string }
interface Project { id: string; name: string; client_id: string }
interface Invoice { id: string; invoice_number: string; status: string; total: number; client_id: string }

const REVENUE_CATEGORIES = Object.keys(REVENUE_CATEGORY_LABELS)

export function RevenuePage() {
  const { user } = useAuth()
  const [revenues, setRevenues] = useState<RevenueTransaction[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    category: 'Invoice Payment',
    description: '',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    reference: '',
    payment_method: 'bank_transfer' as 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other',
    status: 'completed' as 'completed' | 'pending',
    client_id: '',
    project_id: '',
    invoice_id: '',
  })

  const loadRevenue = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, client:clients(id, company_name), project:projects(id, name), invoice:invoices(id, invoice_number)')
      .eq('type', 'income')
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })

    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (search) query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%`)

    const { data } = await query
    setRevenues((data || []) as RevenueTransaction[])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => {
    loadRevenue()
    supabase.from('clients').select('id, company_name').is('deleted_at', null).order('company_name')
      .then(({ data }) => setClients(data || []))
    supabase.from('projects').select('id, name, client_id').is('deleted_at', null).order('name')
      .then(({ data }) => setProjects(data || []))
    supabase.from('invoices').select('id, invoice_number, status, total, client_id').is('deleted_at', null).order('created_at', { ascending: false })
      .then(({ data }) => setInvoices(data || []))
  }, [loadRevenue])

  function openCreate() {
    setEditing(null)
    setForm({
      category: 'Invoice Payment',
      description: '',
      amount: '',
      transaction_date: new Date().toISOString().split('T')[0],
      reference: '',
      payment_method: 'bank_transfer',
      status: 'completed',
      client_id: '',
      project_id: '',
      invoice_id: '',
    })
    setDialogOpen(true)
  }

  function openEdit(tx: Transaction) {
    setEditing(tx)
    setForm({
      category: tx.category,
      description: tx.description,
      amount: String(tx.amount),
      transaction_date: tx.transaction_date,
      reference: tx.reference || '',
      payment_method: tx.payment_method,
      status: tx.status,
      client_id: tx.client_id || '',
      project_id: tx.project_id || '',
      invoice_id: tx.invoice_id || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error('Description dan amount wajib diisi')
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: 'income' as const,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
        transaction_date: form.transaction_date,
        reference: form.reference.trim() || null,
        payment_method: form.payment_method,
        status: form.status,
        client_id: form.client_id || null,
        project_id: form.project_id || null,
        invoice_id: form.invoice_id || null,
        created_by: user?.id,
      }

      if (editing) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'finance', activity_type: 'updated', description: `Revenue ${form.description} diperbarui`, entity_id: editing.id, entity_type: 'transaction' })
        toast.success('Revenue diperbarui')
      } else {
        const { data, error } = await supabase.from('transactions').insert(payload).select().single()
        if (error) throw error

        if (form.invoice_id) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', form.invoice_id)
        }

        await logActivity({ module: 'finance', activity_type: 'created', description: `Revenue ${form.description} dibuat`, entity_id: data.id, entity_type: 'transaction' })
        toast.success('Revenue dibuat')
      }
      setDialogOpen(false)
      loadRevenue()
    } catch (err) {
      toast.error('Gagal menyimpan revenue')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!confirm('Hapus revenue ini?')) return
    const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', tx.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'finance', activity_type: 'deleted', description: `Revenue ${tx.description} dihapus`, entity_id: tx.id, entity_type: 'transaction' })
    toast.success('Revenue dihapus')
    loadRevenue()
  }

  const completed = revenues.filter(r => r.status === 'completed')
  const totalRevenue = completed.reduce((s, r) => s + Number(r.amount), 0)
  const pendingRevenue = revenues.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0)
  const invoiceRevenue = completed.filter(r => r.invoice_id).reduce((s, r) => s + Number(r.amount), 0)
  const otherRevenue = completed.filter(r => !r.invoice_id).reduce((s, r) => s + Number(r.amount), 0)

  const filteredProjects = form.client_id ? projects.filter(p => p.client_id === form.client_id) : projects
  const filteredInvoices = form.client_id ? invoices.filter(i => i.client_id === form.client_id) : invoices

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Management"
        description="Pemasukan dari invoice payment dan income lainnya"
        action={{ label: 'Record Revenue', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">From Invoices</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(invoiceRevenue)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Other Income</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(otherRevenue)}</p>
        </div>
        <div className="rounded-lg border p-4 border-amber-500/30">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{formatCurrency(pendingRevenue)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari revenue..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {REVENUE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Client / Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : revenues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada revenue</p>
                </TableCell>
              </TableRow>
            ) : (
              revenues.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="font-medium">{tx.description}</TableCell>
                  <TableCell className="text-muted-foreground">{tx.category}</TableCell>
                  <TableCell>
                    {tx.client && <p className="text-sm">{tx.client.company_name}</p>}
                    {tx.invoice && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="size-3" /> {tx.invoice.invoice_number}</p>}
                    {!tx.client && !tx.invoice && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(tx.transaction_date)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{PAYMENT_METHOD_LABELS[tx.payment_method] || tx.payment_method}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tx.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {tx.status === 'completed' ? 'Completed' : 'Pending'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">+{formatCurrency(Number(tx.amount))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(tx)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(tx)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Revenue' : 'Record Revenue'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVENUE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi revenue" rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (IDR)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client (Optional)</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v === 'none' ? '' : v, project_id: '', invoice_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project (Optional)</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v === 'none' ? '' : v })} disabled={!form.client_id}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Invoice (Optional)</Label>
                <Select value={form.invoice_id} onValueChange={(v) => setForm({ ...form, invoice_id: v === 'none' ? '' : v })} disabled={!form.client_id}>
                  <SelectTrigger><SelectValue placeholder="Link to invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} ({formatCurrency(inv.total)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as typeof form.payment_method })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'completed' | 'pending' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reference (Optional)</Label>
                <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Receipt no, etc." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
