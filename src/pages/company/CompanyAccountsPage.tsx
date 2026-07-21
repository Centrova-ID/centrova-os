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
import { ACCOUNT_CATEGORY_LABELS } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, UserCircle,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Account = Database['public']['Tables']['company_accounts']['Row']

const CATEGORIES = Object.keys(ACCOUNT_CATEGORY_LABELS)

export function CompanyAccountsPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    account_name: '',
    platform: '',
    category: 'email' as string,
    email: '',
    username: '',
    recovery_email: '',
    description: '',
    notes: '',
  })

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('company_accounts').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter)
    if (search) query = query.or(`account_name.ilike.%${search}%,platform.ilike.%${search}%,email.ilike.%${search}%`)
    const { data } = await query
    setAccounts((data || []) as Account[])
    setLoading(false)
  }, [search, categoryFilter])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  function openCreate() {
    setEditing(null)
    setForm({ account_name: '', platform: '', category: 'email', email: '', username: '', recovery_email: '', description: '', notes: '' })
    setDialogOpen(true)
  }

  function openEdit(acc: Account) {
    setEditing(acc)
    setForm({
      account_name: acc.account_name,
      platform: acc.platform || '',
      category: acc.category,
      email: acc.email || '',
      username: acc.username || '',
      recovery_email: acc.recovery_email || '',
      description: acc.description || '',
      notes: acc.notes || '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.account_name.trim()) { toast.error('Nama akun wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        account_name: form.account_name.trim(),
        platform: form.platform.trim() || null,
        category: form.category,
        email: form.email.trim() || null,
        username: form.username.trim() || null,
        recovery_email: form.recovery_email.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editing) {
        const { error } = await supabase.from('company_accounts').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity({ module: 'company', activity_type: 'updated', description: `Account ${form.account_name} diperbarui`, entity_id: editing.id, entity_type: 'company_account' })
        toast.success('Account diperbarui')
      } else {
        const { data, error } = await supabase.from('company_accounts').insert({ ...payload, created_by: user?.id }).select().single()
        if (error) throw error
        await logActivity({ module: 'company', activity_type: 'created', description: `Account ${form.account_name} ditambahkan`, entity_id: data.id, entity_type: 'company_account' })
        toast.success('Account ditambahkan')
      }
      setDialogOpen(false)
      loadAccounts()
    } catch (err) {
      toast.error('Gagal menyimpan account')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(acc: Account) {
    if (!confirm('Hapus account ini?')) return
    const { error } = await supabase.from('company_accounts').update({ deleted_at: new Date().toISOString() }).eq('id', acc.id)
    if (error) { toast.error('Gagal menghapus'); return }
    await logActivity({ module: 'company', activity_type: 'deleted', description: `Account ${acc.account_name} dihapus`, entity_id: acc.id, entity_type: 'company_account' })
    toast.success('Account dihapus')
    loadAccounts()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Accounts"
        description="Referensi akun digital perusahaan (password tidak disimpan)"
        action={{ label: 'Add Account', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <UserCircle className="size-4 text-teal-600" />
            <p className="text-xs text-muted-foreground">Total Accounts</p>
          </div>
          <p className="text-2xl font-bold mt-1">{accounts.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold mt-1">{new Set(accounts.map(a => a.category)).size}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Platforms</p>
          <p className="text-2xl font-bold mt-1">{new Set(accounts.map(a => a.platform).filter(Boolean)).size}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari akun..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{ACCOUNT_CATEGORY_LABELS[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <UserCircle className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada account</p>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{acc.account_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{acc.platform || '-'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{ACCOUNT_CATEGORY_LABELS[acc.category] || acc.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{acc.email || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{acc.username || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(acc)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => handleDelete(acc)}>
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
            <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account Name</Label>
                <Input value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} placeholder="e.g. Centrova Gmail" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{ACCOUNT_CATEGORY_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Input value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} placeholder="e.g. Gmail, GitHub, Cloudflare" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Recovery Email</Label>
              <Input type="email" value={form.recovery_email} onChange={e => setForm({ ...form, recovery_email: e.target.value })} placeholder="recovery@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi akun" rows={2} />
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
