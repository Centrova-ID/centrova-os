import { Outlet, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Separator } from '@/components/ui/separator'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { ModeToggle } from '@/components/mode-toggle'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/invoices': 'Invoices',
  '/documents': 'Documents',
  '/activity': 'Activity Log',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  const exact = ROUTE_LABELS[pathname]
  if (exact) return exact
  const base = '/' + pathname.split('/')[1]
  return ROUTE_LABELS[base] || 'Centrova OS'
}

export function AppLayout() {
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
