import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatDateTime } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Pencil, Trash2, Plus, Globe, Mail, Phone, MapPin, Building2, Calendar } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Client = Database['public']['Tables']['clients']['Row']
type Timeline = Database['public']['Tables']['client_timeline']['Row']
type Project = Database['public']['Tables']['projects']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']
type Document = Database['public']['Tables']['documents']['Row']
type ClientStatus = Client['status']

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [timeline, setTimeline] = useState<Timeline[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Client>>({})
  const [timelineForm, setTimelineForm] = useState({ type: 'meeting' as Timeline['type'], title: '', description: '', event_date: '' })
  const [saving, setSaving] = useState(false)

  const loadClient = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [clientRes, tlRes, projRes, invRes, docRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).maybeSingle(),
      supabase.from('client_timeline').select('*').eq('client_id', id).order('event_date', { ascending: false }),
      supabase.from('projects').select('*').eq('client_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('client_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    setClient(clientRes.data)
    setTimeline(tlRes.data || [])
    setProjects(projRes.data || [])
    setInvoices(invRes.data || [])
    setDocuments(docRes.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadClient() }, [loadClient])

  async function handleEdit() {
    if (!client || !editForm.company_name?.trim()) return
    setSaving(true)
    await supabase.from('clients').update({ ...editForm, updated_at: new Date().toISOString() }).eq('id', client.id)
    await logActivity({ module: 'clients', activity_type: 'updated', description: `Client ${editForm.company_name} diperbarui`, entity_id: client.id, entity_type: 'client' })
    setShowEdit(false)
    setSaving(false)
    loadClient()
  }

  async function handleDelete() {
    if (!client) return
    await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', client.id)
    await logActivity({ module: 'clients', activity_type: 'deleted', description: `Client ${client.company_name} dihapus`, entity_id: client.id, entity_type: 'client' })
    navigate('/clients')
  }

  async function handleAddTimeline() {
    if (!client || !timelineForm.title.trim()) return
    setSaving(true)
    await supabase.from('client_timeline').insert({
      client_id: client.id,
      type: timelineForm.type,
      title: timelineForm.title,
      description: timelineForm.description || null,
      event_date: timelineForm.event_date || null,
      created_by: user?.id,
    })
    setShowTimeline(false)
    setTimelineForm({ type: 'meeting', title: '', description: '', event_date: '' })
    setSaving(false)
    loadClient()
  }

  if (loading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
  if (!client) return <div className="text-center py-20 text-muted-foreground">Client tidak ditemukan</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{client.company_name}</h1>
            <StatusBadge status={client.status} type="client" />
          </div>
          {client.industry && <p className="text-sm text-muted-foreground mt-0.5">{client.industry}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditForm(client); setShowEdit(true) }}>
            <Pencil className="size-4" />Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="size-4" />Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info Card */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informasi Client</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {client.pic_name && <InfoRow icon={<Building2 className="size-4" />} label="PIC" value={client.pic_name} />}
            {client.email && <InfoRow icon={<Mail className="size-4" />} label="Email" value={client.email} />}
            {client.whatsapp && <InfoRow icon={<Phone className="size-4" />} label="WhatsApp" value={client.whatsapp} />}
            {client.website && <InfoRow icon={<Globe className="size-4" />} label="Website" value={client.website} link />}
            {client.address && <InfoRow icon={<MapPin className="size-4" />} label="Address" value={client.address} />}
            {client.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
                <p className="text-sm">{client.notes}</p>
              </div>
            )}
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p>Dibuat: {formatDateTime(client.created_at)}</p>
              <p>Diperbarui: {formatDateTime(client.updated_at)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
              <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
              <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
              <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button size="sm" onClick={() => setShowTimeline(true)}><Plus className="size-4" />Add Event</Button>
              </div>
              {timeline.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada timeline</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline.map(event => (
                    <div key={event.id} className="flex gap-3 p-3 rounded-lg border">
                      <Badge variant="outline" className="text-xs shrink-0 h-fit">{event.type}</Badge>
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        {event.description && <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>}
                        {event.event_date && <p className="text-xs text-muted-foreground mt-1">{formatDate(event.event_date)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="projects" className="mt-4 space-y-2">
              {projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Belum ada project</div>
              ) : projects.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.deadline ? `Deadline: ${formatDate(p.deadline)}` : 'No deadline'}</p>
                  </div>
                  <StatusBadge status={p.status} type="project" />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="invoices" className="mt-4 space-y-2">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Belum ada invoice</div>
              ) : invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <div>
                    <p className="font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">Due: {formatDate(inv.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={inv.status} type="invoice" />
                    <p className="text-xs font-medium mt-1">Rp {inv.total.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-2">
              {documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Belum ada dokumen</div>
              ) : documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Company Name *</Label><Input value={editForm.company_name || ''} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>PIC Name</Label><Input value={editForm.pic_name || ''} onChange={e => setEditForm(f => ({ ...f, pic_name: e.target.value }))} /></div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as ClientStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['prospect', 'active', 'completed', 'inactive'] as ClientStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Email</Label><Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>WhatsApp</Label><Input value={editForm.whatsapp || ''} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={showTimeline} onOpenChange={setShowTimeline}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Timeline Event</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={timelineForm.type} onValueChange={v => setTimelineForm(f => ({ ...f, type: v as Timeline['type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['meeting', 'proposal', 'negotiation', 'agreement', 'note'] as Timeline['type'][]).map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Title *</Label><Input value={timelineForm.title} onChange={e => setTimelineForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Date</Label><Input type="date" value={timelineForm.event_date} onChange={e => setTimelineForm(f => ({ ...f, event_date: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea rows={3} value={timelineForm.description} onChange={e => setTimelineForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeline(false)}>Cancel</Button>
            <Button onClick={handleAddTimeline} disabled={saving || !timelineForm.title.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Client?</AlertDialogTitle>
            <AlertDialogDescription>Client <strong>{client.company_name}</strong> akan dihapus. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string; link?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {link ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">{value}</a>
        ) : (
          <p className="text-sm">{value}</p>
        )}
      </div>
    </div>
  )
}
