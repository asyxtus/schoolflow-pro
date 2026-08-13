import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { getStudents } from "@/lib/students.functions";
import {
  listTeams,
  upsertTeam,
  deleteTeam,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  listFixtures,
  upsertFixture,
  deleteFixture,
  type FixtureStatus,
} from "@/lib/sports.functions";

export const Route = createFileRoute("/_authenticated/sports")({
  component: SportsPage,
});

function SportsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageHeader title="Sports" description="Teams, rosters, and fixtures." />
      <Tabs defaultValue="teams">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
        </TabsList>
        <TabsContent value="teams" className="mt-4">
          <TeamsTab />
        </TabsContent>
        <TabsContent value="fixtures" className="mt-4">
          <FixturesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeamsTab() {
  const qc = useQueryClient();
  const fetchTeams = useServerFn(listTeams);
  const saveFn = useServerFn(upsertTeam);
  const deleteFn = useServerFn(deleteTeam);

  const [createOpen, setCreateOpen] = useState(false);
  const [rosterTeam, setRosterTeam] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [coachName, setCoachName] = useState("");

  const teamsQ = useQuery({ queryKey: ["sports-teams"], queryFn: () => fetchTeams() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sports-teams"] });

  const create = async () => {
    try {
      await saveFn({ data: { name, sport, gender, ageGroup, coachName } });
      toast.success("Team created");
      setName("");
      setSport("");
      setGender("");
      setAgeGroup("");
      setCoachName("");
      setCreateOpen(false);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New team
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(teamsQ.data ?? []).map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary">{t.sport}</Badge>
                    {t.gender && <Badge variant="outline">{t.gender}</Badge>}
                    {t.age_group && <Badge variant="outline">{t.age_group}</Badge>}
                  </div>
                  {t.coach_name && (
                    <p className="mt-1 text-xs text-muted-foreground">Coach: {t.coach_name}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await deleteFn({ data: { id: t.id } });
                      invalidate();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setRosterTeam({ id: t.id, name: t.name })}
              >
                <Users className="mr-2 h-4 w-4" />
                Manage roster
              </Button>
            </CardContent>
          </Card>
        ))}
        {(teamsQ.data ?? []).length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No teams yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Team name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Football U16 Boys"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Sport</Label>
                <Input value={sport} onChange={(e) => setSport(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Gender (optional)</Label>
                <Input value={gender} onChange={(e) => setGender(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Age group (optional)</Label>
                <Input value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Coach (optional)</Label>
                <Input value={coachName} onChange={(e) => setCoachName(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rosterTeam && (
        <RosterDialog
          teamId={rosterTeam.id}
          teamName={rosterTeam.name}
          onClose={() => setRosterTeam(null)}
        />
      )}
    </div>
  );
}

function RosterDialog({
  teamId,
  teamName,
  onClose,
}: {
  teamId: string;
  teamName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listTeamMembers);
  const fetchStudents = useServerFn(getStudents);
  const addFn = useServerFn(addTeamMember);
  const removeFn = useServerFn(removeTeamMember);
  const [studentId, setStudentId] = useState("");

  const membersQ = useQuery({
    queryKey: ["sports-team-members", teamId],
    queryFn: () => fetchMembers({ data: { teamId } }),
  });
  const studentsQ = useQuery({ queryKey: ["students"], queryFn: () => fetchStudents() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sports-team-members", teamId] });

  const onStudentIds = new Set((membersQ.data ?? []).map((m) => m.student_id));
  const available = (studentsQ.data ?? []).filter((s) => !onStudentIds.has(s.id));

  const add = async () => {
    if (!studentId) {
      toast.error("Select a student");
      return;
    }
    try {
      await addFn({ data: { teamId, studentId } });
      setStudentId("");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Roster — {teamName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Add student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {available.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                    {s.class_name ? ` · ${s.class_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add}>Add</Button>
        </div>
        <div className="divide-y">
          {(membersQ.data ?? []).map((m) => {
            const s = (
              m as { students?: { first_name?: string; last_name?: string; class_name?: string } }
            ).students;
            return (
              <div key={m.id} className="flex items-center justify-between py-2">
                <div className="text-sm">
                  {s?.first_name} {s?.last_name}
                  {s?.class_name && (
                    <span className="ml-2 text-xs text-muted-foreground">{s.class_name}</span>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await removeFn({ data: { id: m.id } });
                    invalidate();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          {(membersQ.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No players yet.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  scheduled: "secondary",
  completed: "default",
  cancelled: "destructive",
};

function FixturesTab() {
  const qc = useQueryClient();
  const fetchTeams = useServerFn(listTeams);
  const fetchFixtures = useServerFn(listFixtures);
  const saveFn = useServerFn(upsertFixture);
  const deleteFn = useServerFn(deleteFixture);

  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [fixtureDate, setFixtureDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<FixtureStatus>("scheduled");
  const [ourScore, setOurScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");

  const teamsQ = useQuery({ queryKey: ["sports-teams"], queryFn: () => fetchTeams() });
  const fixturesQ = useQuery({
    queryKey: ["sports-fixtures"],
    queryFn: () => fetchFixtures({ data: {} }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sports-fixtures"] });

  const reset = () => {
    setTeamId("");
    setOpponent("");
    setFixtureDate(new Date().toISOString().slice(0, 10));
    setVenue("");
    setStatus("scheduled");
    setOurScore("");
    setOpponentScore("");
  };

  const submit = async () => {
    if (!teamId) {
      toast.error("Select a team");
      return;
    }
    try {
      await saveFn({
        data: {
          teamId,
          opponent,
          fixtureDate,
          venue,
          status,
          ourScore: ourScore ? Number(ourScore) : undefined,
          opponentScore: opponentScore ? Number(opponentScore) : undefined,
        },
      });
      toast.success("Fixture saved");
      reset();
      setOpen(false);
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New fixture
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(fixturesQ.data ?? []).map((f) => {
              const team = (f as { sports_teams?: { name?: string } }).sports_teams;
              return (
                <TableRow key={f.id}>
                  <TableCell className="text-sm">{team?.name ?? "—"}</TableCell>
                  <TableCell className="font-medium">{f.opponent}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(f.fixture_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.venue ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {f.our_score != null && f.opponent_score != null
                      ? `${f.our_score} – ${f.opponent_score}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[f.status] ?? "secondary"}>{f.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await deleteFn({ data: { id: f.id } });
                          invalidate();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(fixturesQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  No fixtures yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New fixture</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {(teamsQ.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Opponent</Label>
                <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={fixtureDate}
                  onChange={(e) => setFixtureDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Venue (optional)</Label>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as FixtureStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Our score</Label>
                <Input
                  type="number"
                  value={ourScore}
                  onChange={(e) => setOurScore(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Opponent score</Label>
                <Input
                  type="number"
                  value={opponentScore}
                  onChange={(e) => setOpponentScore(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
