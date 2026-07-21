import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, KNOWLEDGE_CATEGORY_LABELS } from '@/lib/utils'
import { BookOpen, FileText, Sparkles, TrendingUp, ArrowRight } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Article = Database['public']['Tables']['knowledge_articles']['Row']
type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

export function KnowledgeDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [articleCount, setArticleCount] = useState(0)
  const [templateCount, setTemplateCount] = useState(0)
  const [publishedCount, setPublishedCount] = useState(0)
  const [recentArticles, setRecentArticles] = useState<Article[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [artRes, tplRes, pubRes, recentRes, activityRes] = await Promise.all([
      supabase.from('knowledge_articles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('templates').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('knowledge_articles').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
      supabase.from('knowledge_articles').select('*').is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
      supabase.from('activity_logs').select('*').in('module', ['knowledge', 'ai']).order('created_at', { ascending: false }).limit(8),
    ])
    setArticleCount(artRes.count || 0)
    setTemplateCount(tplRes.count || 0)
    setPublishedCount(pubRes.count || 0)
    setRecentArticles((recentRes.data || []) as Article[])
    setRecentActivity((activityRes.data || []) as ActivityLog[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const stats = [
    { label: 'Knowledge Articles', value: articleCount, icon: BookOpen, color: 'text-pink-600', route: '/knowledge/base' },
    { label: 'Published', value: publishedCount, icon: FileText, color: 'text-green-600', route: '/knowledge/base' },
    { label: 'Templates', value: templateCount, icon: FileText, color: 'text-blue-600', route: '/knowledge/templates' },
    { label: 'AI Assistant', value: 'Chat', icon: Sparkles, color: 'text-violet-600', route: '/knowledge/ai' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge & AI" description="Pusat pengetahuan dan AI Assistant Centrova" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)
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
              <BookOpen className="size-4 text-pink-600" />
              Recent Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : recentArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada artikel</p>
            ) : (
              <div className="space-y-2">
                {recentArticles.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded" onClick={() => navigate('/knowledge/base')}>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{KNOWLEDGE_CATEGORY_LABELS[a.category] || a.category}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(a.updated_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-muted-foreground" />
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
                {recentActivity.map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-sm border-b pb-2 last:border-0">
                    <div className={`size-2 rounded-full shrink-0 ${log.module === 'knowledge' ? 'bg-pink-500' : 'bg-violet-500'}`} />
                    <p className="flex-1 min-w-0 truncate">{log.description}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: 'AI Assistant', desc: 'Tanya jawab dengan AI tentang data Centrova', route: '/knowledge/ai', icon: Sparkles, color: 'text-violet-600' },
          { title: 'AI Search', desc: 'Cari informasi dari seluruh dokumen', route: '/knowledge/ai-search', icon: Sparkles, color: 'text-blue-600' },
          { title: 'AI Reports', desc: 'Generate laporan otomatis', route: '/knowledge/ai-reports', icon: Sparkles, color: 'text-green-600' },
        ].map(item => (
          <Card key={item.title} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(item.route)}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className={`size-5 ${item.color}`} />
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
