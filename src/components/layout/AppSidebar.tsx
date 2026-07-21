import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  FileText,
  Receipt,
  Activity,
  Settings,
  Building2,
  ChevronRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  CalendarDays,
  Laptop,
  KeyRound,
  UserCircle,
  FileCheck,
  BookOpen,
  Sparkles,
  Search,
  FileBarChart,
  Cpu,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/utils'

const navMain = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
]

const navOperations = [
  { title: 'Clients', url: '/clients', icon: Users },
  { title: 'Projects', url: '/projects', icon: FolderKanban },
  { title: 'Tasks', url: '/tasks', icon: CheckSquare },
]

const navFinance = [
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Finance Dashboard', url: '/finance', icon: Wallet },
  { title: 'Cash Book', url: '/finance/cash-book', icon: Receipt },
  { title: 'Revenue', url: '/finance/revenue', icon: TrendingUp },
  { title: 'Expenses', url: '/finance/expenses', icon: TrendingDown },
  { title: 'Recurring', url: '/finance/recurring', icon: RefreshCw },
  { title: 'Reports', url: '/finance/reports', icon: BarChart3 },
]

const navCompany = [
  { title: 'Company Dashboard', url: '/company', icon: Building2 },
  { title: 'Assets', url: '/company/assets', icon: Laptop },
  { title: 'Software & Licenses', url: '/company/software', icon: KeyRound },
  { title: 'Company Accounts', url: '/company/accounts', icon: UserCircle },
  { title: 'Legal Documents', url: '/company/legal', icon: FileCheck },
  { title: 'Company Profile', url: '/company/profile', icon: Building2 },
]

const navKnowledge = [
  { title: 'Knowledge Dashboard', url: '/knowledge', icon: BookOpen },
  { title: 'Knowledge Base', url: '/knowledge/base', icon: BookOpen },
  { title: 'Templates', url: '/knowledge/templates', icon: FileText },
  { title: 'Service Catalog', url: '/knowledge/catalog', icon: FileText },
  { title: 'AI Assistant', url: '/knowledge/ai', icon: Sparkles },
  { title: 'AI Search', url: '/knowledge/ai-search', icon: Search },
  { title: 'AI Reports', url: '/knowledge/ai-reports', icon: FileBarChart },
  { title: 'AI Insights', url: '/knowledge/ai-insights', icon: Sparkles },
  { title: 'AI Settings', url: '/knowledge/ai-settings', icon: Cpu },
]

const navSystem = [
  { title: 'Documents', url: '/documents', icon: FileText },
  { title: 'Calendar', url: '/calendar', icon: CalendarDays },
  { title: 'Activity Log', url: '/activity', icon: Activity },
  { title: 'Settings', url: '/settings', icon: Settings },
]

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  function isActive(url: string) {
    if (url === '/') return location.pathname === '/'
    return location.pathname.startsWith(url)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="cursor-pointer" onClick={() => navigate('/')}>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-semibold text-sm">Centrova OS</span>
                  <span className="text-xs text-muted-foreground">v1.0</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navOperations.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navFinance.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Company</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navCompany.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Knowledge & AI</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navKnowledge.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navSystem.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="cursor-pointer">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">
                      {getInitials(profile?.full_name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-none text-left">
                    <span className="text-sm font-medium truncate">{profile?.full_name || 'Founder'}</span>
                    <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
                  </div>
                  <ChevronRight className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
