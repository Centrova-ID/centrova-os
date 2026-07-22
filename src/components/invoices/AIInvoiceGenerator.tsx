import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, Plus, Trash2, AlertCircle, Wand2 } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Client = Database['public']['Tables']['clients']['Row']
type Project = Database['public']['Tables']['projects']['Row']

interface DraftItem {
  description: string
  quantity: number
  unit_price: number
  discount: number
  total: number
  sort_order: number
}

interface Draft {
  invoice_number: string
  notes: string
  payment_notes: string
  due_date: string
  items: DraftItem[]
}

interface AIInvoiceGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'context' | 'generating' | 'review'

function calcTotal(items: DraftItem[]) {
  return items.reduce((s, i) => s + i.total, 0)
}

function recalcItem(item: DraftItem): DraftItem {
  return { ...item, total: item.quantity * item.unit_price * (1 - item.discount / 100) }
}

export function AIInvoiceGenerator({ open, onOpenChange }: AIInvoiceGeneratorProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('context')
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('clients').select('id, company_name').is('deleted_at', null).order('company_name')
      .then(({ data }) => setClients((data || []) as Client[]))
  }, [open])

  const loadProjects = useCallback(async (cId: string) => {
    if (!cId) { setProjects([]); return }
    const { data } = await supabase.from('projects').select('id, name').eq('client_id', cId).is('deleted_at', null).order('name')
    setProjects((data || []) as Project[])
  }, [])

  useEffect(() => { loadProjects(clientId) }, [clientId, loadProjects])

  function handleClose() {
    setStep('context')
    setClientId('')
    setProjectId('')
    setAdditionalContext('')
    setDraft(null)
    setError(null)
    onOpenChange(false)
  }

  async function handleGenerate() {
    setStep('generating')
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          clientId: clientId || null,
          projectId: projectId || null,
          additionalContext: additionalContext || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || `Request failed (${res.status})`)
        setStep('context')
        return
      }
      setDraft(data.draft)
      setStep('review')
    } catch (err) {
      setError('Gagal terhubung ke AI. Periksa koneksi Anda.')
      setStep('context')
    }
  }

  function updateItem(idx: number, field: keyof DraftItem, val: string | number) {
    if (!draft) return
    setDraft(d => {
      if (!d) return d
      const items = [...d.items]
      items[idx] = recalcItem({ ...items[idx], [field]: val })
      return { ...d, items }
    })
  }

  function addItem() {
    if (!draft) return
    const newItem: DraftItem = { description: '', quantity: 1, unit_price: 0, discount: 0, total: 0, sort_order: draft.items.length }
    setDraft(d => d ? { ...d, items: [...d.items, newItem] } : d)
  }

  function removeItem(idx: number) {
    if (!draft) return
    setDraft(d => d ? { ...d, items: d.items.filter((_, i) => i !== idx) } : d)
  }

  async function handleCreateInvoice() {
    if (!draft) return
    setSaving(true)
    try {
      const subtotal = calcTotal(draft.items)
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        invoice_number: draft.invoice_number,
        client_id: clientId || null,
        project_id: projectId || null,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: draft.due_date,
        status: 'draft',
        subtotal,
        discount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total: subtotal,
        notes: draft.notes || null,
        payment_notes: draft.payment_notes || null,
        created_by: user?.id,
      }).select().single()

      if (invErr || !inv) throw invErr || new Error('Invoice insert failed')

      if (draft.items.length > 0) {
        await supabase.from('invoice_items').insert(
          draft.items.map((item, i) => ({
            invoice_id: inv.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            total: item.total,
            sort_order: i,
          }))
        )
      }

      await logActivity({
        module: 'invoices',
        activity_type: 'ai_generated',
        description: `Invoice ${draft.invoice_number} dibuat dengan AI`,
        entity_id: inv.id,
        entity_type: 'invoice',
      })

      handleClose()
      navigate(`/invoices/${inv.id}`)
    } catch (err) {
      setError('Gagal membuat invoice. Silakan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const subtotal = draft ? calcTotal(draft.items) : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" />
            AI Invoice Generator
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'context' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pilih konteks untuk membantu AI membuat invoice yang akurat.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client (Opsional)</Label>
                <Select value={clientId} onValueChange={v => { setClientId(v === 'none' ? '' : v); setProjectId('') }}>
                  <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa client</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project (Opsional)</Label>
                <Select value={projectId} onValueChange={v => setProjectId(v === 'none' ? '' : v)} disabled={!clientId}>
                  <SelectTrigger><SelectValue placeholder="Pilih project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa project</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Konteks Tambahan (Opsional)</Label>
              <Textarea
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                placeholder="Contoh: Invoice untuk maintenance bulanan Juli 2025, termasuk 10 jam development dan 5 jam konsultasi..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Batal</Button>
              <Button onClick={handleGenerate}>
                <Wand2 className="size-4" /> Generate Invoice
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'generating' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-violet-500 animate-pulse" />
              <p className="text-sm">AI sedang membuat draft invoice...</p>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {step === 'review' && draft && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Review dan edit draft invoice sebelum dibuat. AI telah mengisi otomatis berdasarkan konteks.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Invoice Number</Label>
                <Input value={draft.invoice_number} onChange={e => setDraft(d => d ? { ...d, invoice_number: e.target.value } : d)} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={draft.due_date} onChange={e => setDraft(d => d ? { ...d, due_date: e.target.value } : d)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (untuk client)</Label>
              <Textarea rows={2} value={draft.notes} onChange={e => setDraft(d => d ? { ...d, notes: e.target.value } : d)} />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Notes</Label>
              <Textarea rows={2} value={draft.payment_notes} onChange={e => setDraft(d => d ? { ...d, payment_notes: e.target.value } : d)} />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="size-3" />Add Item</Button>
              </div>
              <div className="text-xs font-medium text-muted-foreground grid gap-1" style={{ gridTemplateColumns: '1fr 70px 110px 70px 90px 32px' }}>
                <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit Price</span><span className="text-right">Disc%</span><span className="text-right">Total</span><span />
              </div>
              {draft.items.map((item, i) => (
                <div key={i} className="grid gap-1 items-center" style={{ gridTemplateColumns: '1fr 70px 110px 70px 90px 32px' }}>
                  <Input className="h-8 text-sm" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Deskripsi..." />
                  <Input className="h-8 text-sm text-right" type="number" min={0} value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} />
                  <Input className="h-8 text-sm text-right" type="number" min={0} value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} />
                  <Input className="h-8 text-sm text-right" type="number" min={0} max={100} value={item.discount} onChange={e => updateItem(i, 'discount', Number(e.target.value))} />
                  <span className="text-sm font-medium text-right">{formatCurrency(item.total)}</span>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}><Trash2 className="size-3.5" /></Button>
                </div>
              ))}
              {draft.items.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">Belum ada item</p>}
            </div>

            <div className="flex justify-end text-sm">
              <div className="space-y-1 w-48">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('context')}>Kembali</Button>
              <Button variant="outline" onClick={handleGenerate}>
                <Wand2 className="size-4" /> Regenerate
              </Button>
              <Button onClick={handleCreateInvoice} disabled={saving || !draft.invoice_number}>
                {saving ? 'Membuat...' : 'Buat Invoice'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
