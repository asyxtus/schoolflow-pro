import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings/audit")({
  component: AuditPage,
});

const ACTIONS = [
  "all", "invitation.create", "invitation.revoke", "invitation.accept",
  "role.grant", "role.revoke", "staff.remove",
];

function AuditPage() {
  const fn = useServerFn(listAuditLog);
  const [action, setAction] = useState<string>("all");
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["audit", action, q],
    queryFn: () => fn({ data: { action, q } }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings"><ArrowLeft className="h-4 w-4 mr-1" />Settings</Link>
        </Button>
      </div>
      <PageHeader
        title="Audit log"
        description="Every sensitive change with who, when, and what"
      />

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, summary…" className="pl-8" />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No entries</TableCell></TableRow>
              ) : (data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{r.actor_email ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{r.action}</Badge></TableCell>
                  <TableCell className="text-sm">{r.summary ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}