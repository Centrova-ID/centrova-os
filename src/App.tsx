import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthPage } from '@/pages/auth/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ClientsPage } from '@/pages/clients/ClientsPage'
import { ClientDetailPage } from '@/pages/clients/ClientDetailPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage'
import { TasksPage } from '@/pages/tasks/TasksPage'
import { InvoicesPage } from '@/pages/invoices/InvoicesPage'
import { InvoiceDetailPage } from '@/pages/invoices/InvoiceDetailPage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { FinanceDashboardPage } from '@/pages/finance/FinanceDashboardPage'
import { CashBookPage } from '@/pages/finance/CashBookPage'
import { RevenuePage } from '@/pages/finance/RevenuePage'
import { ExpensesPage } from '@/pages/finance/ExpensesPage'
import { RecurringExpensesPage } from '@/pages/finance/RecurringExpensesPage'
import { FinancialReportsPage } from '@/pages/finance/FinancialReportsPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { CompanyDashboardPage } from '@/pages/company/CompanyDashboardPage'
import { AssetsPage } from '@/pages/company/AssetsPage'
import { SoftwareLicensesPage } from '@/pages/company/SoftwareLicensesPage'
import { CompanyAccountsPage } from '@/pages/company/CompanyAccountsPage'
import { LegalDocumentsPage } from '@/pages/company/LegalDocumentsPage'
import { CompanyProfilePage } from '@/pages/company/CompanyProfilePage'
import { KnowledgeDashboardPage } from '@/pages/knowledge/KnowledgeDashboardPage'
import { KnowledgeBasePage } from '@/pages/knowledge/KnowledgeBasePage'
import { TemplatesPage } from '@/pages/knowledge/TemplatesPage'
import { ServiceCatalogPage } from '@/pages/knowledge/ServiceCatalogPage'
import { AIAssistantPage } from '@/pages/knowledge/AIAssistantPage'
import { AISearchPage } from '@/pages/knowledge/AISearchPage'
import { AIReportsPage } from '@/pages/knowledge/AIReportsPage'
import { AIInsightsPage } from '@/pages/knowledge/AIInsightsPage'
import { AISettingsPage } from '@/pages/knowledge/AISettingsPage'
import { Spinner } from '@/components/ui/spinner'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/finance" element={<FinanceDashboardPage />} />
        <Route path="/finance/cash-book" element={<CashBookPage />} />
        <Route path="/finance/revenue" element={<RevenuePage />} />
        <Route path="/finance/expenses" element={<ExpensesPage />} />
        <Route path="/finance/recurring" element={<RecurringExpensesPage />} />
        <Route path="/finance/reports" element={<FinancialReportsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/company" element={<CompanyDashboardPage />} />
        <Route path="/company/assets" element={<AssetsPage />} />
        <Route path="/company/software" element={<SoftwareLicensesPage />} />
        <Route path="/company/accounts" element={<CompanyAccountsPage />} />
        <Route path="/company/legal" element={<LegalDocumentsPage />} />
        <Route path="/company/profile" element={<CompanyProfilePage />} />
        <Route path="/knowledge" element={<KnowledgeDashboardPage />} />
        <Route path="/knowledge/base" element={<KnowledgeBasePage />} />
        <Route path="/knowledge/templates" element={<TemplatesPage />} />
        <Route path="/knowledge/catalog" element={<ServiceCatalogPage />} />
        <Route path="/knowledge/ai" element={<AIAssistantPage />} />
        <Route path="/knowledge/ai-search" element={<AISearchPage />} />
        <Route path="/knowledge/ai-reports" element={<AIReportsPage />} />
        <Route path="/knowledge/ai-insights" element={<AIInsightsPage />} />
        <Route path="/knowledge/ai-settings" element={<AISettingsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/activity" element={<ActivityLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function PublicRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <AuthPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<PublicRoute />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}
