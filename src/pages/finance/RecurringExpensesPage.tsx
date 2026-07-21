import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  formatCurrency, formatDate, PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS, FREQUENCY_LABELS, isOverdue,
} from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Calendar, RefreshCw, TrendingDown, CheckCircle2, Zap,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type RecurringExpense = Database['public']['Tables']['recurring_expenses']['Row']

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS)
const FREQUENCIES = Object.keys(FREQUENCY_LABELS)

function getNextDate(current: string, freq: string): string {
  const d = new Date(current)
  switch (freq) {
    case 'daily': d.setDate(d.getDate() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    default: d.setMonth(d.getMonth() + 1)
  }
  return d.toISOString().split('T')[0]
}

export function RecurringExpensesPage() {
  const { user } = useAuth()
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringExpense | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: 'operational' as RecurringExpense['category'],
    description: '',
    vendor: '',
    amount: '',
    frequency: 'monthly' as RecurringExpense['frequency'],
    start_date: new Date().toISOString().split('T')[0],
    next_due_date: new Date().toISOString().split('T')[0],
    end_date: '',
    payment_method: 'bank_transfer' as RecurringExpense['payment_method'],
    is_active: true,
  })

  const loadRecurring = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('next_due_date', { ascending: true })
    setRecurring(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadRecurring() }, [loadRecurring])

  function openCreate() {
    setEditing(null)
    const today = new Date().toISOString().split('T')[0]
    setForm({
      name: '',
      category: 'operational',
      description: '',
      vendor: '',
      amount: '',
      frequency: 'monthly',
      start_date: today,
      next_due_date: today,
      end_date: '',
      payment_method: 'bank_transfer',
      is_active: true,
    })
    setDialogOpen(true)
  }

  function openEdit(item: RecurringExpense) {
    setEditing(item)
    setForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      vendor: item.vendor || '',
      amount: String(item.amount),
      frequency: item.frequency,
      start_date: item.start_date,
      next_due_date: item.next_due_date,
      end_date: item.end_date || '',
      payment_method: item.payment_method,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error('Name dan amount wajib diisi')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        vendor: form.vendor.trim() || null,
        amount: Number(form.amount),
        frequency: form.frequency,
        start_date: form.start_date,
        next_due_date: form.next_due_date,
        end_date: form.end_date || null,
        payment_method: form.payment_method,
        is_active: form.is_active,
        created_by: user?.id,
      }

      if (editing) {
        const { error } = await supabase.from('recurring_expenses').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'finance', activity_type: 'updated', description: `Recurring expense ${form.name} diperbarui`, entity_id: editing.id, entity_type: 'recurring_expense' })
        toast.success('Recurring expense diperbarui')
      } else {
        const { data, error } = await supabase.from('recurring_expenses').insert(payload).select().single()
        if (error) throw error
        await logActivity({ module: 'finance', activity_type: 'created', description: `Recurring expense ${form.name} dibuat`, entity_id: data.id, entity_type: 'recurring_expense' })
        toast.success('Recurring expense dibuat')
      }
      setDialogOpen(false)
      loadRecurring()
    } catch (err) {
      toast.error('Gagal menyimpan recurring expense')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: RecurringExpense) {
    const { error } = await supabase.from('recurring_expenses').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { toast.error('Gagal mengubah status'); return }
    toast.success(item.is_active ? 'Nonaktifkan' : 'Aktifkan')
    loadRecurring()
  }

  async function handleDelete(item: RecurringExpense) {
    if (!confirm('Hapus recurring expense ini?')) return
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', item.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'finance', activity_type: 'deleted', description: `Recurring expense ${item.name} dihapus`, entity_id: item.id, entity_type: 'recurring_expense' })
    toast.success('Recurring expense dihapus')
    loadRecurring()
  }

  async function handleRecordPayment(item: RecurringExpense) {
    const today = new Date().toISOString().split('T')[0]
    const { data: expData, error: expError } = await supabase.from('expenses').insert({
      category: item.category,
      description: item.name,
      vendor: item.vendor,
      amount: item.amount,
      expense_date: today,
      payment_method: item.payment_method,
      is_recurring: true,
      recurring_expense_id: item.id,
      created_by: user?.id,
    }).select().single()
    if (expError) { toast.error('Gagal membuat expense'); return }

    await supabase.from('transactions').insert({
      type: 'expense',
      category: EXPENSE_CATEGORY_LABELS[item.category],
      description: item.name,
      amount: item.amount,
      transaction_date: today,
      reference: `expense-${expData.id}`,
      payment_method: item.payment_method,
      status: 'completed',
      created_by: user?.id,
    })

    const nextDate = getNextDate(item.next_due_date, item.frequency)
    await supabase.from('recurring_expenses').update({ next_due_date: nextDate }).eq('id', item.id)

    await logActivity({ module: 'finance', activity_type: 'created', description: `Recurring expense ${item.name} recorded`, entity_id: expData.id, entity_type: 'expense' })
    toast.success(`Expense ${item.name} recorded`)
    loadRecurring()
  }

  const active = recurring.filter(r => r.is_active)
  const overdue = active.filter(r => isOverdue(r.next_due_date))
  const totalMonthly = active.reduce((s, r) => {
    const monthlyAmount = r.frequency === 'daily' ? r.amount * 30
      : r.frequency === 'weekly' ? r.amount * 4.33
      : r.frequency === 'monthly' ? r.amount
      : r.frequency === 'quarterly' ? r.amount / 3
      : r.frequency === 'yearly' ? r.amount / 12
      : r.amount
    return s + monthlyAmount
  }, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring Expenses"
        description="Pengeluaran berulang — otomatis terjadwal"
        action={{ label: 'Add Recurring', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Active Recurring</p>
          </div>
          <p className="text-2xl font-bold mt-1">{active.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Due Now</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-amber-600">{overdue.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-red-600" />
            <p className="text-xs text-muted-foreground">Est. Monthly</p>
          </div>
          <p className="text-xl font-bold mt-1 text-red-600">{formatCurrency(totalMonthly)}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : recurring.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="size-8 mx-auto mb-2 opacity-30" />
            <p className="text-muted-foreground">Belum ada recurring expense</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recurring.map(item => {
            const overdueDue = isOverdue(item.next_due_date) && item.is_active
            return (
              <Card key={item.id} className={`${overdueDue ? 'border-amber-500/50' : ''} ${!item.is_active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {FREQUENCY_LABELS[item.frequency]}
                        </span>
                        {!item.is_active && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                      {item.vendor && <p className="text-xs text-muted-foreground mt-0.5">Vendor: {item.vendor}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-red-600">{formatCurrency(Number(item.amount))}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <span className="text-muted-foreground">
                      Category: {EXPENSE_CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="text-muted-foreground">
                      Payment: {PAYMENT_METHOD_LABELS[item.payment_method]}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className={`size-3.5 ${overdueDue ? 'text-amber-600' : 'text-muted-foreground'}`} />
                      <span className={overdueDue ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                        {overdueDue ? 'Due now' : 'Next due'}: {formatDate(item.next_due_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.is_active && overdueDue && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRecordPayment(item)}>
                          <Zap className="size-3" /> Record
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(item)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => handleToggle(item)}>
                        <CheckCircle2 className={`size-3.5 ${item.is_active ? 'text-green-600' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Recurring Expense' : 'Add Recurring Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office Rent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as RecurringExpense['category'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RecurringExpense['frequency'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (Optional)</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Catatan tambahan" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (IDR)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor (Optional)</Label>
                <Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. BCA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Next Due Date</Label>
                <Input type="date" value={form.next_due_date} onChange={e => setForm({ ...form, next_due_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>End Date (Optional)</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as RecurringExpense['payment_method'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
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
