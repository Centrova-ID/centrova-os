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
  ASSET_CATEGORY_LABELS, ASSET_STATUS_LABELS,
} from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, Laptop,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Asset = Database['public']['Tables']['assets']['Row']

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS)
const STATUSES = Object.keys(ASSET_STATUS_LABELS)

export function AssetsPage() {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: 'laptop' as string,
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    purchase_price: '',
    warranty_expiration: '',
    condition: '',
    status: 'active' as string,
    notes: '',
  })

  const loadAssets = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('assets').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,serial_number.ilike.%${search}%`)
    const { data } = await query
    setAssets((data || []) as Asset[])
    setLoading(false)
  }, [search, categoryFilter, statusFilter])

  useEffect(() => { loadAssets() }, [loadAssets])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', category: 'laptop', brand: '', model: '', serial_number: '', purchase_date: '', purchase_price: '', warranty_expiration: '', condition: '', status: 'active', notes: '' })
    setDialogOpen(true)
  }

  function openEdit(asset: Asset) {
    setEditing(asset)
    setForm({
      name: asset.name,
      category: asset.category,
      brand: asset.brand || '',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      purchase_date: asset.purchase_date || '',
      purchase_price: asset.purchase_price ? String(asset.purchase_price) : '',
      warranty_expiration: asset.warranty_expiration || '',
      condition: asset.condition || '',
      status: asset.status,
      notes: asset.notes || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nama aset wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        serial_number: form.serial_number.trim() || null,
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        warranty_expiration: form.warranty_expiration || null,
        condition: form.condition.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('assets').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'company', activity_type: 'updated', description: `Asset ${form.name} diperbarui`, entity_id: editing.id, entity_type: 'asset' })
        toast.success('Asset diperbarui')
      } else {
        const { data, error } = await supabase.from('assets').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error
        await logActivity({ module: 'company', activity_type: 'created', description: `Asset ${form.name} ditambahkan`, entity_id: data.id, entity_type: 'asset' })
        toast.success('Asset ditambahkan')
      }
      setDialogOpen(false)
      loadAssets()
    } catch (err) {
      toast.error('Gagal menyimpan asset')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(asset: Asset) {
    if (!confirm('Hapus asset ini?')) return
    const { error } = await supabase.from('assets').update({ deleted_at: new Date().toISOString() }).eq('id', asset.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'company', activity_type: 'deleted', description: `Asset ${asset.name} dihapus`, entity_id: asset.id, entity_type: 'asset' })
    toast.success('Asset dihapus')
    loadAssets()
  }

  const totalValue = assets.reduce((s, a) => s + Number(a.purchase_price), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Management"
        description="Kelola seluruh aset perusahaan"
        action={{ label: 'Add Asset', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Laptop className="size-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Total Assets</p>
          </div>
          <p className="text-2xl font-bold mt-1">{assets.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Active Assets</p>
          <p className="text-2xl font-bold mt-1">{assets.filter(a => a.status === 'active').length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari asset..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{ASSET_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{ASSET_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand / Model</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Warranty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Laptop className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada asset</p>
                </TableCell>
              </TableRow>
            ) : (
              assets.map(asset => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{ASSET_CATEGORY_LABELS[asset.category] || asset.category}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{[asset.brand, asset.model].filter(Boolean).join(' / ') || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{asset.serial_number || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{asset.purchase_date ? formatDate(asset.purchase_date) : '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{asset.warranty_expiration ? formatDate(asset.warranty_expiration) : '-'}</TableCell>
                  <TableCell><StatusBadge status={asset.status} type="asset" /></TableCell>
                  <TableCell className="text-right font-medium text-xs">{asset.purchase_price ? formatCurrency(Number(asset.purchase_price)) : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(asset)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(asset)}>
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
            <DialogTitle>{editing ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Asset Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. MacBook Pro 14" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{ASSET_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Apple" />
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="e.g. M3 Pro" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="Serial number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Price (IDR)</Label>
                <Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Warranty Expiration</Label>
                <Input type="date" value={form.warranty_expiration} onChange={e => setForm({ ...form, warranty_expiration: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{ASSET_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Input value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} placeholder="e.g. Good, Fair, Damaged" />
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
