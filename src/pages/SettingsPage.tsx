import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

export function SettingsPage() {
  const { user, profile, signOut } = useAuth()
  const [name, setName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!user || !name.trim()) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name, updated_at: new Date().toISOString() }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Kelola akun dan preferensi sistem" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Informasi akun Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-lg">{getInitials(profile?.full_name || 'U')}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{profile?.full_name || 'Founder'}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nama Lengkap</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="opacity-60" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Info</CardTitle>
          <CardDescription>Informasi sistem Centrova OS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>1.0.0 (Phase 1)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Product</span>
            <span>Centrova OS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Company</span>
            <span>PT Centrova Teknologi Indonesia</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={signOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
