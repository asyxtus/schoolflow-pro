import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listStaff,
  listInvitations,
  createInvitation,
  revokeInvitation,
  updateStaffRole,
  removeStaff,
  MANAGEABLE_ROLES,
  type AppRole,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings/users")({
  component: UsersPage,
});

const ROLE_LABEL: Record<string, string> = {
  principal: "Principal",
  vice_principal: "Vice Principal",
  bursar: "Bursar",
  teacher: "Teacher",
  secretary: "Secretary",
  discipline_master: "Discipline Master",
  nurse: "Nurse",
  boarding_master: "Boarding Master",
  receptionist: "Receptionist",
  sports_master: "Sports Master",
  diocese_admin: "Diocese Admin",
  super_admin: "Super Admin",
};

function UsersPage() {
  const qc = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const fetchInv = useServerFn(listInvitations);
  const createInv = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);
  const setRole = useServerFn(updateStaffRole);
  const removeFn = useServerFn(removeStaff);

  const staffQ = useQuery({ queryKey: ["staff"], queryFn: () => fetchStaff() });
  const invQ = useQuery({ queryKey: ["invitations"], queryFn: () => fetchInv() });

  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<AppRole>("teacher");

  const inviteMut = useMutation({
    mutationFn: () => createInv({ data: { email, role } }),
    onSuccess: async (r) => {
      const url = `${window.location.origin}/accept-invite?token=${r.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invitation created — link copied to clipboard");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole; add: boolean }) => setRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => removeFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Staff removed");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email required");
    inviteMut.mutate();
  };

  // Group role rows by user
  const grouped = new Map<
    string,
    {
      user_id: string;
      full_name: string | null;
      email: string | null;
      roles: string[];
    }
  >();
  for (const r of staffQ.data?.staff ?? []) {
    const g = grouped.get(r.user_id) ?? {
      user_id: r.user_id,
      full_name: r.full_name,
      email: r.email,
      roles: [],
    };
    g.roles.push(r.role);
    grouped.set(r.user_id, g);
  }
  const users = Array.from(grouped.values());

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Settings
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Users & Roles"
        description="Invite staff and manage what they can access"
      />

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite staff
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.cm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={(v) => setRoleValue(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r] ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviteMut.isPending}>
                {inviteMut.isPending ? "Creating…" : "Send invite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending invitations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invQ.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No invitations yet
                  </TableCell>
                </TableRow>
              ) : (
                (invQ.data ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.email}</TableCell>
                    <TableCell>{ROLE_LABEL[i.role] ?? i.role}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          i.status === "pending"
                            ? "secondary"
                            : i.status === "accepted"
                              ? "default"
                              : "outline"
                        }
                      >
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(i.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {i.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy link
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(i.id)}>
                            Revoke
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No staff yet
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">
                            {ROLE_LABEL[r] ?? r}
                            {MANAGEABLE_ROLES.includes(r as AppRole) && (
                              <button
                                className="ml-1 hover:text-destructive"
                                onClick={() =>
                                  roleMut.mutate({
                                    user_id: u.user_id,
                                    role: r as AppRole,
                                    add: false,
                                  })
                                }
                                aria-label={`Remove ${r}`}
                              >
                                ×
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Select
                        onValueChange={(v) =>
                          roleMut.mutate({ user_id: u.user_id, role: v as AppRole, add: true })
                        }
                      >
                        <SelectTrigger className="h-8 w-[150px] inline-flex">
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          {MANAGEABLE_ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!u.roles.includes("principal") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMut.mutate(u.user_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
