import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Building2, Mail, Phone } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { useAuth } from '@/contexts/AuthContext'

type Client = Database['public']['Tables']['clients']['Row']
type ClientInsert = Database['public']['Tables']['clients']['Insert']
type ClientStatus = Client['status']

const STATUS_OPTIONS: ClientStatus[] = ['prospect', 'active', 'completed', 'inactive']
const INDUSTRY_OPTIONS = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Media', 'Consulting', 'Other']

export function ClientsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientInsert>(defaultForm())

  function defaultForm(): ClientInsert {
    return {
      company_name: '', pic_name: '', email: '', whatsapp: '',
      website: '', industry: '', address: '', notes: '', status: 'prospect',
    }
  }

  const loadClients = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('clients').select('*').is('deleted_at', null).order('company_name')
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as ClientStatus)
    if (search) query = query.ilike('company_name', `%${search}%`)
    const { data } = await query
    setClients(data || [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { loadClients() }, [loadClients])

  function openCreate() {
    setEditingClient(null)
    setForm(defaultForm())
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.company_name.trim()) return
    setSaving(true)
    try {
      if (editingClient) {
        await supabase.from('clients').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingClient.id)
        await logActivity({ module: 'clients', activity_type: 'updated', description: `Client ${form.company_name} diperbarui`, entity_id: editingClient.id, entity_type: 'client' })
      } else {
        const { data } = await supabase.from('clients').insert({ ...form, created_by: user?.id }).select().single()
        if (data) await logActivity({ module: 'clients', activity_type: 'created', description: `Client ${form.company_name} dibuat`, entity_id: data.id, entity_type: 'client' })
      }
      setShowForm(false)
      loadClients()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Kelola seluruh client Centrova"
        action={{ label: 'Add Client', onClick: openCreate, icon: <Plus className="size-4" /> }}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari client..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Building2 className="size-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada client</p>
                </TableCell>
              </TableRow>
            ) : (
              clients.map(client => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                        {client.company_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{client.company_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.pic_name || '-'}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {client.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" />{client.email}</div>}
                      {client.whatsapp && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{client.whatsapp}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.industry ? <Badge variant="outline" className="text-xs">{client.industry}</Badge> : '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} type="client" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Company Name *</Label>
              <Input value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="PT Contoh Indonesia" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>PIC Name</Label>
                <Input value={form.pic_name || ''} onChange={e => setForm(f => ({ ...f, pic_name: e.target.value }))} placeholder="Budi Santoso" />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status || 'prospect'} onValueChange={v => setForm(f => ({ ...f, status: v as ClientStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="pic@company.com" />
              </div>
              <div className="grid gap-2">
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp || ''} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+62812..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Website</Label>
                <Input value={form.website || ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://company.com" />
              </div>
              <div className="grid gap-2">
                <Label>Industry</Label>
                <Select value={form.industry || ''} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Textarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} placeholder="Jl. Contoh No. 1, Jakarta" />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Catatan tambahan..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.company_name?.trim()}>
              {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
