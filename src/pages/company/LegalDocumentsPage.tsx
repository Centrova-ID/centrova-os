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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate, formatFileSize, LEGAL_DOCUMENT_CATEGORY_LABELS } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, FileCheck, Upload, FileText, X,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type LegalDoc = Database['public']['Tables']['legal_documents']['Row']

const CATEGORIES = Object.keys(LEGAL_DOCUMENT_CATEGORY_LABELS)

export function LegalDocumentsPage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<LegalDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LegalDoc | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docPreview, setDocPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    category: 'akta_pendirian' as string,
    document_number: '',
    issue_date: '',
    expiration_date: '',
    notes: '',
  })

  const loadDocs = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('legal_documents').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (search) query = query.or(`title.ilike.%${search}%,document_number.ilike.%${search}%`)
    const { data } = await query
    setDocs((data || []) as LegalDoc[])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => { loadDocs() }, [loadDocs])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', category: 'akta_pendirian', document_number: '', issue_date: '', expiration_date: '', notes: '' })
    setDocFile(null)
    setDocPreview(null)
    setDialogOpen(true)
  }

  function openEdit(doc: LegalDoc) {
    setEditing(doc)
    setForm({
      title: doc.title,
      category: doc.category,
      document_number: doc.document_number || '',
      issue_date: doc.issue_date || '',
      expiration_date: doc.expiration_date || '',
      notes: doc.notes || '',
    })
    setDocFile(null)
    setDocPreview(doc.file_url || null)
    setDialogOpen(true)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File terlalu besar (max 100MB)')
      return
    }
    setDocFile(file)
    setDocPreview(null)
  }

  async function uploadDoc(docId: string, file: File): Promise<{ url: string; path: string } | null> {
    const ext = file.name.split('.').pop()
    const filePath = `legal/${docId}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true })
    if (error) { console.error('Upload error:', error); return null }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
    return { url: urlData.publicUrl, path: filePath }
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        document_number: form.document_number.trim() || null,
        issue_date: form.issue_date || null,
        expiration_date: form.expiration_date || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('legal_documents').update(payload).eq('id', editing.id)
        if (error) throw error

        if (docFile) {
          setUploading(true)
          const result = await uploadDoc(editing.id, docFile)
          if (result) {
            await supabase.from('legal_documents').update({ file_url: result.url, file_path: result.path }).eq('id', editing.id)
          }
          setUploading(false)
        }

        await logActivity({ module: 'company', activity_type: 'updated', description: `Legal document ${form.title} diperbarui`, entity_id: editing.id, entity_type: 'legal_document' })
        toast.success('Document diperbarui')
      } else {
        const { data, error } = await supabase.from('legal_documents').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error

        if (docFile) {
          setUploading(true)
          const result = await uploadDoc(data.id, docFile)
          if (result) {
            await supabase.from('legal_documents').update({ file_url: result.url, file_path: result.path }).eq('id', data.id)
          }
          setUploading(false)
        }

        await logActivity({ module: 'company', activity_type: 'created', description: `Legal document ${form.title} ditambahkan`, entity_id: data.id, entity_type: 'legal_document' })
        toast.success('Document ditambahkan')
      }
      setDialogOpen(false)
      loadDocs()
    } catch (err) {
      toast.error('Gagal menyimpan document')
      console.error(err)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  async function handleDelete(doc: LegalDoc) {
    if (!confirm('Hapus document ini?')) return
    const { error } = await supabase.from('legal_documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id)
    if (error) { toast.error('Gagal menghapus'); return }
    if (doc.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path])
    }
    await logActivity({ module: 'company', activity_type: 'deleted', description: `Legal document ${doc.title} dihapus`, entity_id: doc.id, entity_type: 'legal_document' })
    toast.success('Document dihapus')
    loadDocs()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Documents"
        description="Dokumen legal dan administrasi perusahaan"
        action={{ label: 'Add Document', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <FileCheck className="size-4 text-orange-600" />
            <p className="text-xs text-muted-foreground">Total Documents</p>
          </div>
          <p className="text-2xl font-bold mt-1">{docs.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold mt-1">{new Set(docs.map(d => d.category)).size}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">With Files</p>
          <p className="text-2xl font-bold mt-1">{docs.filter(d => d.file_url).length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari dokumen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{LEGAL_DOCUMENT_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Document Number</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <FileCheck className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada legal document</p>
                </TableCell>
              </TableRow>
            ) : (
              docs.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{LEGAL_DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{doc.document_number || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{doc.issue_date ? formatDate(doc.issue_date) : '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{doc.expiration_date ? formatDate(doc.expiration_date) : '-'}</TableCell>
                  <TableCell>
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <FileText className="size-3.5" /> View
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(doc)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(doc)}>
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
            <DialogTitle>{editing ? 'Edit Document' : 'Add Document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Akta Pendirian" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{LEGAL_DOCUMENT_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Document Number</Label>
              <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} placeholder="e.g. AHU-0012345" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiration Date</Label>
                <Input type="date" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Document File (Optional)</Label>
              <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileSelect} />
              {docPreview ? (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <FileText className="size-5 text-muted-foreground" />
                  <a href={docPreview} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex-1 truncate">View current file</a>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => { setDocPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : docFile ? (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <FileText className="size-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{docFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(docFile.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => { setDocFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" /> Upload Document
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
