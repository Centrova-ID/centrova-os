import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { History, RotateCcw } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type InvoiceVersion = Database['public']['Tables']['invoice_versions']['Row']

interface Props {
  invoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: () => void
}

export function InvoiceVersionHistory({ invoiceId, open, onOpenChange, onRestored }: Props) {
  const [versions, setVersions] = useState<InvoiceVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmVersion, setConfirmVersion] = useState<InvoiceVersion | null>(null)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoice_versions')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('version_number', { ascending: false })
    setVersions((data || []) as InvoiceVersion[])
    setLoading(false)
  }, [invoiceId])

  useEffect(() => {
    if (open) loadVersions()
  }, [open, loadVersions])

  async function handleRestore(version: InvoiceVersion) {
    setRestoring(true)
    try {
      const snapshot = version.snapshot as Record<string, unknown>
      // Strip immutable fields before updating
      const { id: _id, created_at: _ca, invoice_id: _iid, ...updatePayload } = snapshot as {
        id: string; created_at: string; invoice_id: string; [key: string]: unknown
      }
      void _id; void _ca; void _iid

      const { error: invoiceErr } = await supabase
        .from('invoices')
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq('id', invoiceId)

      if (invoiceErr) throw invoiceErr

      // Restore items
      const itemsSnapshot = version.items_snapshot as unknown[]
      if (Array.isArray(itemsSnapshot)) {
        await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)
        if (itemsSnapshot.length > 0) {
          const items = itemsSnapshot.map((item) => {
            const { id: _iid2, created_at: _ica, ...rest } = item as { id: string; created_at: string; [key: string]: unknown }
            void _iid2; void _ica
            return { ...rest, invoice_id: invoiceId }
          })
          await supabase.from('invoice_items').insert(items)
        }
      }

      toast.success(`Restored to version ${version.version_number}`)
      setConfirmVersion(null)
      onOpenChange(false)
      onRestored()
    } catch (err) {
      console.error('Restore error:', err)
      toast.error('Failed to restore version')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-80 sm:w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="size-4" />
              Version History
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : versions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No saved versions yet</p>
                <p className="text-xs mt-1">Versions are created each time you save the invoice.</p>
              </div>
            ) : (
              versions.map((v) => {
                const snap = v.snapshot as Record<string, unknown>
                const total = typeof snap.total === 'number' ? snap.total : 0
                return (
                  <div key={v.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs">v{v.version_number}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatCurrency(total)}</span>
                      {v.change_summary && (
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">{v.change_summary}</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => setConfirmVersion(v)}
                    >
                      <RotateCcw className="size-3" /> Restore
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmVersion} onOpenChange={(o) => !o && setConfirmVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {confirmVersion?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current invoice with the saved snapshot. The current state will not be recoverable unless it was already saved as a version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmVersion && handleRestore(confirmVersion)}
              disabled={restoring}
            >
              {restoring ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
