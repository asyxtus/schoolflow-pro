import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isSuperAdmin,
  listAllDioceses,
  createDiocese,
  listAllSchoolsForAdmin,
  assignSchoolToDiocese,
  listDioceseAdmins,
  addDioceseAdmin,
} from "@/lib/diocese-admin.functions";

export const Route = createFileRoute("/_authenticated/settings/dioceses")({
  component: DiocesesSetupPage,
});

function DiocesesSetupPage() {
  const fetchIsSuperAdmin = useServerFn(isSuperAdmin);
  const superAdminQ = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: () => fetchIsSuperAdmin(),
  });

  if (superAdminQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!superAdminQ.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <PageHeader title="Dioceses" description="Create and manage dioceses across schools." />
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Only a super admin can manage dioceses.
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DiocesesAdmin />;
}

function DiocesesAdmin() {
  const qc = useQueryClient();
  const fetchDioceses = useServerFn(listAllDioceses);
  const createFn = useServerFn(createDiocese);
  const fetchSchools = useServerFn(listAllSchoolsForAdmin);
  const assignFn = useServerFn(assignSchoolToDiocese);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedDiocese, setSelectedDiocese] = useState<string | null>(null);

  const diocesesQ = useQuery({ queryKey: ["all-dioceses"], queryFn: () => fetchDioceses() });
  const schoolsQ = useQuery({ queryKey: ["all-schools-admin"], queryFn: () => fetchSchools() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["all-dioceses"] });
    qc.invalidateQueries({ queryKey: ["all-schools-admin"] });
  };

  const createSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setBusy(true);
    try {
      await createFn({ data: { name, code } });
      toast.success("Diocese created");
      setName("");
      setCode("");
      setCreateOpen(false);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const assignSchool = async (schoolId: string, dioceseId: string) => {
    try {
      await assignFn({ data: { schoolId, dioceseId: dioceseId === "none" ? null : dioceseId } });
      invalidate();
      toast.success("Updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageHeader
        title="Dioceses"
        description="Create dioceses, link schools to them, and grant diocese administrators."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New diocese
          </Button>
        }
      />

      <div className="mb-6 space-y-3">
        {(diocesesQ.data ?? []).map((d) => (
          <DioceseCard
            key={d.id}
            diocese={d}
            expanded={selectedDiocese === d.id}
            onToggle={() => setSelectedDiocese(selectedDiocese === d.id ? null : d.id)}
          />
        ))}
        {(diocesesQ.data ?? []).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No dioceses yet — create one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Schools</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="w-56">Diocese</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(schoolsQ.data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.city ?? "—"}</TableCell>
                <TableCell>
                  <Select
                    value={s.diocese_id ?? "none"}
                    onValueChange={(v) => assignSchool(s.id, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {(diocesesQ.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {(schoolsQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                  No schools found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New diocese</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. DBY"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createSubmit} disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DioceseCard({
  diocese,
  expanded,
  onToggle,
}: {
  diocese: { id: string; name: string; code: string };
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const fetchAdmins = useServerFn(listDioceseAdmins);
  const addAdminFn = useServerFn(addDioceseAdmin);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const adminsQ = useQuery({
    queryKey: ["diocese-admins", diocese.id],
    queryFn: () => fetchAdmins({ data: { dioceseId: diocese.id } }),
    enabled: expanded,
  });

  const addAdmin = async () => {
    if (!email.trim()) {
      toast.error("Enter an email");
      return;
    }
    setBusy(true);
    try {
      const r = await addAdminFn({ data: { dioceseId: diocese.id, email } });
      if (r.granted) {
        toast.success("Diocese admin access granted");
      } else if (r.token) {
        const url = `${window.location.origin}/accept-invite?token=${r.token}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Invitation created — link copied to clipboard");
      }
      setEmail("");
      qc.invalidateQueries({ queryKey: ["diocese-admins", diocese.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {diocese.name} <Badge variant="outline">{diocese.code}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost">
            {expanded ? "Hide" : "Manage admins"}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Add diocese admin (by email)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button size="sm" onClick={addAdmin} disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
          <div className="text-sm">
            {(adminsQ.data?.admins ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1">
                <Badge variant="secondary">Admin</Badge>
                {a.full_name ?? a.email ?? "Unknown"}
              </div>
            ))}
            {(adminsQ.data?.pendingInvites ?? []).map((i) => (
              <div key={i.id} className="flex items-center gap-2 py-1 text-muted-foreground">
                <Badge variant="outline">Pending</Badge>
                {i.email}
              </div>
            ))}
            {(adminsQ.data?.admins ?? []).length === 0 &&
              (adminsQ.data?.pendingInvites ?? []).length === 0 && (
                <p className="text-muted-foreground">No admins yet.</p>
              )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
