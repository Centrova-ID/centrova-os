import { useEffect, useState, useCallback, useRef } from 'react'
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
  formatCurrency, formatDate, PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS, formatFileSize,
} from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, TrendingDown, Receipt, Upload, FileText, X,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Expense = Database['public']['Tables']['expenses']['Row']

interface ExpenseWithRecurring extends Expense {
  recurring_expense?: { name: string } | null
}

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS)

export function ExpensesPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expenses, setExpenses] = useState<ExpenseWithRecurring[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    category: 'operational' as Expense['category'],
    description: '',
    vendor: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer' as Expense['payment_method'],
  })

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, recurring_expense:recurring_expenses(name)')
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })

    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (search) query = query.or(`description.ilike.%${search}%,vendor.ilike.%${search}%`)

    const { data } = await query
    setExpenses((data || []) as ExpenseWithRecurring[])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => { loadExpenses() }, [loadExpenses])

  function openCreate() {
    setEditing(null)
    setForm({
      category: 'operational',
      description: '',
      vendor: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
    })
    setReceiptFile(null)
    setReceiptPreview(null)
    setDialogOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditing(exp)
    setForm({
      category: exp.category,
      description: exp.description,
      vendor: exp.vendor || '',
      amount: String(exp.amount),
      expense_date: exp.expense_date,
      payment_method: exp.payment_method,
    })
    setReceiptFile(null)
    setReceiptPreview(exp.receipt_url || null)
    setDialogOpen(true)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File terlalu besar (max 5MB)')
      return
    }
    setReceiptFile(file)
    setReceiptPreview(null)
  }

  async function uploadReceipt(expenseId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const filePath = `receipts/${expenseId}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true })
    if (error) {
      console.error('Upload error:', error)
      return null
    }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
    return urlData.publicUrl
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error('Description dan amount wajib diisi')
      return
    }
    setSaving(true)
    try {
      const payload = {
        category: form.category,
        description: form.description.trim(),
        vendor: form.vendor.trim() || null,
        amount: Number(form.amount),
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        created_by: user?.id,
      }

      if (editing) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id)
        if (error) throw error

        if (receiptFile) {
          setUploading(true)
          const url = await uploadReceipt(editing.id, receiptFile)
          if (url) {
            const ext = receiptFile.name.split('.').pop()
            const filePath = `receipts/${editing.id}.${ext}`
            await supabase.from('expenses').update({ receipt_url: url, receipt_file_path: filePath }).eq('id', editing.id)
          }
          setUploading(false)
        }

        await supabase.from('transactions').update({
          category: EXPENSE_CATEGORY_LABELS[form.category],
          description: form.description.trim(),
          amount: Number(form.amount),
          transaction_date: form.expense_date,
          payment_method: form.payment_method,
        }).eq('reference', `expense-${editing.id}`)

        await logActivity({ module: 'finance', activity_type: 'updated', description: `Expense ${form.description} diperbarui`, entity_id: editing.id, entity_type: 'expense' })
        toast.success('Expense diperbarui')
      } else {
        const { data, error } = await supabase.from('expenses').insert(payload).select().single()
        if (error) throw error

        if (receiptFile) {
          setUploading(true)
          const url = await uploadReceipt(data.id, receiptFile)
          if (url) {
            const ext = receiptFile.name.split('.').pop()
            const filePath = `receipts/${data.id}.${ext}`
            await supabase.from('expenses').update({ receipt_url: url, receipt_file_path: filePath }).eq('id', data.id)
          }
          setUploading(false)
        }

        await supabase.from('transactions').insert({
          type: 'expense',
          category: EXPENSE_CATEGORY_LABELS[form.category],
          description: form.description.trim(),
          amount: Number(form.amount),
          transaction_date: form.expense_date,
          reference: `expense-${data.id}`,
          payment_method: form.payment_method,
          status: 'completed',
          created_by: user?.id,
        })

        await logActivity({ module: 'finance', activity_type: 'created', description: `Expense ${form.description} dibuat`, entity_id: data.id, entity_type: 'expense' })
        toast.success('Expense dibuat')
      }
      setDialogOpen(false)
      loadExpenses()
    } catch (err) {
      toast.error('Gagal menyimpan expense')
      console.error(err)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  async function handleDelete(exp: Expense) {
    if (!confirm('Hapus expense ini?')) return
    const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', exp.id)
    if (error) { toast.error('Gagal menghapus'); return }

    await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('reference', `expense-${exp.id}`)

    if (exp.receipt_file_path) {
      await supabase.storage.from('documents').remove([exp.receipt_file_path])
    }

    await logActivity({ module: 'finance', activity_type: 'deleted', description: `Expense ${exp.description} dihapus`, entity_id: exp.id, entity_type: 'expense' })
    toast.success('Expense dihapus')
    loadExpenses()
  }

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const categoryTotals = EXPENSE_CATEGORIES.map(cat => ({
    category: cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Management"
        description="Pengeluaran operasional dengan kategori dan receipt"
        action={{ label: 'Record Expense', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-red-600" />
            <p className="text-xs text-muted-foreground">Total Expenses</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Transaction Count</p>
          <p className="text-2xl font-bold mt-1">{expenses.length}</p>
        </div>
        <div className="rounded-lg border p-4 lg:col-span-2">
          <p className="text-xs text-muted-foreground mb-2">Top Categories</p>
          <div className="space-y-1.5">
            {categoryTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet</p>
            ) : categoryTotals.slice(0, 3).map(c => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[c.category]}</span>
                <span className="font-medium">{formatCurrency(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari expense..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Receipt className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada expense</p>
                </TableCell>
              </TableRow>
            ) : (
              expenses.map(exp => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium">
                    {exp.description}
                    {exp.is_recurring && exp.recurring_expense && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Recurring</span>
                        {exp.recurring_expense.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}</TableCell>
                  <TableCell className="text-muted-foreground">{exp.vendor || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(exp.expense_date)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{PAYMENT_METHOD_LABELS[exp.payment_method] || exp.payment_method}</TableCell>
                  <TableCell>
                    {exp.receipt_url ? (
                      <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <FileText className="size-3.5" /> View
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">-{formatCurrency(Number(exp.amount))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(exp)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(exp)}>
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
            <DialogTitle>{editing ? 'Edit Expense' : 'Record Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Expense['category'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vendor (Optional)</Label>
                <Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Tokopedia" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi expense" rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (IDR)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as Expense['payment_method'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt (Optional)</Label>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
              {receiptPreview ? (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <FileText className="size-5 text-muted-foreground" />
                  <a href={receiptPreview} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex-1 truncate">View current receipt</a>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => { setReceiptPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : receiptFile ? (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <FileText className="size-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{receiptFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(receiptFile.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" /> Upload Receipt
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>{saving || uploading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
