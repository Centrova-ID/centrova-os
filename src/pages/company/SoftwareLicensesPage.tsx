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
import { StatusBadge } from '@/components/shared/StatusBadge'
import { toast } from 'sonner'
import {
  formatCurrency, formatDate,
  LICENSE_TYPE_LABELS, LICENSE_STATUS_LABELS,
} from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, KeyRound,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type License = Database['public']['Tables']['software_licenses']['Row']

const LICENSE_TYPES = Object.keys(LICENSE_TYPE_LABELS)
const STATUSES = Object.keys(LICENSE_STATUS_LABELS)
const BILLING_CYCLES: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }

export function SoftwareLicensesPage() {
  const { user } = useAuth()
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<License | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    vendor: '',
    license_type: 'subscription' as string,
    billing_cycle: 'monthly' as string,
    renewal_date: '',
    cost: '',
    status: 'active' as string,
    notes: '',
  })

  const loadLicenses = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('software_licenses').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (search) query = query.or(`name.ilike.%${search}%,vendor.ilike.%${search}%`)
    const { data } = await query
    setLicenses((data || []) as License[])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { loadLicenses() }, [loadLicenses])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', vendor: '', license_type: 'subscription', billing_cycle: 'monthly', renewal_date: '', cost: '', status: 'active', notes: '' })
    setDialogOpen(true)
  }

  function openEdit(lic: License) {
    setEditing(lic)
    setForm({
      name: lic.name,
      vendor: lic.vendor || '',
      license_type: lic.license_type,
      billing_cycle: lic.billing_cycle || 'monthly',
      renewal_date: lic.renewal_date || '',
      cost: lic.cost ? String(lic.cost) : '',
      status: lic.status,
      notes: lic.notes || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nama software wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        vendor: form.vendor.trim() || null,
        license_type: form.license_type,
        billing_cycle: form.license_type === 'free' ? null : form.billing_cycle,
        renewal_date: form.renewal_date || null,
        cost: form.cost ? Number(form.cost) : 0,
        status: form.status,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('software_licenses').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'company', activity_type: 'updated', description: `License ${form.name} diperbarui`, entity_id: editing.id, entity_type: 'software_license' })
        toast.success('License diperbarui')
      } else {
        const { data, error } = await supabase.from('software_licenses').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error
        await logActivity({ module: 'company', activity_type: 'created', description: `License ${form.name} ditambahkan`, entity_id: data.id, entity_type: 'software_license' })
        toast.success('License ditambahkan')
      }
      setDialogOpen(false)
      loadLicenses()
    } catch (err) {
      toast.error('Gagal menyimpan license')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(lic: License) {
    if (!confirm('Hapus license ini?')) return
    const { error } = await supabase.from('software_licenses').update({ deleted_at: new Date().toISOString() }).eq('id', lic.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'company', activity_type: 'deleted', description: `License ${lic.name} dihapus`, entity_id: lic.id, entity_type: 'software_license' })
    toast.success('License dihapus')
    loadLicenses()
  }

  const totalCost = licenses.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.cost), 0)
  const expiringSoon = licenses.filter(l => {
    if (!l.renewal_date || l.status !== 'active') return false
    const days = (new Date(l.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  }).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Software & Licenses"
        description="Kelola seluruh software dan subscription perusahaan"
        action={{ label: 'Add Software', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-purple-600" />
            <p className="text-xs text-muted-foreground">Total Licenses</p>
          </div>
          <p className="text-2xl font-bold mt-1">{licenses.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Active Cost / Cycle</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalCost)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Expiring (30 days)</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600">{expiringSoon}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari software..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{LICENSE_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Software</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>License Type</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Renewal Date</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : licenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <KeyRound className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada software license</p>
                </TableCell>
              </TableRow>
            ) : (
              licenses.map(lic => (
                <TableRow key={lic.id}>
                  <TableCell className="font-medium">{lic.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{lic.vendor || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{LICENSE_TYPE_LABELS[lic.license_type] || lic.license_type}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{lic.billing_cycle ? BILLING_CYCLES[lic.billing_cycle] || lic.billing_cycle : '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{lic.renewal_date ? formatDate(lic.renewal_date) : '-'}</TableCell>
                  <TableCell className="text-right font-medium text-xs">{lic.cost ? formatCurrency(Number(lic.cost)) : '-'}</TableCell>
                  <TableCell><StatusBadge status={lic.status} type="license" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(lic)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(lic)}>
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
            <DialogTitle>{editing ? 'Edit Software' : 'Add Software'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Software Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. GitHub" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Microsoft" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>License Type</Label>
                <Select value={form.license_type} onValueChange={v => setForm({ ...form, license_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LICENSE_TYPES.map(t => <SelectItem key={t} value={t}>{LICENSE_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{LICENSE_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.license_type !== 'free' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Billing Cycle</Label>
                  <Select value={form.billing_cycle} onValueChange={v => setForm({ ...form, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BILLING_CYCLES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cost (IDR)</Label>
                  <Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Renewal Date</Label>
              <Input type="date" value={form.renewal_date} onChange={e => setForm({ ...form, renewal_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan" rows={2} />
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
