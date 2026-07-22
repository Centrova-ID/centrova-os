import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatFileSize } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Upload, Search, Trash2, Download, FolderOpen } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Document = Database['public']['Tables']['documents']['Row']
type DocCategory = Document['category']
type Client = Database['public']['Tables']['clients']['Row']
type Project = Database['public']['Tables']['projects']['Row']

const CATEGORIES: DocCategory[] = ['client', 'proposal', 'contract', 'nda', 'invoice', 'legal', 'internal']

const FILE_ICONS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/': 'IMG',
  'application/vnd': 'DOC',
  'text/': 'TXT',
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return 'FILE'
  for (const [key, val] of Object.entries(FILE_ICONS)) {
    if (fileType.includes(key)) return val
  }
  return 'FILE'
}

export function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<(Document & { client?: { company_name: string } | null; project?: { name: string } | null })[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'internal' as DocCategory,
    client_id: '',
    project_id: '',
    tags: '',
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('documents').select('*, client:clients(company_name), project:projects(name)').is('deleted_at', null).order('created_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter as DocCategory)
    if (search) query = query.ilike('name', `%${search}%`)
    const { data } = await query
    setDocuments(data || [])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id, company_name').is('deleted_at', null).order('company_name'),
      supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
    ]).then(([cl, pr]) => { setClients((cl.data || []) as Client[]); setProjects((pr.data || []) as Project[]) })
  }, [])

  function handleFileSelect(files: FileList | null) {
    if (!files) return
    const arr = Array.from(files)
    setSelectedFiles(arr)
    if (arr.length === 1) setUploadForm(f => ({ ...f, name: arr[0].name.replace(/\.[^.]+$/, '') }))
    setShowUpload(true)
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return
    setUploading(true)
    for (const file of selectedFiles) {
      const path = `${user?.id}/${Date.now()}-${file.name}`
      const { data: storageData, error: storageError } = await supabase.storage.from('documents').upload(path, file)
      if (storageError) continue
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(storageData.path)
      const docName = selectedFiles.length === 1 ? (uploadForm.name || file.name.replace(/\.[^.]+$/, '')) : file.name.replace(/\.[^.]+$/, '')
      const { data: doc } = await supabase.from('documents').insert({
        name: docName,
        original_name: file.name,
        file_url: publicUrl,
        file_path: storageData.path,
        file_size: file.size,
        file_type: file.type,
        category: uploadForm.category,
        client_id: uploadForm.client_id || null,
        project_id: uploadForm.project_id || null,
        tags: uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        uploaded_by: user?.id,
      }).select().single()
      if (doc) {
        await logActivity({ module: 'documents', activity_type: 'uploaded', description: `Dokumen ${docName} diunggah`, entity_id: doc.id, entity_type: 'document' })
      }
    }
    setUploading(false)
    setShowUpload(false)
    setSelectedFiles([])
    setUploadForm({ name: '', category: 'internal', client_id: '', project_id: '', tags: '' })
    loadDocuments()
  }

  async function handleDelete(doc: Document) {
    if (doc.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path])
    }
    await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id)
    await logActivity({ module: 'documents', activity_type: 'deleted', description: `Dokumen ${doc.name} dihapus`, entity_id: doc.id, entity_type: 'document' })
    setShowDelete(false)
    setDeletingDoc(null)
    loadDocuments()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Kelola seluruh dokumen perusahaan"
        action={{ label: 'Upload', onClick: () => fileInputRef.current?.click(), icon: <Upload className="size-4" /> }}
      />

      <input ref={fileInputRef} type="file" className="hidden" multiple onChange={e => handleFileSelect(e.target.files)} />

      {/* Drag Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Drag & drop file atau klik untuk upload</p>
        <p className="text-xs text-muted-foreground mt-1">Mendukung semua format file, maks 50MB</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari dokumen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="size-12 mx-auto mb-3 opacity-30" />
          <p>Belum ada dokumen</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map(doc => (
            <div key={doc.id} className="rounded-lg border p-4 hover:bg-muted/30 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                  {getFileIcon(doc.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                    {doc.file_size && <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>}
                  </div>
                  {(doc.client || doc.project) && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {doc.client?.company_name || doc.project?.name}
                    </p>
                  )}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {doc.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs h-4 px-1">{tag}</Badge>)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"><Download className="size-3 mr-1" />Download</a>
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { setDeletingDoc(doc); setShowDelete(true) }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Upload Dokumen</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">{selectedFiles.length} file dipilih</p>
              {selectedFiles.map(f => <p key={f.name} className="text-xs text-muted-foreground truncate">{f.name}</p>)}
            </div>
            {selectedFiles.length === 1 && (
              <div className="grid gap-2"><Label>Nama Dokumen</Label><Input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} /></div>
            )}
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={uploadForm.category} onValueChange={v => setUploadForm(f => ({ ...f, category: v as DocCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={uploadForm.client_id} onValueChange={v => setUploadForm(f => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Project</Label>
                <Select value={uploadForm.project_id} onValueChange={v => setUploadForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih project" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Tags (pisahkan dengan koma)</Label><Input value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} placeholder="design, wireframe, v1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Dokumen?</AlertDialogTitle>
            <AlertDialogDescription>Dokumen <strong>{deletingDoc?.name}</strong> akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDoc && handleDelete(deletingDoc)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
