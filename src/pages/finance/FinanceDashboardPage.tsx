import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Wallet, TrendingUp, TrendingDown, ArrowRight,
  Receipt, Calendar, AlertCircle, Plus, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row']

interface FinanceStats {
  cashBalance: number
  totalIncome: number
  totalExpense: number
  monthIncome: number
  monthExpense: number
  pendingIncome: number
}

export function FinanceDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<FinanceStats | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<(Transaction & { client?: { company_name: string } | null })[]>([])
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expense: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFinanceDashboard()
  }, [])

  async function loadFinanceDashboard() {
    setLoading(true)
    try {
      const [transactionsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, client:clients(company_name)')
          .is('deleted_at', null)
          .order('transaction_date', { ascending: false })
          .limit(20),
      ])

      const allTransactions = (transactionsRes.data || []) as (Transaction & { client?: { company_name: string } | null })[]

      const completed = allTransactions.filter(t => t.status === 'completed')
      const totalIncome = completed.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const totalExpense = completed.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const monthTransactions = completed.filter(t => t.transaction_date >= monthStart)
      const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

      const pendingIncome = allTransactions
        .filter(t => t.type === 'income' && t.status === 'pending')
        .reduce((s, t) => s + Number(t.amount), 0)

      setStats({
        cashBalance: totalIncome - totalExpense,
        totalIncome,
        totalExpense,
        monthIncome,
        monthExpense,
        pendingIncome,
      })

      setRecentTransactions(allTransactions.slice(0, 8))

      const months: { month: string; income: number; expense: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = d.toISOString().split('T')[0]
        const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const end = endD.toISOString().split('T')[0]
        const monthTrans = completed.filter(t => t.transaction_date >= start && t.transaction_date <= end)
        months.push({
          month: d.toLocaleDateString('id-ID', { month: 'short' }),
          income: monthTrans.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
          expense: monthTrans.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        })
      }
      setMonthlyData(months)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <FinanceDashboardSkeleton />

  const maxMonthly = Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1)
  const monthNet = (stats?.monthIncome ?? 0) - (stats?.monthExpense ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Ringkasan keuangan Centrova</p>
        </div>
        <Button onClick={() => navigate('/finance/cash-book')} className="shrink-0">
          <Plus className="size-4" />
          New Transaction
        </Button>
      </div>

      {/* Cash Balance + Monthly Summary */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash Balance</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(stats?.cashBalance ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total dari {formatCurrency(stats?.totalIncome ?? 0)} income - {formatCurrency(stats?.totalExpense ?? 0)} expense
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Income (This Month)</CardTitle>
            <TrendingUp className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.monthIncome ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expense (This Month)</CardTitle>
            <TrendingDown className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats?.monthExpense ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly Overview Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Monthly Overview</CardTitle>
            <span className={`text-sm font-medium ${monthNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthNet >= 0 ? '+' : ''}{formatCurrency(monthNet)}
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3 h-48">
              {monthlyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    <div
                      className="w-1/2 rounded-t bg-green-500/80 dark:bg-green-500/60 transition-all"
                      style={{ height: `${(data.income / maxMonthly) * 100}%`, minHeight: data.income > 0 ? '4px' : '0' }}
                      title={`Income: ${formatCurrency(data.income)}`}
                    />
                    <div
                      className="w-1/2 rounded-t bg-red-500/80 dark:bg-red-500/60 transition-all"
                      style={{ height: `${(data.expense / maxMonthly) * 100}%`, minHeight: data.expense > 0 ? '4px' : '0' }}
                      title={`Expense: ${formatCurrency(data.expense)}`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{data.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded bg-green-500/80 dark:bg-green-500/60" />
                <span className="text-muted-foreground">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded bg-red-500/80 dark:bg-red-500/60" />
                <span className="text-muted-foreground">Expense</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions + Insights */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickActionLink icon={<Receipt className="size-4" />} label="Record Revenue" onClick={() => navigate('/finance/revenue')} />
              <QuickActionLink icon={<TrendingDown className="size-4" />} label="Record Expense" onClick={() => navigate('/finance/expenses')} />
              <QuickActionLink icon={<Calendar className="size-4" />} label="Recurring Expenses" onClick={() => navigate('/finance/recurring')} />
              <QuickActionLink icon={<FileTextIcon />} label="Financial Reports" onClick={() => navigate('/finance/reports')} />
            </CardContent>
          </Card>

          {stats && stats.pendingIncome > 0 && (
            <Card className="border-amber-500/50">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-medium text-amber-600">Pending Income</CardTitle>
                <AlertCircle className="size-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-amber-600">{formatCurrency(stats.pendingIncome)}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting payment confirmation</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
          <button onClick={() => navigate('/finance/cash-book')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            View all <ArrowRight className="size-3" />
          </button>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada transaksi</p>
          ) : (
            recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  {tx.type === 'income'
                    ? <ArrowUpRight className="size-4 text-green-600" />
                    : <ArrowDownRight className="size-4 text-red-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.client?.company_name && `${tx.client.company_name} • `}
                    {formatDate(tx.transaction_date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                  </p>
                  {tx.status === 'pending' && (
                    <p className="text-xs text-amber-600">Pending</p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function QuickActionLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm text-left"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" />
    </button>
  )
}

function FileTextIcon() {
  return <span className="text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg></span>
}

function FinanceDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-8 w-24" /></CardContent></Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  )
}
