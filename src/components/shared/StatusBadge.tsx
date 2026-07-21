import { cn } from '@/lib/utils'
import type { Database } from '@/lib/database.types'

type ClientStatus = Database['public']['Tables']['clients']['Row']['status']
type ProjectStatus = Database['public']['Tables']['projects']['Row']['status']
type TaskStatus = Database['public']['Tables']['tasks']['Row']['status']
type InvoiceStatus = Database['public']['Tables']['invoices']['Row']['status']
type MilestoneStatus = Database['public']['Tables']['milestones']['Row']['status']
type DeliverableStatus = Database['public']['Tables']['deliverables']['Row']['status']
type Priority = Database['public']['Tables']['tasks']['Row']['priority']

const clientStatusConfig: Record<ClientStatus, { label: string; className: string }> = {
  prospect: { label: 'Prospect', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  active: { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  inactive: { label: 'Inactive', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const projectStatusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  discovery: { label: 'Discovery', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  planning: { label: 'Planning', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  development: { label: 'Development', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  testing: { label: 'Testing', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  deployment: { label: 'Deployment', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  maintenance: { label: 'Maintenance', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const taskStatusConfig: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: 'To Do', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  review: { label: 'Review', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  done: { label: 'Done', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const invoiceStatusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
}

const milestoneStatusConfig: Record<MilestoneStatus, { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  review: { label: 'Review', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const deliverableStatusConfig: Record<DeliverableStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  in_development: { label: 'In Development', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ready_for_review: { label: 'Ready for Review', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: 'Approved', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const assetStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  maintenance: { label: 'Maintenance', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  retired: { label: 'Retired', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  lost: { label: 'Lost', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const licenseStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
}

interface StatusBadgeProps {
  status: ClientStatus | ProjectStatus | TaskStatus | InvoiceStatus | MilestoneStatus | DeliverableStatus | string
  type: 'client' | 'project' | 'task' | 'invoice' | 'milestone' | 'deliverable' | 'asset' | 'license'
  className?: string
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  let config: { label: string; className: string }
  if (type === 'client') config = clientStatusConfig[status as ClientStatus]
  else if (type === 'project') config = projectStatusConfig[status as ProjectStatus]
  else if (type === 'task') config = taskStatusConfig[status as TaskStatus]
  else if (type === 'milestone') config = milestoneStatusConfig[status as MilestoneStatus]
  else if (type === 'deliverable') config = deliverableStatusConfig[status as DeliverableStatus]
  else if (type === 'asset') config = assetStatusConfig[status as string] || assetStatusConfig.active
  else if (type === 'license') config = licenseStatusConfig[status as string] || licenseStatusConfig.active
  else config = invoiceStatusConfig[status as InvoiceStatus]

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  )
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const config = priorityConfig[priority]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  )
}
