import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Building2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isSuperAdmin as fetchIsSuperAdminFn } from "@/lib/diocese-admin.functions";
import {
  getPlatformSnapshot,
  getPlatformSchoolsSnapshot,
  searchPlatformUsers,
  setSuperAdmin,
  getRecentSignups,
  setSchoolActive,
  listPlatformAuditLog,
} from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/_authenticated/settings/console")({
  component: ConsolePage,
});

function ConsolePage() {
  const fetchIsSuperAdmin = useServerFn(fetchIsSuperAdminFn);
  const superAdminQ = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: () => fetchIsSuperAdmin(),
  });

  if (superAdminQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!superAdminQ.data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <PageHeader title="Super Admin Console" description="Platform-wide administration." />
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Only a super admin can access this console.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Console />;
}

function Console() {
  const qc = useQueryClient();
  const fetchSnapshot = useServerFn(getPlatformSnapshot);
  const fetchSchools = useServerFn(getPlatformSchoolsSnapshot);
  const setActiveFn = useServerFn(setSchoolActive);

  const snapshotQ = useQuery({ queryKey: ["platform-snapshot"], queryFn: () => fetchSnapshot() });
  const schoolsQ = useQuery({
    queryKey: ["platform-schools-snapshot"],
    queryFn: () => fetchSchools(),
  });

  const toggleActive = async (schoolId: string, schoolName: string, nextActive: boolean) => {
    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${schoolName}? Every account there will be signed out of the app immediately.`,
      )
    ) {
      return;
    }
    try {
      await setActiveFn({ data: { schoolId, active: nextActive } });
      toast.success(nextActive ? "School activated" : "School deactivated");
      qc.invalidateQueries({ queryKey: ["platform-schools-snapshot"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeader
        title="Super Admin Console"
        description="Everything, everywhere — every school and diocese on the platform."
        actions={
          <Button variant="outline" asChild>
            <Link to="/settings/dioceses">
              <Building2 className="mr-2 h-4 w-4" />
              Manage dioceses
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="signups">Recent Signups</TabsTrigger>
          <TabsTrigger value="users">Platform Users</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Schools" value={snapshotQ.data?.total_schools ?? "—"} />
            <StatCard label="Dioceses" value={snapshotQ.data?.total_dioceses ?? "—"} />
            <StatCard
              label="Active students"
              value={snapshotQ.data?.total_active_students ?? "—"}
            />
            <StatCard label="Active staff" value={snapshotQ.data?.total_active_staff ?? "—"} />
            <StatCard
              label="Collected this month"
              value={
                snapshotQ.data ? `${snapshotQ.data.fee_collected_mtd.toLocaleString()} FCFA` : "—"
              }
            />
            <StatCard
              label="Open discipline incidents"
              value={snapshotQ.data?.open_discipline_incidents ?? "—"}
            />
          </div>
        </TabsContent>

        <TabsContent value="schools" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Diocese</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Staff</TableHead>
                  <TableHead className="text-right">Collected (MTD)</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Open incidents</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(schoolsQ.data ?? []).map((s) => (
                  <TableRow key={s.school_id}>
                    <TableCell className="font-medium">{s.school_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.diocese_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{s.active_students}</TableCell>
                    <TableCell className="text-right">{s.active_staff}</TableCell>
                    <TableCell className="text-right">
                      {s.fee_collected_mtd.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.fee_outstanding.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{s.open_discipline_incidents}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={s.is_active === false ? "destructive" : "outline"}
                        onClick={() =>
                          toggleActive(s.school_id, s.school_name, s.is_active === false)
                        }
                      >
                        {s.is_active === false ? "Deactivated" : "Active"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(schoolsQ.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="p-8 text-center text-sm text-muted-foreground"
                    >
                      {schoolsQ.isError
                        ? `Couldn't load schools: ${(schoolsQ.error as Error).message}`
                        : "No schools yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="signups" className="mt-4">
          <RecentSignups />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <PlatformAuditLog />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <PlatformUsers />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function PlatformUsers() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchPlatformUsers);
  const setSuperAdminFn = useServerFn(setSuperAdmin);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const resultsQ = useQuery({
    queryKey: ["platform-users", query],
    queryFn: () => searchFn({ data: { query } }),
    enabled: query.trim().length >= 2,
  });

  const toggleSuperAdmin = async (userId: string, grant: boolean) => {
    if (
      grant &&
      !window.confirm(
        "Grant this person full super admin access to every school and diocese on the platform?",
      )
    ) {
      return;
    }
    if (!grant && !window.confirm("Revoke super admin access from this person?")) {
      return;
    }
    setBusyId(userId);
    try {
      await setSuperAdminFn({ data: { userId, grant } });
      toast.success(grant ? "Super admin granted" : "Super admin revoked");
      qc.invalidateQueries({ queryKey: ["platform-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Search users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {query.trim().length >= 2 && (
        <Card>
          <CardContent className="divide-y p-0">
            {(resultsQ.data ?? []).map((u) => {
              const isSuper = u.roles.some((r) => r.role === "super_admin");
              return (
                <div key={u.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{u.full_name ?? u.email ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.roles.map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {r.role}
                          {r.scope ? ` · ${r.scope}` : ""}
                        </Badge>
                      ))}
                      {u.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isSuper ? "destructive" : "outline"}
                    disabled={busyId === u.id}
                    onClick={() => toggleSuperAdmin(u.id, !isSuper)}
                  >
                    {isSuper ? "Revoke super admin" : "Grant super admin"}
                  </Button>
                </div>
              );
            })}
            {resultsQ.data?.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecentSignups() {
  const fetchSignups = useServerFn(getRecentSignups);
  const signupsQ = useQuery({ queryKey: ["recent-signups"], queryFn: () => fetchSignups() });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New schools</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {(signupsQ.data?.schools ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.city ?? "—"} · {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              {s.is_active === false && <Badge variant="destructive">Deactivated</Badge>}
            </div>
          ))}
          {(signupsQ.data?.schools ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No schools yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New user accounts</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {(signupsQ.data?.users ?? []).map((u) => (
            <div key={u.id} className="p-3">
              <div className="text-sm font-medium">{u.full_name ?? u.email ?? "Unknown"}</div>
              <div className="text-xs text-muted-foreground">
                {u.school_name ?? "No school"} · {new Date(u.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
          {(signupsQ.data?.users ?? []).length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No signups yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformAuditLog() {
  const fetchLog = useServerFn(listPlatformAuditLog);
  const [q, setQ] = useState("");
  const logQ = useQuery({
    queryKey: ["platform-audit-log", q],
    queryFn: () => fetchLog({ data: { q } }),
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Filter by action, school, actor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logQ.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">{r.school_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {r.action}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                  {r.summary}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.actor_email}</TableCell>
              </TableRow>
            ))}
            {(logQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No matching audit entries.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
