import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Plus, Send, Trash2, Star, MessageSquare, Sparkles, AlertCircle } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Chat = Database['public']['Tables']['ai_chats']['Row']
type Message = Database['public']['Tables']['ai_messages']['Row']

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`

export function AIAssistantPage() {
  const { user } = useAuth()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadChats = useCallback(async () => {
    setLoadingChats(true)
    const { data } = await supabase.from('ai_chats').select('*').is('deleted_at', null).order('updated_at', { ascending: false })
    setChats((data || []) as Chat[])
    setLoadingChats(false)
  }, [])

  useEffect(() => { loadChats() }, [loadChats])

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true)
    const { data } = await supabase.from('ai_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
    setMessages((data || []) as Message[])
    setLoadingMessages(false)
  }, [])

  useEffect(() => {
    if (activeChat) loadMessages(activeChat.id)
    else setMessages([])
  }, [activeChat, loadMessages])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function handleNewChat() {
    const { data, error } = await supabase.from('ai_chats').insert({
      title: 'New Chat',
      created_by: user?.id,
    }).select().single()
    if (error) { toast.error('Gagal membuat chat'); return }
    setChats(prev => [data as Chat, ...prev])
    setActiveChat(data as Chat)
    setError(null)
  }

  async function handleSend() {
    if (!input.trim() || sending) return
    if (!activeChat) {
      // Create a new chat first
      const { data, error } = await supabase.from('ai_chats').insert({
        title: input.slice(0, 40),
        created_by: user?.id,
      }).select().single()
      if (error) { toast.error('Gagal membuat chat'); return }
      setChats(prev => [data as Chat, ...prev])
      setActiveChat(data as Chat)
      await sendToAI(data.id, input)
      return
    }
    await sendToAI(activeChat.id, input)
  }

  async function sendToAI(chatId: string, userMessage: string) {
    setSending(true)
    setError(null)
    setInput('')

    // Optimistic: add user message to UI
    const tempUserMsg: Message = {
      id: 'temp-user',
      chat_id: chatId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    // Build context from Centrova data
    const context = await buildContext()

    // Update chat title if it's still "New Chat"
    const chat = chats.find(c => c.id === chatId)
    if (chat && chat.title === 'New Chat') {
      const newTitle = userMessage.slice(0, 40)
      await supabase.from('ai_chats').update({ title: newTitle, updated_at: new Date().toISOString() }).eq('id', chatId)
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c))
    }

    try {
      const allMessages = [...messages, { role: 'user', content: userMessage }]
      const response = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, context, chatId }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        setError(data.error || `HTTP ${response.status}`)
        toast.error(data.error || 'AI request failed')
      } else {
        const assistantMsg: Message = {
          id: 'temp-assistant',
          chat_id: chatId,
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
        await logActivity({ module: 'ai', activity_type: 'chat', description: `AI chat message in "${chat?.title || 'chat'}"`, entity_id: chatId, entity_type: 'ai_chat' })
      }
    } catch (err) {
      setError('Gagal terhubung ke AI. Periksa konfigurasi AI Settings.')
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  async function buildContext(): Promise<string> {
    try {
      const [clients, projects, invoices, expenses, tasks] = await Promise.all([
        supabase.from('clients').select('id, name, email, status').is('deleted_at', null).limit(50),
        supabase.from('projects').select('id, name, status, deadline, budget, progress').is('deleted_at', null).limit(50),
        supabase.from('invoices').select('id, invoice_number, status, total, issue_date, due_date').is('deleted_at', null).limit(50),
        supabase.from('expenses').select('id, description, amount, category, expense_date').is('deleted_at', null).limit(30),
        supabase.from('tasks').select('id, title, status, priority, deadline').is('deleted_at', null).limit(50),
      ])

      const parts: string[] = []
      if (clients.data?.length) parts.push(`### Clients:\n${clients.data.map(c => `- ${c.name} (${c.status})`).join('\n')}`)
      if (projects.data?.length) parts.push(`### Projects:\n${projects.data.map(p => `- ${p.name} (${p.status}, deadline: ${p.deadline || 'N/A'})`).join('\n')}`)
      if (invoices.data?.length) parts.push(`### Invoices:\n${invoices.data.map(i => `- ${i.invoice_number} (${i.status}, total: ${i.total})`).join('\n')}`)
      if (expenses.data?.length) parts.push(`### Recent Expenses:\n${expenses.data.map(e => `- ${e.description} (${e.category}, ${e.amount})`).join('\n')}`)
      if (tasks.data?.length) parts.push(`### Tasks:\n${tasks.data.map(t => `- ${t.title} (${t.status}, ${t.priority})`).join('\n')}`)

      return parts.join('\n\n')
    } catch {
      return ''
    }
  }

  async function handleDeleteChat(chat: Chat) {
    if (!confirm('Hapus chat ini?')) return
    await supabase.from('ai_chats').update({ deleted_at: new Date().toISOString() }).eq('id', chat.id)
    if (activeChat?.id === chat.id) setActiveChat(null)
    loadChats()
    toast.success('Chat dihapus')
  }

  async function handleToggleFavorite(chat: Chat) {
    await supabase.from('ai_chats').update({ is_favorite: !chat.is_favorite }).eq('id', chat.id)
    loadChats()
  }

  async function handleRename(chat: Chat) {
    const newTitle = prompt('Nama chat baru:', chat.title)
    if (!newTitle || newTitle === chat.title) return
    await supabase.from('ai_chats').update({ title: newTitle }).eq('id', chat.id)
    loadChats()
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Chat list sidebar */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <Button onClick={handleNewChat} className="w-full">
          <Plus className="size-4" /> New Chat
        </Button>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-1">
            {loadingChats ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : chats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada chat</p>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.id}
                  className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${activeChat?.id === chat.id ? 'border-primary bg-accent' : 'hover:bg-muted/50'}`}
                  onClick={() => setActiveChat(chat)}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(chat) }} className="shrink-0">
                    <Star className={`size-3.5 ${chat.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat) }} className="shrink-0 text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="size-12 mx-auto mb-4 text-violet-500" />
              <h2 className="text-xl font-semibold mb-2">AI Assistant</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Tanyakan apa saja tentang data Centrova — project, client, invoice, keuangan, dan lebih banyak lagi.
              </p>
              <Button onClick={handleNewChat} className="mt-4">
                <Plus className="size-4" /> Mulai Chat Baru
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <h2 className="font-semibold truncate">{activeChat.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => handleRename(activeChat)}>Rename</Button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
              {loadingMessages ? (
                <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Mulai percakapan dengan AI Assistant</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 animate-pulse text-violet-500" />
                      <span className="text-muted-foreground">AI sedang mengetik...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 mb-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <p className="flex-1">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Tanya AI..."
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={sending || !input.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
