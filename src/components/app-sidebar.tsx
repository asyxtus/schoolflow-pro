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
    ],
  },
  {
    label: "Academics",
    items: [
      { title: "Timetable", url: "/timetable", icon: BookOpen },
      { title: "Reports", url: "/reports", icon: FileText },
    ],
  },
  {
    label: "Communication",
    items: [{ title: "Messages", url: "/messages", icon: MessageSquare }],
  },
  {
    label: "Operations",
    items: [{ title: "Finance", url: "/finance", icon: Wallet }],
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
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
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