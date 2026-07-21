import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return format(parseISO(date), 'dd MMM yyyy', { locale: idLocale })
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return '-'
  return format(parseISO(date), 'dd/MM/yyyy')
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  return format(parseISO(date), 'dd MMM yyyy, HH:mm', { locale: idLocale })
}

export function formatRelative(date: string | null | undefined): string {
  if (!date) return '-'
  return formatDistanceToNow(parseISO(date), { addSuffix: true, locale: idLocale })
}

export function isOverdue(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  return isBefore(parseISO(deadline), new Date())
}

export function isUpcoming(deadline: string | null | undefined, days = 7): boolean {
  if (!deadline) return false
  const d = parseISO(deadline)
  const future = new Date()
  future.setDate(future.getDate() + days)
  return isAfter(d, new Date()) && isBefore(d, future)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  active: 'Active',
  completed: 'Completed',
  inactive: 'Inactive',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  planning: 'Planning',
  development: 'Development',
  testing: 'Testing',
  deployment: 'Deployment',
  maintenance: 'Maintenance',
  completed: 'Completed',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  client: 'Client',
  proposal: 'Proposal',
  contract: 'Contract',
  nda: 'NDA',
  invoice: 'Invoice',
  legal: 'Legal',
  internal: 'Internal',
}

export const TIMELINE_TYPE_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  agreement: 'Agreement',
  note: 'Note',
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  qris: 'QRIS',
  card: 'Card',
  other: 'Other',
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  operational: 'Operational',
  software: 'Software',
  hardware: 'Hardware',
  salary: 'Salary',
  marketing: 'Marketing',
  tax: 'Tax',
  office: 'Office',
  travel: 'Travel',
  other: 'Other',
}

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export const REVENUE_CATEGORY_LABELS: Record<string, string> = {
  'Invoice Payment': 'Invoice Payment',
  'Project Income': 'Project Income',
  'Other Income': 'Other Income',
  'Consultation': 'Consultation',
  'Service Fee': 'Service Fee',
}

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  review: 'Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  website: 'Website',
  web_app: 'Web Application',
  mobile_app: 'Mobile Application',
  ui_design: 'UI Design',
  api: 'API',
  documentation: 'Documentation',
  other: 'Other',
}

export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_development: 'In Development',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  delivered: 'Delivered',
}

export const PROJECT_NOTE_CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  business: 'Business',
  client: 'Client',
  internal: 'Internal',
  deployment: 'Deployment',
  miscellaneous: 'Miscellaneous',
}

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  laptop: 'Laptop',
  monitor: 'Monitor',
  smartphone: 'Smartphone',
  peripheral: 'Peripheral',
  networking: 'Networking',
  server: 'Server',
  office_equipment: 'Office Equipment',
  other: 'Other',
}

export const ASSET_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
  lost: 'Lost',
}

export const LICENSE_TYPE_LABELS: Record<string, string> = {
  free: 'Free',
  subscription: 'Subscription',
  lifetime: 'Lifetime',
}

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export const ACCOUNT_CATEGORY_LABELS: Record<string, string> = {
  email: 'Email',
  cloud: 'Cloud',
  hosting: 'Hosting',
  domain: 'Domain',
  social_media: 'Social Media',
  development: 'Development',
  ai_platform: 'AI Platform',
  analytics: 'Analytics',
  finance: 'Finance',
  other: 'Other',
}

export const LEGAL_DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  akta_pendirian: 'Akta Pendirian',
  nib: 'NIB',
  npwp: 'NPWP',
  sertifikat: 'Sertifikat',
  perizinan: 'Perizinan',
  perjanjian: 'Perjanjian',
  legal_letter: 'Legal Letter',
  trademark: 'Trademark',
  other: 'Other',
}

export const KNOWLEDGE_CATEGORY_LABELS: Record<string, string> = {
  sop: 'SOP',
  workflow: 'Workflow',
  technical: 'Technical Documentation',
  business: 'Business Documentation',
  deployment: 'Deployment Guide',
  internal_notes: 'Internal Notes',
  best_practice: 'Best Practice',
  faq: 'FAQ',
}

export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  proposal: 'Proposal',
  invoice: 'Invoice',
  quotation: 'Quotation',
  mou: 'MoU',
  nda: 'NDA',
  contract: 'Contract',
  meeting_notes: 'Meeting Notes',
  email: 'Email',
  project_checklist: 'Project Checklist',
}

export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  website: 'Website',
  web_app: 'Web Application',
  mobile_app: 'Mobile Application',
  maintenance: 'Maintenance',
  hosting: 'Hosting',
  consulting: 'Consulting',
  ai: 'AI / Automation',
  design: 'Design',
  other: 'Other',
}

export const BILLING_TYPE_LABELS: Record<string, string> = {
  one_time: 'One Time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
}
