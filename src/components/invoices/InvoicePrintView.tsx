import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
type CompanyProfile = Database['public']['Tables']['company_profile']['Row']

interface InvoicePrintViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  items: InvoiceItem[]
  clientName?: string | null
  clientAddress?: string | null
  clientEmail?: string | null
  company?: CompanyProfile | null
}

function esc(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function InvoicePrintView({
  open,
  onOpenChange,
  invoice,
  items,
  clientName,
  clientAddress,
  clientEmail,
  company,
}: InvoicePrintViewProps) {
  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return

    const itemRows = items
      .map(
        (item) => `
        <tr>
          <td>${esc(item.description)}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">${formatCurrency(item.unit_price)}</td>
          <td class="center">${item.discount > 0 ? item.discount + '%' : '-'}</td>
          <td class="right">${formatCurrency(item.total)}</td>
        </tr>`
      )
      .join('')

    const statusColors: Record<string, string> = {
      draft: '#6b7280',
      sent: '#2563eb',
      paid: '#16a34a',
      overdue: '#dc2626',
      cancelled: '#9ca3af',
    }
    const statusColor = statusColors[invoice.status] ?? '#6b7280'

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${esc(invoice.invoice_number)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;font-size:13px;color:#111;background:#fff;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
  .company-name{font-size:22px;font-weight:700;margin-bottom:4px}
  .company-meta{font-size:12px;color:#555;line-height:1.6}
  .invoice-title{text-align:right}
  .invoice-title h1{font-size:28px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#111}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;color:#fff;background:${statusColor};margin-top:6px}
  .invoice-number{font-size:13px;color:#555;margin-top:4px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
  .meta-block h4{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-bottom:6px}
  .meta-block p{font-size:13px;line-height:1.6;color:#222}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead tr{background:#f3f4f6}
  th{text-align:left;padding:9px 10px;font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.4px;border-bottom:2px solid #e5e7eb}
  td{padding:9px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top}
  .center{text-align:center}
  .right{text-align:right}
  .totals{display:flex;justify-content:flex-end;margin-bottom:24px}
  .totals-box{width:260px}
  .totals-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
  .totals-row.grand{border-top:2px solid #111;margin-top:6px;padding-top:8px;font-weight:700;font-size:15px}
  .notes{background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;border-radius:4px;font-size:12px;color:#444;line-height:1.6}
  .notes + .notes{margin-top:12px}
  .footer{margin-top:40px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #e5e7eb;padding-top:16px}
  @media print{body{padding:20px}.footer{position:fixed;bottom:0;left:0;right:0}}
</style>
</head>
<body>
<div class="header">
  <div>
    ${company?.logo_url ? `<img src="${esc(company.logo_url)}" alt="logo" style="height:48px;margin-bottom:8px;display:block"/>` : ''}
    <div class="company-name">${esc(company?.name || 'Company')}</div>
    <div class="company-meta">
      ${company?.address ? esc(company.address) + '<br/>' : ''}
      ${company?.email ? esc(company.email) + '<br/>' : ''}
      ${company?.phone ? esc(company.phone) : ''}
    </div>
  </div>
  <div class="invoice-title">
    <h1>Invoice</h1>
    <span class="badge">${esc(invoice.status)}</span>
    <div class="invoice-number">${esc(invoice.invoice_number)}</div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-block">
    <h4>Bill To</h4>
    <p>
      <strong>${esc(clientName || '-')}</strong><br/>
      ${clientEmail ? esc(clientEmail) + '<br/>' : ''}
      ${clientAddress ? esc(clientAddress) : ''}
    </p>
  </div>
  <div class="meta-block">
    <h4>Invoice Details</h4>
    <p>
      <strong>Issue Date:</strong> ${formatDate(invoice.issue_date)}<br/>
      <strong>Due Date:</strong> ${formatDate(invoice.due_date)}<br/>
      ${company?.bank_name ? `<strong>Bank:</strong> ${esc(company.bank_name)}<br/>` : ''}
      ${company?.bank_account_number ? `<strong>Account:</strong> ${esc(company.bank_account_number)}<br/>` : ''}
      ${company?.bank_account_name ? `<strong>Name:</strong> ${esc(company.bank_account_name)}` : ''}
    </p>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="center">Qty</th>
      <th class="right">Unit Price</th>
      <th class="center">Disc</th>
      <th class="right">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals">
  <div class="totals-box">
    <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(invoice.subtotal)}</span></div>
    ${invoice.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${formatCurrency(invoice.discount)}</span></div>` : ''}
    ${invoice.tax_rate > 0 ? `<div class="totals-row"><span>Tax (${invoice.tax_rate}%)</span><span>${formatCurrency(invoice.tax_amount)}</span></div>` : ''}
    <div class="totals-row grand"><span>Total</span><span>${formatCurrency(invoice.total)}</span></div>
  </div>
</div>

${invoice.notes ? `<div class="notes"><strong>Notes:</strong><br/>${esc(invoice.notes)}</div>` : ''}
${invoice.payment_notes ? `<div class="notes" style="margin-top:10px"><strong>Payment Notes:</strong><br/>${esc(invoice.payment_notes)}</div>` : ''}

<div class="footer">${esc(company?.name || '')} &mdash; Thank you for your business</div>
</body>
</html>`

    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Invoice Preview — {invoice.invoice_number}</span>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="size-4" />
              Print / Export PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-lg border p-6 bg-white text-black space-y-6 text-sm">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              {company?.logo_url && (
                <img src={company.logo_url} alt="logo" className="h-10 mb-2 object-contain" />
              )}
              <p className="font-bold text-lg">{company?.name || 'Company'}</p>
              {company?.address && <p className="text-xs text-gray-500 mt-1">{company.address}</p>}
              {company?.email && <p className="text-xs text-gray-500">{company.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold uppercase tracking-wide">Invoice</p>
              <p className="text-xs text-gray-500 mt-1">{invoice.invoice_number}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                {invoice.status}
              </span>
            </div>
          </div>

          <Separator />

          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Bill To</p>
              <p className="font-semibold">{clientName || '-'}</p>
              {clientEmail && <p className="text-xs text-gray-500">{clientEmail}</p>}
              {clientAddress && <p className="text-xs text-gray-500">{clientAddress}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Details</p>
              <p className="text-xs">Issue: {formatDate(invoice.issue_date)}</p>
              <p className="text-xs">Due: {formatDate(invoice.due_date)}</p>
              {company?.bank_name && <p className="text-xs mt-1">Bank: {company.bank_name}</p>}
              {company?.bank_account_number && <p className="text-xs">Acc: {company.bank_account_number}</p>}
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-gray-500">Description</th>
                <th className="text-center py-2 text-gray-500 w-12">Qty</th>
                <th className="text-right py-2 text-gray-500 w-28">Unit Price</th>
                <th className="text-center py-2 text-gray-500 w-14">Disc</th>
                <th className="text-right py-2 text-gray-500 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 text-center">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span>-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax_rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
                  <span>{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="rounded bg-gray-50 border-l-2 border-gray-300 p-3 text-xs text-gray-600">
              <p className="font-semibold mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          {invoice.payment_notes && (
            <div className="rounded bg-gray-50 border-l-2 border-gray-300 p-3 text-xs text-gray-600">
              <p className="font-semibold mb-1">Payment Notes</p>
              <p className="whitespace-pre-wrap">{invoice.payment_notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
