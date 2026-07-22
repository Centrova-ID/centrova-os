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
  formatCurrency, formatDate, PAYMENT_METHOD_LABELS,
} from '@/lib/utils'
import {
  Plus, Search, ArrowUpRight, ArrowDownRight, Pencil, Trash2,
  Receipt, Wallet, TrendingUp, TrendingDown,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row']

interface TransactionWithClient extends Transaction {
  client?: { company_name: string } | null
}

export function CashBookPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<TransactionWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'General',
    description: '',
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    reference: '',
    payment_method: 'bank_transfer' as 'bank_transfer' | 'cash' | 'qris' | 'card' | 'other',
    status: 'completed' as 'completed' | 'pending',
  })

  const loadTransactions = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*, client:clients(company_name)')
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })

    if (typeFilter !== 'all') query = query.eq('type', typeFilter as 'income' | 'expense')
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as 'completed' | 'pending')
    if (search) query = query.or(`description.ilike.%${search}%,category.ilike.%${search}%,reference.ilike.%${search}%`)

    const { data } = await query
    setTransactions((data || []) as TransactionWithClient[])
    setLoading(false)
  }, [search, typeFilter, statusFilter])

  useEffect(() => { loadTransactions() }, [loadTransactions])

  function openCreate() {
    setEditing(null)
    setForm({
      type: 'income',
      category: 'General',
      description: '',
      amount: '',
      transaction_date: new Date().toISOString().split('T')[0],
      reference: '',
      payment_method: 'bank_transfer',
      status: 'completed',
    })
    setDialogOpen(true)
  }

  function openEdit(tx: Transaction) {
    setEditing(tx)
    setForm({
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: String(tx.amount),
      transaction_date: tx.transaction_date,
      reference: tx.reference || '',
      payment_method: tx.payment_method,
      status: tx.status,
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
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
        transaction_date: form.transaction_date,
        reference: form.reference.trim() || null,
        payment_method: form.payment_method,
        status: form.status,
        created_by: user?.id,
      }

      if (editing) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'finance', activity_type: 'updated', description: `Transaksi ${form.description} diperbarui`, entity_id: editing.id, entity_type: 'transaction' })
        toast.success('Transaksi diperbarui')
      } else {
        const { data, error } = await supabase.from('transactions').insert(payload).select().single()
        if (error) throw error
        await logActivity({ module: 'finance', activity_type: 'created', description: `Transaksi ${form.description} dibuat`, entity_id: data.id, entity_type: 'transaction' })
        toast.success('Transaksi dibuat')
      }
      setDialogOpen(false)
      loadTransactions()
    } catch (err) {
      toast.error('Gagal menyimpan transaksi')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!confirm('Hapus transaksi ini?')) return
    const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', tx.id)
    if (error) {
      toast.error('Gagal menghapus')
      return
    }
    await logActivity({ module: 'finance', activity_type: 'deleted', description: `Transaksi ${tx.description} dihapus`, entity_id: tx.id, entity_type: 'transaction' })
    toast.success('Transaksi dihapus')
    loadTransactions()
  }

  const completed = transactions.filter(t => t.status === 'completed')
  const totalIncome = completed.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = completed.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const cashBalance = totalIncome - totalExpense

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash Book"
        description="Buku kas harian — semua transaksi masuk dan keluar"
        action={{ label: 'New Transaction', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Cash Balance</p>
          </div>
          <p className={`text-2xl font-bold mt-1 ${cashBalance >= 0 ? '' : 'text-red-600'}`}>{formatCurrency(cashBalance)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Total Income</p>
          </div>
          <p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-red-600" />
            <p className="text-xs text-muted-foreground">Total Expense</p>
          </div>
          <p className="text-xl font-bold mt-1 text-red-600">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari transaksi..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Receipt className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada transaksi</p>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className={`flex size-7 items-center justify-center rounded-full ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      {tx.type === 'income'
                        ? <ArrowUpRight className="size-3.5 text-green-600" />
                        : <ArrowDownRight className="size-3.5 text-red-600" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{tx.description}</p>
                    {tx.reference && <p className="text-xs text-muted-foreground">Ref: {tx.reference}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tx.category}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(tx.transaction_date)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{PAYMENT_METHOD_LABELS[tx.payment_method] || tx.payment_method}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tx.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {tx.status === 'completed' ? 'Completed' : 'Pending'}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                  </TableCell>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Transaction' : 'New Transaction'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as 'income' | 'expense' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Software Subscription" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi transaksi" rows={2} />
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
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as typeof form.payment_method })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="space-y-1.5">
              <Label>Reference (Optional)</Label>
              <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Invoice number, receipt number, etc." />
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
