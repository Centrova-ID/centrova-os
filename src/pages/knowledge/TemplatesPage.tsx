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
import { toast } from 'sonner'
import { TEMPLATE_CATEGORY_LABELS } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, FileText, Copy, Archive } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Template = Database['public']['Tables']['templates']['Row']

const CATEGORIES = Object.keys(TEMPLATE_CATEGORY_LABELS)

export function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: 'proposal' as string,
    content: '',
    is_active: true,
  })

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('templates').select('*').is('deleted_at', null).order('updated_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (search) query = query.or(`name.ilike.%${search}%`)
    const { data } = await query
    setTemplates((data || []) as Template[])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', category: 'proposal', content: '', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(tpl: Template) {
    setEditing(tpl)
    setForm({ name: tpl.name, category: tpl.category, content: tpl.content, is_active: tpl.is_active })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        content: form.content,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('templates').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'knowledge', activity_type: 'updated', description: `Template ${form.name} diperbarui`, entity_id: editing.id, entity_type: 'template' })
        toast.success('Template diperbarui')
      } else {
        const { data, error } = await supabase.from('templates').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error
        await logActivity({ module: 'knowledge', activity_type: 'created', description: `Template ${form.name} dibuat`, entity_id: data.id, entity_type: 'template' })
        toast.success('Template dibuat')
      }
      setDialogOpen(false)
      loadTemplates()
    } catch (err) {
      toast.error('Gagal menyimpan template')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate(tpl: Template) {
    const { data, error } = await supabase.from('templates').insert({
      name: `${tpl.name} (Copy)`,
      category: tpl.category,
      content: tpl.content,
      is_active: true,
      created_by: user?.id,
    }).select().single()
    if (error) { toast.error('Gagal duplikasi'); return }
    await logActivity({ module: 'knowledge', activity_type: 'created', description: `Template ${tpl.name} diduplikasi`, entity_id: data.id, entity_type: 'template' })
    toast.success('Template diduplikasi')
    loadTemplates()
  }

  async function handleArchive(tpl: Template) {
    await supabase.from('templates').update({ is_active: !tpl.is_active, updated_at: new Date().toISOString() }).eq('id', tpl.id)
    toast.success(tpl.is_active ? 'Template diarsipkan' : 'Template dipulihkan')
    loadTemplates()
  }

  async function handleDelete(tpl: Template) {
    if (!confirm('Hapus template ini?')) return
    const { error } = await supabase.from('templates').update({ deleted_at: new Date().toISOString() }).eq('id', tpl.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'knowledge', activity_type: 'deleted', description: `Template ${tpl.name} dihapus`, entity_id: tpl.id, entity_type: 'template' })
    toast.success('Template dihapus')
    loadTemplates()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Template perusahaan untuk proposal, invoice, kontrak, dan lainnya"
        action={{ label: 'Add Template', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari template..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <FileText className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada template</p>
                </TableCell>
              </TableRow>
            ) : (
              templates.map(tpl => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{TEMPLATE_CATEGORY_LABELS[tpl.category] || tpl.category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={tpl.is_active ? 'default' : 'outline'} className="text-xs">
                      {tpl.is_active ? 'Active' : 'Archived'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(tpl)} title="Edit"><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDuplicate(tpl)} title="Duplicate"><Copy className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => handleArchive(tpl)} title="Archive"><Archive className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(tpl)} title="Delete"><Trash2 className="size-3.5" /></Button>
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
            <DialogTitle>{editing ? 'Edit Template' : 'Add Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Template Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Proposal Template" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Content (Markdown)</Label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Isi template..." rows={10} className="font-mono text-sm" />
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
