import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  CalendarCheck,
  BookOpen,
  FileText,
  MessageSquare,
  Settings,
  School,
  Wallet,
  PiggyBank,
  ShieldCheck,
  History,
  ScrollText,
  BedDouble,
  Briefcase,
  Banknote,
  Bus,
  Library,
  BarChart3,
  TrendingDown,
  AlertTriangle,
  Lock,
  UserCheck,
  Gavel,
  Stethoscope,
  FolderOpen,
  TrendingUp,
  CheckSquare,
  Building2,
  Contact,
  Trophy,
} from "lucide-react";

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
} from "@/components/ui/sidebar";
import { getCurrentSchool } from "@/lib/school.functions";

const groups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Student Information",
    items: [
      { title: "Students", url: "/students", icon: Users },
      { title: "Admissions", url: "/admissions", icon: ClipboardList },
      { title: "Classes", url: "/classes", icon: GraduationCap },
      { title: "Attendance", url: "/attendance", icon: CalendarCheck },
      { title: "Discipline", url: "/discipline", icon: Gavel },
      { title: "Clinic", url: "/clinic", icon: Stethoscope },
      { title: "Document Vault", url: "/documents", icon: FolderOpen },
      { title: "Reception", url: "/reception", icon: Contact },
      { title: "Sports", url: "/sports", icon: Trophy },
    ],
  },
  {
    label: "Academics",
    items: [
      { title: "Timetable", url: "/timetable", icon: BookOpen },
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Bulletin coefficients", url: "/reports/coefficients", icon: ScrollText },
      { title: "Trends & Board Reports", url: "/trends", icon: TrendingUp },
    ],
  },
  {
    label: "Communication",
    items: [{ title: "Messages", url: "/messages", icon: MessageSquare }],
  },
  {
    label: "Operations",
    items: [
      { title: "Finance", url: "/finance", icon: Wallet },
      { title: "Fees aging", url: "/finance/aging", icon: AlertTriangle },
      { title: "Daily cash close", url: "/day-close", icon: Lock },
      { title: "Expenses", url: "/expenses", icon: TrendingDown },
      { title: "Student Wallet", url: "/wallet", icon: PiggyBank },
      { title: "Boarding", url: "/boarding", icon: BedDouble },
      { title: "Transport", url: "/transport", icon: Bus },
      { title: "Library", url: "/library", icon: Library },
      { title: "HR / Staff", url: "/hr", icon: Briefcase },
      { title: "Staff attendance", url: "/staff-attendance", icon: UserCheck },
      { title: "Teacher performance", url: "/teacher-performance", icon: BarChart3 },
      { title: "Payroll", url: "/payroll", icon: Banknote },
      { title: "Approvals", url: "/approvals", icon: CheckSquare },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Roles", url: "/settings/users", icon: ShieldCheck },
      { title: "Audit log", url: "/settings/audit", icon: History },
      { title: "Super Admin Console", url: "/settings/console", icon: LayoutDashboard },
      { title: "Dioceses", url: "/settings/dioceses", icon: Building2 },
    ],
  },
  {
    label: "Diocese",
    items: [{ title: "Diocese Overview", url: "/diocese", icon: Building2 }],
  },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) =>
    url === "/" ? currentPath === "/" : currentPath.startsWith(url);
  const fetchSchool = useServerFn(getCurrentSchool);
  const { data } = useQuery({
    queryKey: ["current-school"],
    queryFn: () => fetchSchool(),
  });
  const schoolName = data?.school?.name ?? "SchoolERP";
  const schoolSub =
    [data?.school?.city, data?.school?.region].filter(Boolean).join(", ") ||
    data?.school?.code ||
    "Cameroon";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <School className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              {schoolName}
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">{schoolSub}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
