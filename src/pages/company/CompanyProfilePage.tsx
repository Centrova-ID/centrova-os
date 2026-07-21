import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Building2, Save, Upload, X,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type CompanyProfile = Database['public']['Tables']['company_profile']['Row']

export function CompanyProfilePage() {
  const { user } = useAuth()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    legal_entity: '',
    npwp: '',
    nib: '',
    address: '',
    email: '',
    phone: '',
    website: '',
    logo_url: '',
    brand_guidelines_url: '',
    company_profile_url: '',
    description: '',
    instagram: '',
    linkedin: '',
    threads: '',
    bluesky: '',
    youtube: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
  })

  const loadProfile = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('company_profile').select('*').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle()
    if (data) {
      setProfile(data as CompanyProfile)
      setForm({
        name: data.name || '',
        legal_entity: data.legal_entity || '',
        npwp: data.npwp || '',
        nib: data.nib || '',
        address: data.address || '',
        email: data.email || '',
        phone: data.phone || '',
        website: data.website || '',
        logo_url: data.logo_url || '',
        brand_guidelines_url: data.brand_guidelines_url || '',
        company_profile_url: data.company_profile_url || '',
        description: data.description || '',
        instagram: data.instagram || '',
        linkedin: data.linkedin || '',
        threads: data.threads || '',
        bluesky: data.bluesky || '',
        youtube: data.youtube || '',
        bank_name: data.bank_name || '',
        bank_account_number: data.bank_account_number || '',
        bank_account_name: data.bank_account_name || '',
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function handleLogoUpload(file: File) {
    if (!profile) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo terlalu besar (max 5MB)'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const filePath = `company/logo.${ext}`
    const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true })
    if (error) { toast.error('Gagal upload logo'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath)
    setForm(prev => ({ ...prev, logo_url: urlData.publicUrl }))
    setUploading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Nama perusahaan wajib diisi'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        legal_entity: form.legal_entity.trim() || null,
        npwp: form.npwp.trim() || null,
        nib: form.nib.trim() || null,
        address: form.address.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        logo_url: form.logo_url || null,
        brand_guidelines_url: form.brand_guidelines_url.trim() || null,
        company_profile_url: form.company_profile_url.trim() || null,
        description: form.description.trim() || null,
        instagram: form.instagram.trim() || null,
        linkedin: form.linkedin.trim() || null,
        threads: form.threads.trim() || null,
        bluesky: form.bluesky.trim() || null,
        youtube: form.youtube.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        bank_account_name: form.bank_account_name.trim() || null,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('company_profile').update(payload).eq('id', '00000000-0000-0000-0000-000000000001')
      if (error) throw error
      await logActivity({ module: 'company', activity_type: 'updated', description: 'Company profile diperbarui', entity_id: '00000000-0000-0000-0000-000000000001', entity_type: 'company_profile' })
      toast.success('Company profile disimpan')
      loadProfile()
    } catch (err) {
      toast.error('Gagal menyimpan profile')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Company Profile" description="Informasi utama perusahaan" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profile"
        description="Informasi utama perusahaan dalam satu tempat"
        action={{ label: 'Save', onClick: handleSave, icon: <Save className="size-4" /> }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-lg border flex items-center justify-center overflow-hidden bg-muted">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="size-full object-contain" />
                ) : (
                  <Building2 className="size-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploading}>
                  <Upload className="size-3.5" /> {uploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
                {form.logo_url && (
                  <Button variant="ghost" size="sm" className="ml-2" onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}>
                    <X className="size-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="PT Centrova Teknologi Indonesia" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Legal Entity</Label>
                <Input value={form.legal_entity} onChange={e => setForm({ ...form, legal_entity: e.target.value })} placeholder="PT" />
              </div>
              <div className="space-y-1.5">
                <Label>NPWP</Label>
                <Input value={form.npwp} onChange={e => setForm({ ...form, npwp: e.target.value })} placeholder="XX.XXX.XXX.X-XXX.XXX" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>NIB</Label>
              <Input value={form.nib} onChange={e => setForm({ ...form, nib: e.target.value })} placeholder="Nomor Induk Berusaha" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Alamat perusahaan" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hello@centrova.id" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+62..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://centrova.id" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Company Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi perusahaan" rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Brand Guidelines URL</Label>
                <Input value={form.brand_guidelines_url} onChange={e => setForm({ ...form, brand_guidelines_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>Company Profile URL</Label>
                <Input value={form.company_profile_url} onChange={e => setForm({ ...form, company_profile_url: e.target.value })} placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Instagram</Label>
                  <Input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@centrova" />
                </div>
                <div className="space-y-1.5">
                  <Label>LinkedIn</Label>
                  <Input value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} placeholder="linkedin.com/company/centrova" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Threads</Label>
                  <Input value={form.threads} onChange={e => setForm({ ...form, threads: e.target.value })} placeholder="@centrova" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bluesky</Label>
                  <Input value={form.bluesky} onChange={e => setForm({ ...form, bluesky: e.target.value })} placeholder="@centrova.bsky.social" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>YouTube</Label>
                <Input value={form.youtube} onChange={e => setForm({ ...form, youtube: e.target.value })} placeholder="@centrova" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bank Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. BCA" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Account Number</Label>
                  <Input value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} placeholder="1234567890" />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Name</Label>
                  <Input value={form.bank_account_name} onChange={e => setForm({ ...form, bank_account_name: e.target.value })} placeholder="PT Centrova" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
