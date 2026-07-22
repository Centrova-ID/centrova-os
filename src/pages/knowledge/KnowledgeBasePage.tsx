import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate, KNOWLEDGE_CATEGORY_LABELS } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, BookOpen, Eye } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Article = Database['public']['Tables']['knowledge_articles']['Row']

const CATEGORIES = Object.keys(KNOWLEDGE_CATEGORY_LABELS)

export function KnowledgeBasePage() {
  const { user } = useAuth()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [viewing, setViewing] = useState<Article | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'sop' as string,
    tags: '',
    status: 'draft' as string,
  })

  const loadArticles = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('knowledge_articles').select('*').is('deleted_at', null).order('updated_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
    const { data } = await query
    setArticles((data || []) as Article[])
    setLoading(false)
  }, [search, categoryFilter, statusFilter])

  useEffect(() => { loadArticles() }, [loadArticles])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', content: '', category: 'sop', tags: '', status: 'draft' })
    setDialogOpen(true)
  }

  function openEdit(article: Article) {
    setEditing(article)
    setForm({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags?.join(', ') || '',
      status: article.status,
    })
    setDialogOpen(true)
  }

  async function handleView(article: Article) {
    setViewing(article)
    setViewOpen(true)
    await supabase.from('knowledge_articles').update({ views: article.views + 1 }).eq('id', article.id)
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title wajib diisi'); return }
    setSaving(true)
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const payload = {
        title: form.title.trim(),
        content: form.content,
        category: form.category,
        tags,
        status: form.status,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('knowledge_articles').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'knowledge', activity_type: 'updated', description: `Article ${form.title} diperbarui`, entity_id: editing.id, entity_type: 'knowledge_article' })
        toast.success('Article diperbarui')
      } else {
        const { data, error } = await supabase.from('knowledge_articles').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error
        await logActivity({ module: 'knowledge', activity_type: 'created', description: `Article ${form.title} dibuat`, entity_id: data.id, entity_type: 'knowledge_article' })
        toast.success('Article dibuat')
      }
      setDialogOpen(false)
      loadArticles()
    } catch (err) {
      toast.error('Gagal menyimpan article')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(article: Article) {
    if (!confirm('Hapus article ini?')) return
    const { error } = await supabase.from('knowledge_articles').update({ deleted_at: new Date().toISOString() }).eq('id', article.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'knowledge', activity_type: 'deleted', description: `Article ${article.title} dihapus`, entity_id: article.id, entity_type: 'knowledge_article' })
    toast.success('Article dihapus')
    loadArticles()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Pusat pengetahuan perusahaan"
        action={{ label: 'Add Article', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari artikel..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{KNOWLEDGE_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="size-12 mx-auto mb-3 opacity-30" />
          <p>Belum ada artikel</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map(article => (
            <Card key={article.id} className="flex flex-col">
              <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{article.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(article.updated_at)}</p>
                      </div>
                      <Badge variant={article.status === 'published' ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {article.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-xs">{KNOWLEDGE_CATEGORY_LABELS[article.category] || article.category}</Badge>
                      <p className="text-sm text-muted-foreground line-clamp-3">{article.content.slice(0, 200)}</p>
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 3).map(tag => <span key={tag} className="text-xs text-muted-foreground">#{tag}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleView(article)}><Eye className="size-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(article)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(article)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Article' : 'Add Article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Judul artikel" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{KNOWLEDGE_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2, tag3" />
            </div>
            <div className="space-y-1.5">
              <Label>Content (Markdown)</Label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Tulis artikel..." rows={8} className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {viewing && (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{KNOWLEDGE_CATEGORY_LABELS[viewing.category] || viewing.category}</Badge>
                  <span className="text-xs text-muted-foreground">{viewing.views} views</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">{viewing.content}</div>
                {viewing.tags && viewing.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t">
                    {viewing.tags.map(tag => <span key={tag} className="text-xs text-muted-foreground">#{tag}</span>)}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
