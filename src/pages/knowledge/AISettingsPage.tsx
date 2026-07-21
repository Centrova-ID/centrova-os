import { useEffect, useState, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Save, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type AISettings = Database['public']['Tables']['ai_settings']['Row']

export function AISettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const [form, setForm] = useState({
    provider: 'deepseek',
    model_name: 'deepseek-chat',
    base_url: 'https://api.deepseek.com',
    api_key: '',
    max_tokens: 4096,
    temperature: 0.7,
    top_p: 0.9,
    system_prompt: '',
  })

  const loadSettings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ai_settings').select('*').eq('id', '00000000-0000-0000-0000-000000000002').maybeSingle()
    if (data) {
      setSettings(data as AISettings)
      setForm({
        provider: data.provider,
        model_name: data.model_name,
        base_url: data.base_url,
        api_key: data.api_key || '',
        max_tokens: data.max_tokens,
        temperature: data.temperature,
        top_p: data.top_p,
        system_prompt: data.system_prompt,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        provider: form.provider,
        model_name: form.model_name,
        base_url: form.base_url,
        api_key: form.api_key || null,
        max_tokens: form.max_tokens,
        temperature: form.temperature,
        top_p: form.top_p,
        system_prompt: form.system_prompt,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('ai_settings').update(payload).eq('id', '00000000-0000-0000-0000-000000000002')
      if (error) throw error
      await logActivity({ module: 'ai', activity_type: 'updated', description: 'AI Settings diperbarui', entity_id: '00000000-0000-0000-0000-000000000002', entity_type: 'ai_settings' })
      toast.success('AI Settings disimpan')
      loadSettings()
    } catch (err) {
      toast.error('Gagal menyimpan AI settings')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Settings" description="Konfigurasi AI Provider" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const isConfigured = !!settings?.api_key

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Settings"
        description="Konfigurasi AI Provider untuk Centrova AI Assistant"
        action={{ label: 'Save', onClick: handleSave, icon: <Save className="size-4" /> }}
      />

      <div className="flex items-center gap-2">
        <Badge variant={isConfigured ? 'default' : 'outline'} className="text-xs">
          {isConfigured ? 'Configured' : 'Not Configured'}
        </Badge>
        {isConfigured ? (
          <p className="text-xs text-green-600 flex items-center gap-1"><Sparkles className="size-3" /> AI siap digunakan</p>
        ) : (
          <p className="text-xs text-yellow-600 flex items-center gap-1"><AlertCircle className="size-3" /> Masukkan API Key untuk mengaktifkan AI</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>API Provider</Label>
              <Input value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="deepseek" />
            </div>
            <div className="space-y-1.5">
              <Label>Model Name</Label>
              <Input value={form.model_name} onChange={e => setForm({ ...form, model_name: e.target.value })} placeholder="deepseek-chat" />
            </div>
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.deepseek.com" />
            </div>
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={form.api_key}
                  onChange={e => setForm({ ...form, api_key: e.target.value })}
                  placeholder="sk-..."
                />
                <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">API Key disimpan dengan proteksi RLS di database.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={form.max_tokens}
                  onChange={e => setForm({ ...form, max_tokens: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature}
                    onChange={e => setForm({ ...form, temperature: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Top P</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={form.top_p}
                    onChange={e => setForm({ ...form, top_p: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.system_prompt}
                onChange={e => setForm({ ...form, system_prompt: e.target.value })}
                placeholder="Instruksi sistem untuk AI..."
                rows={6}
              />
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
