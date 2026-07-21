import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Search, Sparkles, AlertCircle, FileText } from 'lucide-react'

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

interface SearchResult {
  source: string
  title: string
  snippet: string
}

export function AISearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!query.trim() || loading) return
    setLoading(true)
    setError(null)
    setResults([])
    setAiAnswer(null)
    setSearched(true)

    try {
      // Search across knowledge articles, documents, templates
      const [articles, docs, templates, legalDocs] = await Promise.all([
        supabase.from('knowledge_articles').select('id, title, content, category').or(`title.ilike.%${query}%,content.ilike.%${query}%`).is('deleted_at', null).limit(10),
        supabase.from('documents').select('id, name, description').or(`name.ilike.%${query}%,description.ilike.%${query}%`).is('deleted_at', null).limit(10),
        supabase.from('templates').select('id, name, content, category').or(`name.ilike.%${query}%,content.ilike.%${query}%`).is('deleted_at', null).limit(10),
        supabase.from('legal_documents').select('id, title, notes, category').or(`title.ilike.%${query}%,notes.ilike.%${query}%`).is('deleted_at', null).limit(10),
      ])

      const found: SearchResult[] = []
      for (const a of (articles.data || [])) found.push({ source: 'Knowledge', title: a.title, snippet: a.content.slice(0, 200) })
      for (const d of (docs.data || [])) found.push({ source: 'Document', title: d.name, snippet: d.description || '' })
      for (const t of (templates.data || [])) found.push({ source: 'Template', title: t.name, snippet: t.content.slice(0, 200) })
      for (const l of (legalDocs.data || [])) found.push({ source: 'Legal', title: l.title, snippet: l.notes || '' })
      setResults(found)

      // Also ask AI for a summary answer
      const context = found.map(r => `[${r.source}] ${r.title}: ${r.snippet}`).join('\n')
      const response = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Berdasarkan hasil pencarian berikut, jawab pertanyaan: "${query}"\n\nHasil pencarian:\n${context || 'Tidak ada hasil ditemukan.'}` }],
          context: '',
        }),
      })
      const data = await response.json()
      if (response.ok && data.message) setAiAnswer(data.message)
      else if (data.error) setError(data.error)
    } catch (err) {
      setError('Gagal melakukan pencarian AI')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Document Search"
        description="Cari informasi dari seluruh dokumen perusahaan dengan AI"
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari dokumen, artikel, template..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          <Sparkles className="size-4" /> Search
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {!loading && aiAnswer && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-violet-500" />
              <p className="font-medium text-sm">AI Answer</p>
            </div>
            <p className="text-sm whitespace-pre-wrap">{aiAnswer}</p>
          </CardContent>
        </Card>
      )}

      {!loading && searched && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{results.length} hasil ditemukan</p>
          {results.map((r, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{r.title}</p>
                      <Badge variant="secondary" className="text-xs">{r.source}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.snippet}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && !aiAnswer && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="size-8 mx-auto mb-2 opacity-30" />
          <p>Tidak ada hasil ditemukan untuk "{query}"</p>
        </div>
      )}
    </div>
  )
}
