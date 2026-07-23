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
          <td class="py-2 pr-4">${esc(item.description)}</td>
          <td class="py-2 text-right">${item.quantity}</td>
          <td class="py-2 text-right">${formatCurrency(item.unit_price)}</td>
          <td class="py-2 text-right">${item.discount > 0 ? item.discount + '%' : '-'}</td>
          <td class="py-2 text-right pl-4">${formatCurrency(item.total)}</td>
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Invoice ${esc(invoice.invoice_number)}</title>
    <!-- Google Fonts: Figtree -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet">
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Figtree', 'sans-serif'],
                    }
                }
            }
        }
    </script>
    <style>
        @page {
            size: auto;
            margin: 0;
        }
        @media print {
            body {
                padding: 1.5rem !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body class="bg-white text-neutral-900 font-sans antialiased border-t-8 border-[#128aeb] min-h-screen p-8 max-w-4xl mx-auto font-medium">

    <!-- Header Section -->
    <header class="flex justify-between items-start mb-6">
        <div>
            <h1 class="text-3xl font-bold tracking-tight text-black mb-6">INVOICE</h1>
            <div class="grid grid-cols-[140px_1fr] text-sm text-neutral-800">
                <span class="text-neutral-900">Invoice number</span>
                <span>${esc(invoice.invoice_number)}</span>

                <span class="text-neutral-900">Issue date</span>
                <span>${formatDate(invoice.issue_date)}</span>

                <span class="text-neutral-900">Due date</span>
                <span>${formatDate(invoice.due_date)}</span>

                <span class="text-neutral-900">Status</span>
                <span class="capitalize" style="color: ${statusColor};">${esc(invoice.status)}</span>

                ${company?.bank_name ? `
                    <span class="text-neutral-900">Bank</span>
                    <span>${esc(company.bank_name)}</span>
                ` : ''}

                ${company?.bank_account_number ? `
                    <span class="text-neutral-900">Bank Account</span>
                    <span>${esc(company.bank_account_number)} 
                    ${company?.bank_account_name ? `(${esc(company.bank_account_name)})` : ''}</span>
                ` : ''}
            </div>
        </div>
        <div class="flex items-center space-x-2">
            <svg class="h-9" viewBox="0 0 411 76" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M78.5582 52.5312C75.9641 57.9515 72.2299 62.7356 67.6159 66.5497C60.5938 72.3267 51.8965 75.6345 42.8433 75.9714C33.7902 76.3084 24.8751 73.656 17.4506 68.4168C10.0555 63.2585 4.57381 55.7608 1.8712 47.1077C-0.831402 38.4547 -0.600835 29.1396 2.52644 20.6335C4.58534 14.988 7.86249 9.87523 12.1205 5.66561C13.474 4.30032 14.9197 3.0315 16.4473 1.86828C18.2476 0.520602 20.4657 -0.13385 22.7018 0.0227972C24.9379 0.179445 27.0451 1.13691 28.6437 2.72269L41.185 15.3805L31.5282 24.8739C29.001 27.4256 27.5812 30.8858 27.5812 34.4938C27.5812 38.1018 29.001 41.5621 31.5282 44.1138C34.1094 46.648 37.5684 48.0659 41.1694 48.0659C44.7704 48.0659 48.2293 46.648 50.8105 44.1138L50.9986 43.9555L54.1339 40.7911C55.8922 39.0516 58.2561 38.0773 60.7181 38.0773C63.1802 38.0773 65.5441 39.0516 67.3023 40.7911L78.5582 52.5312Z" fill="#128AEB"/>
            <path d="M74.4195 15.2223C74.4165 17.9409 73.6086 20.5967 72.0994 22.8486C70.5529 25.1266 68.3702 26.8889 65.8287 27.9117C63.3054 28.9456 60.5396 29.2204 57.865 28.7028C55.2066 28.176 52.7625 26.8656 50.8418 24.9372L41.1224 15.2223L50.8418 5.53903C53.3821 2.99146 56.8044 1.5407 60.3852 1.49346C63.966 1.44622 67.4247 2.80619 70.0301 5.28587L70.5317 5.7922C73.0002 8.3011 74.396 11.6866 74.4195 15.2223Z" fill="#FFB901"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M171.615 22.279C174.61 22.2388 177.583 22.7981 180.362 23.9245C182.771 24.9448 184.947 26.4506 186.759 28.3496C188.57 30.2486 189.978 32.5009 190.897 34.9685C191.859 37.4596 192.348 40.1111 192.339 42.7847C192.339 43.4387 192.339 44.1348 192.339 44.8732C192.288 45.566 192.183 46.2538 192.026 46.9301H159.481C159.543 48.6373 159.971 50.3106 160.735 51.835C161.797 53.9005 163.403 55.6304 165.375 56.8348C167.483 58.0536 169.876 58.6767 172.305 58.6386C174.528 58.7083 176.73 58.172 178.677 57.0862C180.625 56.0004 182.247 54.405 183.372 52.4679L190.772 55.9805C189.841 58.0664 188.459 59.9154 186.727 61.3916C184.882 63.0142 182.756 64.28 180.456 65.1257C177.845 66.035 175.098 66.4846 172.336 66.4548C168.296 66.5323 164.307 65.5393 160.767 63.5751C157.518 61.6627 154.833 58.9098 152.991 55.6007C151.092 52.1356 150.12 48.2313 150.169 44.2719C150.092 40.2993 151.066 36.3777 152.991 32.9116C154.899 29.6466 157.624 26.9455 160.893 25.0793C164.162 23.2131 167.859 22.2474 171.615 22.279ZM171.615 29.7155C169.398 29.7063 167.223 30.3317 165.344 31.5192C163.431 32.7017 161.921 34.4462 161.017 36.519C160.5 37.5755 160.151 38.7074 159.983 39.8733H182.902C182.853 38.6371 182.566 37.4224 182.055 36.2975C181.25 34.3178 179.845 32.6455 178.042 31.5192C176.136 30.2612 173.891 29.631 171.615 29.7155Z" fill="#58595B"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M311.419 22.279C315.441 22.2164 319.409 23.2202 322.926 25.1903C326.308 27.0439 329.13 29.7885 331.09 33.1318C333.05 36.4752 334.075 40.2923 334.056 44.177C334.1 48.2072 333.013 52.1676 330.921 55.6007C328.912 58.8953 326.093 61.6097 322.738 63.4802C319.208 65.3512 315.281 66.3288 311.294 66.3288C307.307 66.3288 303.38 65.3512 299.85 63.4802C296.483 61.6116 293.661 58.8836 291.667 55.569C289.579 52.1689 288.492 48.2401 288.531 44.2403C288.479 40.2389 289.568 36.3066 291.667 32.9115C293.652 29.6137 296.478 26.9143 299.85 25.0953C303.396 23.1531 307.385 22.1821 311.419 22.279ZM311.419 30.5066C309.031 30.4724 306.679 31.096 304.616 32.3103C302.599 33.5279 300.951 35.2788 299.85 37.3734C298.721 39.5715 298.15 42.0179 298.188 44.4935C298.154 46.9888 298.724 49.4547 299.85 51.6768C300.989 53.7554 302.668 55.4813 304.707 56.6689C306.745 57.8565 309.066 58.4609 311.419 58.417C313.819 58.4635 316.184 57.8393 318.254 56.6133C320.224 55.4231 321.838 53.7174 322.926 51.6768C324.11 49.4734 324.715 47.0001 324.682 44.4935C324.72 42.0064 324.115 39.5523 322.926 37.3734C321.841 35.3388 320.226 33.6425 318.254 32.4685C316.2 31.1871 313.834 30.5078 311.419 30.5066Z" fill="#58595B"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M393.408 22.279C396.531 22.2177 399.628 22.8667 402.469 24.1777C405.025 25.2546 407.207 27.0715 408.74 29.399C410.264 31.6522 411.053 34.3294 410.997 37.057V65.5371H402.312V60.6005C400.301 62.861 397.723 64.5334 394.85 65.4422C392.707 66.1534 390.46 66.4957 388.203 66.4548C385.526 66.5179 382.866 66.0112 380.396 64.9675C378.349 64.0405 376.576 62.5897 375.255 60.7588C374.022 58.8844 373.378 56.6791 373.405 54.4299C373.361 52.2211 373.89 50.0391 374.941 48.101C376.137 46.1507 377.825 44.5563 379.832 43.4808C382.417 42.1157 385.218 41.2162 388.109 40.8227L401.936 38.6076V36.9937C401.947 36.0192 401.735 35.0552 401.316 34.1769C400.898 33.2987 400.283 32.5299 399.522 31.9306C397.746 30.5038 395.519 29.7733 393.251 29.8737C391.017 29.8398 388.827 30.5028 386.981 31.7724C385.242 32.9136 383.869 34.5409 383.03 36.4558L375.505 32.785C376.323 30.65 377.673 28.7643 379.424 27.3105C381.264 25.6713 383.39 24.3941 385.695 23.5448C388.177 22.6858 390.785 22.2578 393.408 22.279ZM389.771 47.5946C387.82 47.8078 385.976 48.6008 384.472 49.8731C383.928 50.3914 383.498 51.0204 383.211 51.7186C382.925 52.4168 382.788 53.1682 382.811 53.9235C382.79 54.6877 382.946 55.4461 383.267 56.1384C383.589 56.8307 384.066 57.4376 384.661 57.9108C386.075 58.9552 387.801 59.48 389.552 59.3981C391.791 59.4569 394.008 58.9222 395.979 57.8475C397.778 56.8923 399.279 55.4516 400.314 53.6859C401.349 51.9203 401.878 49.8991 401.842 47.8478V45.5694L389.771 47.5946Z" fill="#58595B"/>
            <path d="M251.973 23.2283H261.85V31.2028H251.973V51.297C251.93 52.591 252.176 53.8782 252.694 55.0627C253.195 56.0767 254.01 56.8987 255.015 57.4045C256.333 57.9611 257.756 58.2203 259.184 58.1639C259.665 58.1935 260.147 58.1935 260.627 58.1639L262.163 58.0057V65.6004L259.686 65.8852C258.882 65.9403 258.076 65.9403 257.272 65.8852C255.348 66.0075 253.419 65.7401 251.599 65.0988C249.779 64.4576 248.105 63.4553 246.675 62.1511C245.355 60.7479 244.338 59.0848 243.685 57.2661C243.032 55.4474 242.758 53.5123 242.881 51.5819V31.1078H235.262V23.1334H236.453C237.305 23.2189 238.165 23.1153 238.972 22.8298C239.78 22.5443 240.516 22.0838 241.128 21.4806C241.741 20.8775 242.215 20.1464 242.518 19.3385C242.821 18.5307 242.945 17.6658 242.881 16.8045V13.64H251.973V23.2283Z" fill="#58595B"/>
            <path d="M217.202 22.279C220.162 22.2227 223.087 22.9308 225.699 24.3359C228.109 25.6252 230.117 27.5642 231.5 29.937C232.911 32.4643 233.626 35.3273 233.569 38.2279V65.5371H224.571V40.5379C224.64 38.671 224.23 36.8177 223.379 35.1584C222.608 33.6781 221.404 32.4736 219.93 31.7091C218.404 30.8657 216.685 30.4402 214.945 30.475C213.186 30.4479 211.449 30.8726 209.897 31.7091C208.455 32.4952 207.276 33.6956 206.511 35.1584C205.688 36.8278 205.279 38.6738 205.32 40.5379V65.5055H196.227V23.2284H204.912V28.3548C205.93 26.709 207.343 25.3486 209.019 24.3992C211.508 22.9604 214.335 22.2278 217.202 22.279Z" fill="#58595B"/>
            <path d="M289.096 30.7281H285.302C283.935 30.629 282.562 30.8328 281.281 31.3251C280 31.8174 278.841 32.5863 277.886 33.578C276.93 34.5697 276.201 35.7603 275.749 37.0664C275.296 38.3725 275.133 39.7625 275.269 41.1392V65.5371H266.208V23.2283H274.861V28.6396C275.718 26.9239 277.06 25.5033 278.718 24.5574C281.075 23.2458 283.74 22.6008 286.431 22.6904H289.096V30.7281Z" fill="#58595B"/>
            <path d="M354.06 52.9426L365.347 23.2283H375.411L358.292 65.5371H350.015L333.022 23.2283H342.898L354.06 52.9426Z" fill="#58595B"/>
            <path d="M139.509 52.7527C136.483 55.0998 132.866 56.5448 129.068 56.9243C125.269 57.3038 121.442 56.6026 118.018 54.9C114.595 53.1974 111.712 50.5615 109.696 47.2906C107.68 44.0197 106.611 40.2446 106.611 36.3925C106.611 32.5404 107.68 28.7652 109.696 25.4943C111.712 22.2234 114.595 19.5875 118.018 17.8849C121.442 16.1823 125.269 15.4811 129.068 15.8606C132.866 16.2401 136.483 17.6852 139.509 20.0322L143.209 22.9119L148.915 15.4438L145.215 12.5641C140.806 9.14124 135.536 7.03276 130.001 6.47752C124.466 5.92228 118.887 6.94247 113.897 9.42252C108.907 11.9026 104.704 15.7434 101.766 20.5099C98.8269 25.2765 97.2693 30.7784 97.2693 36.3925C97.2693 42.0065 98.8269 47.5084 101.766 52.275C104.704 57.0415 108.907 60.8824 113.897 63.3624C118.887 65.8425 124.466 66.8626 130.001 66.3074C135.536 65.7521 140.806 63.6437 145.215 60.2208L148.915 57.3411L143.209 50.0313L139.509 52.9109V52.7527Z" fill="#58595B"/>
            </svg>
        </div>
    </header>

    <!-- Address & Bill To Grid -->
    <div class="flex gap-8 mb-12 text-sm">
        <div class="mr-12">
            <p class="font-bold text-black mb-1">${esc(company?.name || 'Company')}</p>
            <p class="text-neutral-900 leading-none">
                ${company?.address ? esc(company.address) + '<br/>' : ''}
                ${company?.email ? esc(company.email) + '<br/>' : ''}
                ${company?.phone ? esc(company.phone) : ''}
            </p>
        </div>
        <div>
            <p class="font-bold text-black mb-0.5">Bill to</p>
            <p class="text-neutral-900 leading-relaxed">
                <strong>${esc(clientName || '-')}</strong><br/>
                ${clientEmail ? esc(clientEmail) + '<br/>' : ''}
                ${clientAddress ? esc(clientAddress) : ''}
            </p>
        </div>
    </div>

    <!-- Summary Highlight -->
    <div class="mb-8">
        <h2 class="text-2xl font-bold text-black">${formatCurrency(invoice.total)} due on ${formatDate(invoice.due_date)}</h2>
    </div>

    <!-- Items Table -->
    <div class="w-full mb-8">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-black text-sm font-bold text-black">
                    <th class="py-2 pr-4">Description</th>
                    <th class="py-2 text-right">Quantity</th>
                    <th class="py-2 text-right">Unit Price</th>
                    <th class="py-2 text-right">Disc</th>
                    <th class="py-2 text-right pl-4">Total</th>
                </tr>
            </thead>
            <tbody class="text-sm text-neutral-900 divide-y divide-neutral-100">
                ${itemRows}
            </tbody>
        </table>
    </div>

    <!-- Totals Section -->
    <div class="flex justify-end mb-8">
        <div class="w-full max-w-xs text-sm">
            <div class="flex justify-between py-2 border-t border-neutral-200">
                <span class="text-neutral-900">Subtotal</span>
                <span class="font-medium">${formatCurrency(invoice.subtotal)}</span>
            </div>
            ${invoice.discount > 0 ? `
            <div class="flex justify-between py-2 border-t border-neutral-200">
                <span class="text-neutral-900">Discount</span>
                <span class="font-medium">-${formatCurrency(invoice.discount)}</span>
            </div>
            ` : ''}
            ${invoice.tax_rate > 0 ? `
            <div class="flex justify-between py-2 border-t border-neutral-200">
                <span class="text-neutral-900">Tax (${invoice.tax_rate}%)</span>
                <span class="font-medium">${formatCurrency(invoice.tax_amount)}</span>
            </div>
            ` : ''}
            <div class="flex justify-between py-3 border-t border-black font-bold text-base mt-1">
                <span>Total</span>
                <span>${formatCurrency(invoice.total)}</span>
            </div>
        </div>
    </div>

    <!-- Notes Section -->
    ${invoice.notes || invoice.payment_notes ? `
    <div class="space-y-3 mb-10 text-sm">
        ${invoice.notes ? `
        <div class="bg-neutral-50 border-l-4 border-neutral-300 p-4 rounded-r text-neutral-700">
            <strong class="text-black">Notes:</strong><br/>
            ${esc(invoice.notes)}
        </div>
        ` : ''}

        ${invoice.payment_notes ? `
        <div class="bg-neutral-50 border-l-4 border-neutral-300 p-4 rounded-r text-neutral-700">
            <strong class="text-black">Payment Notes:</strong><br/>
            ${esc(invoice.payment_notes)}
        </div>
        ` : ''}
    </div>
    ` : ''}

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
                <th className="text-center py-2 text-gray-500 w-12">Quantity</th>
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