import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatCurrency } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { InvoicePrintView } from '@/components/invoices/InvoicePrintView'
import { InvoiceVersionHistory } from '@/components/invoices/InvoiceVersionHistory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Plus, Trash2, Save, Send, CheckCircle, Printer, History } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceStatus = Invoice['status']
type Client = Database['public']['Tables']['clients']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type CompanyProfile = Database['public']['Tables']['company_profile']['Row']

interface InvoiceItemForm {
  id?: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  total: number
  sort_order: number
  isNew?: boolean
  created_at?: string
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItemForm[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [form, setForm] = useState<Partial<Invoice>>({})

  const loadInvoice = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [invRes, itemsRes, clientsRes, projRes, compRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
      supabase.from('clients').select('*').is('deleted_at', null).order('company_name'),
      supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('company_profile').select('*').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle(),
    ])
    const inv = invRes.data
    setInvoice(inv)
    setForm(inv || {})
    setItems((itemsRes.data || []).map(i => ({ ...i, isNew: false })))
    setClients(clientsRes.data || [])
    setProjects((projRes.data || []) as Project[])
    setCompanyProfile(compRes.data as CompanyProfile | null)
    if (inv?.client_id) {
      const cl = (clientsRes.data || []).find(c => c.id === inv.client_id) || null
      setClient(cl)
    }
    setLoading(false)
    setIsDirty(false)
  }, [id])

  useEffect(() => { loadInvoice() }, [loadInvoice])

  function calcTotals(currentItems: InvoiceItemForm[], discount: number, taxRate: number) {
    const subtotal = currentItems.reduce((sum, item) => sum + item.total, 0)
    const discountAmount = discount
    const taxable = subtotal - discountAmount
    const taxAmount = taxable * (taxRate / 100)
    const total = taxable + taxAmount
    return { subtotal, taxAmount, total }
  }

  function updateItem(index: number, field: keyof InvoiceItemForm, value: string | number) {
    setItems(items => {
      const updated = [...items]
      updated[index] = { ...updated[index], [field]: value }
      const item = updated[index]
      if (field === 'quantity' || field === 'unit_price' || field === 'discount') {
        const qty = field === 'quantity' ? Number(value) : item.quantity
        const price = field === 'unit_price' ? Number(value) : item.unit_price
        const disc = field === 'discount' ? Number(value) : item.discount
        updated[index].total = qty * price * (1 - disc / 100)
      }
      return updated
    })
    setIsDirty(true)
  }

  function addItem() {
    setItems(items => [...items, { description: '', quantity: 1, unit_price: 0, discount: 0, total: 0, sort_order: items.length, isNew: true }])
    setIsDirty(true)
  }

  function removeItem(index: number) {
    setItems(items => items.filter((_, i) => i !== index))
    setIsDirty(true)
  }

  const { subtotal, taxAmount, total } = calcTotals(items, Number(form.discount || 0), Number(form.tax_rate || 0))

  async function createVersionSnapshot() {
    if (!invoice) return
    const { data: versions } = await supabase
      .from('invoice_versions')
      .select('version_number')
      .eq('invoice_id', invoice.id)
      .order('version_number', { ascending: false })
      .limit(1)
    const nextVersion = (versions?.[0]?.version_number ?? 0) + 1
    const { data: currentItems } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order')
    await supabase.from('invoice_versions').insert({
      invoice_id: invoice.id,
      version_number: nextVersion,
      snapshot: { ...invoice },
      items_snapshot: currentItems || [],
      change_summary: `Manual save — version ${nextVersion}`,
      created_by: user?.id,
    })
  }

  async function handleSave() {
    if (!invoice) return
    setSaving(true)
    await createVersionSnapshot()
    const updateData = {
      ...form,
      subtotal,
      tax_amount: taxAmount,
      total,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('invoices').update(updateData).eq('id', invoice.id)
    await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id)
    if (items.length > 0) {
      await supabase.from('invoice_items').insert(
        items.map((item, i) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          total: item.total,
          sort_order: i,
        }))
      )
    }
    await logActivity({ module: 'invoices', activity_type: 'updated', description: `Invoice ${invoice.invoice_number} diperbarui`, entity_id: invoice.id, entity_type: 'invoice' })
    setIsDirty(false)
    setSaving(false)
    loadInvoice()
  }

  async function handleStatusChange(newStatus: InvoiceStatus) {
    if (!invoice) return
    await supabase.from('invoices').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', invoice.id)
    await logActivity({ module: 'invoices', activity_type: 'updated', description: `Invoice ${invoice.invoice_number} status → ${newStatus}`, entity_id: invoice.id, entity_type: 'invoice' })
    loadInvoice()
  }

  async function handleDelete() {
    if (!invoice) return
    await supabase.from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', invoice.id)
    await logActivity({ module: 'invoices', activity_type: 'deleted', description: `Invoice ${invoice.invoice_number} dihapus`, entity_id: invoice.id, entity_type: 'invoice' })
    navigate('/invoices')
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (!invoice) return <div className="text-center py-20 text-muted-foreground">Invoice tidak ditemukan</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}><ArrowLeft className="size-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <StatusBadge status={invoice.status} type="invoice" />
          </div>
          {client && <p className="text-sm text-muted-foreground mt-0.5">{client.company_name}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => setVersionOpen(true)}>
            <History className="size-4" />Versions
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
            <Printer className="size-4" />Print / PDF
          </Button>
          {isDirty && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="size-4" />{saving ? 'Saving...' : 'Save'}
            </Button>
          )}
          {invoice.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('sent')}>
              <Send className="size-4" />Send
            </Button>
          )}
          {invoice.status === 'sent' && (
            <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleStatusChange('paid')}>
              <CheckCircle className="size-4" />Mark Paid
            </Button>
          )}
          <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Client</Label>
              <Select value={form.client_id || ''} onValueChange={v => { setForm(f => ({ ...f, client_id: v || null })); setIsDirty(true); setClient(clients.find(c => c.id === v) || null) }}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Project</Label>
              <Select value={form.project_id || ''} onValueChange={v => { setForm(f => ({ ...f, project_id: v || null })); setIsDirty(true) }}>
                <SelectTrigger><SelectValue placeholder="Pilih project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Issue Date</Label>
              <Input type="date" value={form.issue_date || ''} onChange={e => { setForm(f => ({ ...f, issue_date: e.target.value })); setIsDirty(true) }} />
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date || ''} onChange={e => { setForm(f => ({ ...f, due_date: e.target.value })); setIsDirty(true) }} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes || ''} onChange={e => { setForm(f => ({ ...f, notes: e.target.value })); setIsDirty(true) }} placeholder="Catatan untuk client..." />
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3 h-fit">
          <h3 className="font-semibold text-sm">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Discount</span>
              <Input type="number" className="h-7 w-28 text-right" min={0} value={form.discount || 0}
                onChange={e => { setForm(f => ({ ...f, discount: Number(e.target.value) })); setIsDirty(true) }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tax (%)</span>
              <Input type="number" className="h-7 w-28 text-right" min={0} max={100} step={0.5} value={form.tax_rate || 0}
                onChange={e => { setForm(f => ({ ...f, tax_rate: Number(e.target.value) })); setIsDirty(true) }} />
            </div>
            <div className="flex justify-between text-muted-foreground"><span>Tax Amount</span><span>{formatCurrency(taxAmount)}</span></div>
            <Separator />
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line Items</h3>
          <Button size="sm" variant="outline" onClick={addItem}><Plus className="size-3" />Add Item</Button>
        </div>
        <div className="p-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Belum ada item. Klik Add Item untuk menambahkan.</p>
          ) : (
            <>
              <div className="grid gap-2 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: '1fr 80px 120px 80px 100px 36px' }}>
                <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit Price</span><span className="text-right">Disc%</span><span className="text-right">Total</span><span />
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 80px 120px 80px 100px 36px' }}>
                  <Input className="h-8 text-sm" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Deskripsi..." />
                  <Input className="h-8 text-sm text-right" type="number" min={0} step={0.01} value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                  <Input className="h-8 text-sm text-right" type="number" min={0} value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} />
                  <Input className="h-8 text-sm text-right" type="number" min={0} max={100} value={item.discount} onChange={e => updateItem(i, 'discount', Number(e.target.value))} />
                  <span className="text-sm font-medium text-right">{formatCurrency(item.total)}</span>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}><Trash2 className="size-3.5" /></Button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {(invoice.status === 'paid' || invoice.status === 'sent') && (
        <div className="space-y-2">
          <Label>Payment Notes</Label>
          <Textarea rows={2} value={form.payment_notes || ''} onChange={e => { setForm(f => ({ ...f, payment_notes: e.target.value })); setIsDirty(true) }} placeholder="Catatan pembayaran..." />
        </div>
      )}

      {invoice.status !== 'draft' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="flex-1">
            <p className="text-sm font-medium">Status History</p>
            <p className="text-xs text-muted-foreground">Invoice dibuat: {formatDate(invoice.created_at)}</p>
          </div>
          {invoice.status !== 'cancelled' && (
            <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => handleStatusChange('cancelled')}>
              Cancel Invoice
            </Button>
          )}
        </div>
      )}

      <InvoicePrintView
        open={printOpen}
        onOpenChange={setPrintOpen}
        invoice={invoice}
        items={items.map((item, i) => ({
          id: item.id ?? `temp-${i}`,
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          total: item.total,
          sort_order: item.sort_order,
          created_at: item.created_at ?? new Date().toISOString(),
        }))}
        clientName={client?.company_name || ''}
        clientAddress={client?.address || ''}
        clientEmail={client?.email || ''}
        company={companyProfile}
      />

      <InvoiceVersionHistory
        invoiceId={invoice.id}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        onRestored={() => { setVersionOpen(false); loadInvoice() }}
      />

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Invoice?</AlertDialogTitle>
            <AlertDialogDescription>Invoice <strong>{invoice.invoice_number}</strong> akan dihapus.</AlertDialogDescription>
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
