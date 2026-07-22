import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import {
  Laptop, KeyRound, UserCircle, FileCheck, AlertTriangle, Activity as ActivityIcon,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Asset = Database['public']['Tables']['assets']['Row']
type SoftwareLicense = Database['public']['Tables']['software_licenses']['Row']
type LegalDocument = Database['public']['Tables']['legal_documents']['Row']
type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

interface ExpiringItem {
  name: string
  type: string
  date: string
}

export function CompanyDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState(0)
  const [licenses, setLicenses] = useState(0)
  const [accounts, setAccounts] = useState(0)
  const [legalDocs, setLegalDocs] = useState(0)
  const [expiring, setExpiring] = useState<ExpiringItem[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [assetRes, licenseRes, accountRes, legalRes, activityRes] = await Promise.all([
      supabase.from('assets').select('id, name, warranty_expiration').is('deleted_at', null),
      supabase.from('software_licenses').select('id, name, renewal_date, status').is('deleted_at', null),
      supabase.from('company_accounts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('legal_documents').select('id, title, expiration_date').is('deleted_at', null),
      supabase.from('activity_logs').select('*').eq('module', 'company').order('created_at', { ascending: false }).limit(10),
    ])

    setAssets(assetRes.data?.length || 0)
    setLicenses(licenseRes.data?.length || 0)
    setAccounts(accountRes.count || 0)
    setLegalDocs(legalRes.data?.length || 0)
    setRecentActivity(activityRes.data || [])

    const now = new Date()
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    const items: ExpiringItem[] = []

    for (const a of (assetRes.data || []) as Asset[]) {
      if (a.warranty_expiration) {
        const d = new Date(a.warranty_expiration)
        if (d >= now && d <= in90Days) items.push({ name: a.name, type: 'Warranty', date: a.warranty_expiration })
      }
    }
    for (const l of (licenseRes.data || []) as SoftwareLicense[]) {
      if (l.renewal_date && l.status === 'active') {
        const d = new Date(l.renewal_date)
        if (d >= now && d <= in90Days) items.push({ name: l.name, type: 'License Renewal', date: l.renewal_date })
      }
    }
    for (const doc of (legalRes.data || []) as LegalDocument[]) {
      if (doc.expiration_date) {
        const d = new Date(doc.expiration_date)
        if (d >= now && d <= in90Days) items.push({ name: doc.title, type: 'Legal Document', date: doc.expiration_date })
      }
    }

    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    setExpiring(items)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = [
    { label: 'Total Assets', value: assets, icon: Laptop, color: 'text-blue-600', route: '/company/assets' },
    { label: 'Software Licenses', value: licenses, icon: KeyRound, color: 'text-purple-600', route: '/company/software' },
    { label: 'Company Accounts', value: accounts, icon: UserCircle, color: 'text-teal-600', route: '/company/accounts' },
    { label: 'Legal Documents', value: legalDocs, icon: FileCheck, color: 'text-orange-600', route: '/company/legal' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Dashboard"
        description="Ringkasan administrasi perusahaan Centrova"
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((s) => (
            <Card key={s.label} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(s.route)}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <s.icon className={`size-4 ${s.color}`} />
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
                <p className="text-2xl font-bold mt-2">{s.value}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-yellow-600" />
              Upcoming Expiration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada item yang akan kedaluwarsa dalam 90 hari</p>
            ) : (
              <div className="space-y-2">
                {expiring.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(item.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="size-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada aktivitas</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-center gap-2 text-sm border-b pb-2 last:border-0">
                    <div className="size-2 rounded-full bg-primary/40 shrink-0" />
                    <p className="flex-1 min-w-0 truncate">{log.description}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
