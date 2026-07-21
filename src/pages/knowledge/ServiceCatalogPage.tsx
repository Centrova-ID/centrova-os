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
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { formatCurrency, SERVICE_CATEGORY_LABELS, BILLING_TYPE_LABELS } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type ServiceItem = Database['public']['Tables']['service_catalog']['Row']

const CATEGORIES = Object.keys(SERVICE_CATEGORY_LABELS)
const BILLING_TYPES = Object.keys(BILLING_TYPE_LABELS)

export function ServiceCatalogPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'website' as string,
    billing_type: 'one_time' as string,
    default_price: '',
    unit: 'project',
    notes: '',
    is_active: true,
  })

  const loadItems = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('service_catalog').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    const { data } = await query
    setItems((data || []) as ServiceItem[])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => { loadItems() }, [loadItems])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', category: 'website', billing_type: 'one_time', default_price: '', unit: 'project', notes: '', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: ServiceItem) {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description || '',
      category: item.category,
      billing_type: item.billing_type,
      default_price: item.default_price ? String(item.default_price) : '',
      unit: item.unit || 'project',
      notes: item.notes || '',
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        billing_type: form.billing_type,
        default_price: form.default_price ? Number(form.default_price) : 0,
        unit: form.unit.trim() || 'project',
        notes: form.notes.trim() || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('service_catalog').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'knowledge', activity_type: 'updated', description: `Service ${form.name} diperbarui`, entity_id: editing.id, entity_type: 'service_catalog' })
        toast.success('Service diperbarui')
      } else {
        const { data, error } = await supabase.from('service_catalog').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error
        await logActivity({ module: 'knowledge', activity_type: 'created', description: `Service ${form.name} ditambahkan`, entity_id: data.id, entity_type: 'service_catalog' })
        toast.success('Service ditambahkan')
      }
      setDialogOpen(false)
      loadItems()
    } catch (err) {
      toast.error('Gagal menyimpan service')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: ServiceItem) {
    if (!confirm('Hapus service ini?')) return
    const { error } = await supabase.from('service_catalog').update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'knowledge', activity_type: 'deleted', description: `Service ${item.name} dihapus`, entity_id: item.id, entity_type: 'service_catalog' })
    toast.success('Service dihapus')
    loadItems()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Catalog"
        description="Katalog layanan dan pricing untuk invoice"
        action={{ label: 'Add Service', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari service..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Billing Type</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Default Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Package className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada service</p>
                </TableCell>
              </TableRow>
            ) : (
              items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{SERVICE_CATEGORY_LABELS[item.category] || item.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{BILLING_TYPE_LABELS[item.billing_type] || item.billing_type}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{item.unit || '-'}</TableCell>
                  <TableCell className="text-right font-medium text-xs">{item.default_price ? formatCurrency(Number(item.default_price)) : '-'}</TableCell>
                  <TableCell><Badge variant={item.is_active ? 'default' : 'outline'} className="text-xs">{item.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}><Trash2 className="size-3.5" /></Button>
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
            <DialogTitle>{editing ? 'Edit Service' : 'Add Service'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Service Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website Development" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi layanan" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Type</Label>
                <Select value={form.billing_type} onValueChange={v => setForm({ ...form, billing_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_TYPES.map(b => <SelectItem key={b} value={b}>{BILLING_TYPE_LABELS[b]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default Price (IDR)</Label>
                <Input type="number" value={form.default_price} onChange={e => setForm({ ...form, default_price: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="project / month / etc" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan" rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
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
