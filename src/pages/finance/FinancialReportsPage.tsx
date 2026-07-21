import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatCurrency, formatDate, PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS, isOverdue,
} from '@/lib/utils'
import {
  Download, FileText, TrendingUp, TrendingDown, Wallet, Receipt, AlertCircle,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Transaction = Database['public']['Tables']['transactions']['Row']
type Invoice = Database['public']['Tables']['invoices']['Row']

interface TransactionWithClient extends Transaction {
  client?: { company_name: string } | null
}
interface InvoiceWithClient extends Invoice {
  client?: { company_name: string } | null
}

type PeriodPreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'

function getPeriodRange(preset: PeriodPreset, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date()
  switch (preset) {
    case 'this_month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
      }
    case 'last_month':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0],
      }
    case 'this_quarter':
      const q = Math.floor(now.getMonth() / 3)
      return {
        start: new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().split('T')[0],
      }
    case 'this_year':
      return {
        start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0],
      }
    case 'custom':
      return { start: customStart || '', end: customEnd || '' }
  }
}

export function FinancialReportsPage() {
  const [period, setPeriod] = useState<PeriodPreset>('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [transactions, setTransactions] = useState<TransactionWithClient[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([])
  const [loading, setLoading] = useState(true)

  const loadReport = useCallback(async () => {
    const { start, end } = getPeriodRange(period, customStart, customEnd)
    if (!start || !end) return

    setLoading(true)
    const [txRes, invRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, client:clients(company_name)')
        .is('deleted_at', null)
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('invoices')
        .select('*, client:clients(company_name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])

    setTransactions((txRes.data || []) as TransactionWithClient[])
    setInvoices((invRes.data || []) as InvoiceWithClient[])
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { loadReport() }, [loadReport])

  function exportCSV() {
    const { start, end } = getPeriodRange(period, customStart, customEnd)
    const rows: string[] = []
    rows.push('Type,Category,Description,Amount,Date,Payment Method,Status,Client,Reference')

    for (const tx of transactions) {
      rows.push([
        tx.type,
        `"${tx.category}"`,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount,
        tx.transaction_date,
        tx.payment_method,
        tx.status,
        `"${tx.client?.company_name || ''}"`,
        `"${tx.reference || ''}"`,
      ].join(','))
    }

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `centrova-finance-report-${start}_to_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportInvoicesCSV() {
    const rows: string[] = []
    rows.push('Invoice Number,Client,Issue Date,Due Date,Status,Subtotal,Tax,Total,Paid Date')
    for (const inv of invoices) {
      rows.push([
        inv.invoice_number,
        `"${inv.client?.company_name || ''}"`,
        inv.issue_date,
        inv.due_date,
        inv.status,
        inv.subtotal,
        inv.tax_amount,
        inv.total,
        '',
      ].join(','))
    }
    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `centrova-invoices-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const completed = transactions.filter(t => t.status === 'completed')
  const incomeTransactions = completed.filter(t => t.type === 'income')
  const expenseTransactions = completed.filter(t => t.type === 'expense')
  const totalIncome = incomeTransactions.reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = expenseTransactions.reduce((s, t) => s + Number(t.amount), 0)
  const netCashFlow = totalIncome - totalExpense

  const incomeByCategory: Record<string, number> = {}
  incomeTransactions.forEach(t => {
    incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + Number(t.amount)
  })

  const expenseByCategory: Record<string, number> = {}
  expenseTransactions.forEach(t => {
    const cat = EXPENSE_CATEGORY_LABELS[t.category] || t.category
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(t.amount)
  })

  const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue')
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + Number(i.total), 0)
  const overdueInvoices = invoices.filter(i => (i.status === 'sent' || i.status === 'overdue') && isOverdue(i.due_date))
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.total), 0)

  const periodLabel = period === 'custom'
    ? `${formatDate(customStart)} - ${formatDate(customEnd)}`
    : period.replace('_', ' ')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="Laporan keuangan dengan filter periode"
        action={{ label: 'Export CSV', onClick: exportCSV, icon: <Download className="size-4" /> }}
      />

      {/* Period Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === 'custom' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40" />
            </div>
          </>
        )}
        <div className="text-sm text-muted-foreground ml-auto">
          Period: <span className="font-medium text-foreground">{periodLabel}</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <Tabs defaultValue="cashflow">
          <TabsList>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          </TabsList>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="space-y-4 mt-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <ReportStatCard title="Total Income" value={formatCurrency(totalIncome)} icon={<TrendingUp className="size-4 text-green-600" />} valueClass="text-green-600" />
              <ReportStatCard title="Total Expense" value={formatCurrency(totalExpense)} icon={<TrendingDown className="size-4 text-red-600" />} valueClass="text-red-600" />
              <ReportStatCard title="Net Cash Flow" value={formatCurrency(netCashFlow)} icon={<Wallet className="size-4" />} valueClass={netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'} />
              <ReportStatCard title="Transactions" value={String(transactions.length)} icon={<Receipt className="size-4 text-muted-foreground" />} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Transaction Log</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions in this period</TableCell>
                      </TableRow>
                    ) : (
                      transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tx.type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {tx.type === 'income' ? 'Income' : 'Expense'}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {tx.description}
                            {tx.client?.company_name && <p className="text-xs text-muted-foreground">{tx.client.company_name}</p>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{tx.category}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(tx.transaction_date)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{PAYMENT_METHOD_LABELS[tx.payment_method] || tx.payment_method}</TableCell>
                          <TableCell className={`text-right font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4 mt-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-base font-semibold">Revenue by Category</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(incomeByCategory).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No revenue in this period</p>
                  ) : (
                    Object.entries(incomeByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <span className="font-medium text-green-600">{formatCurrency(amount)}</span>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base font-semibold">Revenue Transactions</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeTransactions.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No revenue in this period</TableCell></TableRow>
                      ) : (
                        incomeTransactions.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell className="text-muted-foreground">{tx.client?.company_name || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(tx.transaction_date)}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">+{formatCurrency(Number(tx.amount))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Expense Tab */}
          <TabsContent value="expense" className="space-y-4 mt-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-base font-semibold">Expense by Category</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(expenseByCategory).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No expenses in this period</p>
                  ) : (
                    Object.entries(expenseByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <span className="font-medium text-red-600">{formatCurrency(amount)}</span>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base font-semibold">Expense Transactions</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseTransactions.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No expenses in this period</TableCell></TableRow>
                      ) : (
                        expenseTransactions.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-medium">{tx.description}</TableCell>
                            <TableCell className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[tx.category] || tx.category}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(tx.transaction_date)}</TableCell>
                            <TableCell className="text-right font-medium text-red-600">-{formatCurrency(Number(tx.amount))}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Outstanding Tab */}
          <TabsContent value="outstanding" className="space-y-4 mt-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <ReportStatCard title="Outstanding" value={formatCurrency(outstandingTotal)} icon={<AlertCircle className="size-4 text-amber-600" />} valueClass="text-amber-600" />
              <ReportStatCard title="Overdue" value={String(overdueInvoices.length)} icon={<AlertCircle className="size-4 text-red-600" />} valueClass="text-red-600" />
              <ReportStatCard title="Paid Invoices" value={String(paidInvoices.length)} icon={<FileText className="size-4 text-green-600" />} />
              <ReportStatCard title="Paid Revenue" value={formatCurrency(paidTotal)} icon={<TrendingUp className="size-4 text-green-600" />} valueClass="text-green-600" />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Outstanding Invoices</CardTitle>
                <Button variant="outline" size="sm" onClick={exportInvoicesCSV}>
                  <Download className="size-3.5" /> Export
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstandingInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <FileText className="size-8 mx-auto mb-2 opacity-30" />
                          No outstanding invoices
                        </TableCell>
                      </TableRow>
                    ) : (
                      outstandingInvoices.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell className="text-muted-foreground">{inv.client?.company_name || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(inv.issue_date)}</TableCell>
                          <TableCell>
                            <span className={`text-sm ${isOverdue(inv.due_date) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              {formatDate(inv.due_date)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${inv.status === 'overdue' || (inv.status === 'sent' && isOverdue(inv.due_date)) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                              {inv.status === 'sent' && isOverdue(inv.due_date) ? 'Overdue' : inv.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(Number(inv.total))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function ReportStatCard({ title, value, icon, valueClass }: { title: string; value: string; icon: React.ReactNode; valueClass?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
      <p className={`text-xl font-bold mt-1 ${valueClass || ''}`}>{value}</p>
    </div>
  )
}
