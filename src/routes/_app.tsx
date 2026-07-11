import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const crumbs = pathToCrumbs(path);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <nav className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
              {crumbs.map((c, i) => (
                <span key={c.href} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/40">/</span>}
                  <Link
                    to={c.href}
                    className={
                      i === crumbs.length - 1
                        ? "font-medium text-foreground"
                        : "hover:text-foreground"
                    }
                  >
                    {c.label}
                  </Link>
                </span>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students, staff…"
                  className="h-9 w-64 pl-8 bg-secondary/60 border-transparent focus-visible:bg-background"
                />
              </div>
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  AB
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function pathToCrumbs(path: string): { label: string; href: string }[] {
  if (path === "/") return [{ label: "Dashboard", href: "/" }];
  const parts = path.split("/").filter(Boolean);
  return parts.map((p, i) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    href: "/" + parts.slice(0, i + 1).join("/"),
  }));
}