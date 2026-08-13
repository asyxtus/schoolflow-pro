import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bus,
  Plus,
  Trash2,
  Pencil,
  AlertTriangle,
  Route as RouteIcon,
  Users as UsersIcon,
  Search,
} from "lucide-react";
import {
  listVehicles,
  upsertVehicle,
  deleteVehicle,
  listRoutes,
  upsertRoute,
  deleteRoute,
  listSubscriptions,
  upsertSubscription,
  deleteSubscription,
  searchTransportStudents,
  listBoardingLog,
  recordBoarding,
  listIncidents,
  upsertIncident,
  deleteIncident,
  transportSummary,
} from "@/lib/transport.functions";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

const summaryQO = queryOptions({
  queryKey: ["transport", "summary"],
  queryFn: () => transportSummary(),
});
const vehiclesQO = queryOptions({
  queryKey: ["transport", "vehicles"],
  queryFn: () => listVehicles(),
});
const routesQO = queryOptions({ queryKey: ["transport", "routes"], queryFn: () => listRoutes() });
const subsQO = queryOptions({
  queryKey: ["transport", "subs"],
  queryFn: () => listSubscriptions({ data: {} }),
});
const logQO = queryOptions({
  queryKey: ["transport", "log"],
  queryFn: () => listBoardingLog({ data: {} }),
});
const incidentsQO = queryOptions({
  queryKey: ["transport", "incidents"],
  queryFn: () => listIncidents(),
});

export const Route = createFileRoute("/_authenticated/transport")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(summaryQO),
      context.queryClient.ensureQueryData(vehiclesQO),
      context.queryClient.ensureQueryData(routesQO),
    ]),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: TransportPage,
});

function TransportPage() {
  const { data: summary } = useSuspenseQuery(summaryQO);
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transport</h1>
          <p className="text-sm text-muted-foreground">
            Vehicles, routes, subscriptions, boarding & maintenance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Vehicles" value={String(summary.vehicles)} icon={Bus} />
        <StatCard label="Active routes" value={String(summary.routes)} icon={RouteIcon} />
        <StatCard label="Subscribers" value={String(summary.subscribers)} icon={UsersIcon} />
        <StatCard label="Monthly revenue" value={fmt(summary.monthlyRevenue)} />
        <StatCard
          label="Open incidents"
          value={String(summary.openIncidents)}
          icon={AlertTriangle}
          tone={summary.openIncidents > 0 ? "text-destructive" : ""}
        />
      </div>

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions</TabsTrigger>
          <TabsTrigger value="log">Boarding Log</TabsTrigger>
          <TabsTrigger value="incidents">Incidents & Maintenance</TabsTrigger>
        </TabsList>
        <TabsContent value="vehicles">
          <VehiclesTab />
        </TabsContent>
        <TabsContent value="routes">
          <RoutesTab />
        </TabsContent>
        <TabsContent value="subs">
          <SubsTab />
        </TabsContent>
        <TabsContent value="log">
          <LogTab />
        </TabsContent>
        <TabsContent value="incidents">
          <IncidentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          {Icon && <Icon className="h-4 w-4" />}
        </div>
        <div className={`mt-2 text-lg font-semibold ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// ── Vehicles ────────────────────────────────────────────────────────────
function VehiclesTab() {
  const { data: rows } = useSuspenseQuery(vehiclesQO);
  const router = useRouter();
  const save = useServerFn(upsertVehicle);
  const del = useServerFn(deleteVehicle);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    plate_no: string;
    model: string;
    capacity: number;
    driver_name: string;
    driver_phone: string;
    status: "active" | "maintenance" | "retired";
    notes: string;
  }>({
    plate_no: "",
    model: "",
    capacity: 30,
    driver_name: "",
    driver_phone: "",
    status: "active",
    notes: "",
  });

  async function submit() {
    if (!form.plate_no) {
      toast.error("Plate number required");
      return;
    }
    try {
      await save({ data: { ...form } });
      toast.success("Saved");
      setOpen(false);
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Vehicles</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() =>
                setForm({
                  plate_no: "",
                  model: "",
                  capacity: 30,
                  driver_name: "",
                  driver_phone: "",
                  status: "active",
                  notes: "",
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "Add"} vehicle</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Plate No</Label>
                <Input
                  value={form.plate_no}
                  onChange={(e) => setForm({ ...form, plate_no: e.target.value })}
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["active", "maintenance", "retired"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Driver</Label>
                <Input
                  value={form.driver_name}
                  onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Driver phone</Label>
                <Input
                  value={form.driver_phone}
                  onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vehicles yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Plate</th>
                <th>Model</th>
                <th>Capacity</th>
                <th>Driver</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-medium">{r.plate_no}</td>
                  <td>{r.model ?? "—"}</td>
                  <td>{r.capacity}</td>
                  <td>
                    {r.driver_name ?? "—"}{" "}
                    {r.driver_phone && (
                      <span className="text-muted-foreground">· {r.driver_phone}</span>
                    )}
                  </td>
                  <td>
                    <Badge
                      variant={r.status === "active" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setForm({
                          id: r.id,
                          plate_no: r.plate_no,
                          model: r.model ?? "",
                          capacity: r.capacity,
                          driver_name: r.driver_name ?? "",
                          driver_phone: r.driver_phone ?? "",
                          status: r.status as "active",
                          notes: r.notes ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (confirm("Delete?")) {
                          await del({ data: { id: r.id } });
                          router.invalidate();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Routes ──────────────────────────────────────────────────────────────
function RoutesTab() {
  const { data: rows } = useSuspenseQuery(routesQO);
  const { data: vehicles } = useSuspenseQuery(vehiclesQO);
  const router = useRouter();
  const save = useServerFn(upsertRoute);
  const del = useServerFn(deleteRoute);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    code: string;
    vehicle_id: string | null;
    stops: string;
    monthly_fee_fcfa: number;
    active: boolean;
    notes: string;
  }>({
    name: "",
    code: "",
    vehicle_id: null,
    stops: "",
    monthly_fee_fcfa: 15000,
    active: true,
    notes: "",
  });

  async function submit() {
    if (!form.name) {
      toast.error("Name required");
      return;
    }
    const stops = form.stops
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    try {
      await save({
        data: {
          id: form.id,
          name: form.name,
          code: form.code,
          vehicle_id: form.vehicle_id,
          stops,
          monthly_fee_fcfa: form.monthly_fee_fcfa,
          active: form.active,
          notes: form.notes,
        },
      });
      toast.success("Saved");
      setOpen(false);
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Routes</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() =>
                setForm({
                  name: "",
                  code: "",
                  vehicle_id: null,
                  stops: "",
                  monthly_fee_fcfa: 15000,
                  active: true,
                  notes: "",
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "Add"} route</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Vehicle</Label>
                <Select
                  value={form.vehicle_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate_no} {v.model && `· ${v.model}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly fee (FCFA)</Label>
                <Input
                  type="number"
                  value={form.monthly_fee_fcfa}
                  onChange={(e) => setForm({ ...form, monthly_fee_fcfa: Number(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Stops (one per line)</Label>
                <Textarea
                  rows={4}
                  value={form.stops}
                  onChange={(e) => setForm({ ...form, stops: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="act"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <Label htmlFor="act">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No routes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th>Code</th>
                <th>Vehicle</th>
                <th>Stops</th>
                <th>Fee/mo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const veh = (r as { transport_vehicles?: { plate_no?: string } })
                  .transport_vehicles;
                const stops = Array.isArray(r.stops) ? r.stops : [];
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td>{r.code ?? "—"}</td>
                    <td>{veh?.plate_no ?? "—"}</td>
                    <td className="text-muted-foreground">{stops.length}</td>
                    <td>{fmt(r.monthly_fee_fcfa)}</td>
                    <td>
                      <Badge variant={r.active ? "default" : "secondary"}>
                        {r.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setForm({
                            id: r.id,
                            name: r.name,
                            code: r.code ?? "",
                            vehicle_id: r.vehicle_id,
                            stops: (stops as { name: string }[]).map((s) => s.name).join("\n"),
                            monthly_fee_fcfa: r.monthly_fee_fcfa,
                            active: r.active,
                            notes: r.notes ?? "",
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (confirm("Delete?")) {
                            await del({ data: { id: r.id } });
                            router.invalidate();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Subscriptions ───────────────────────────────────────────────────────
function SubsTab() {
  const { data: subs } = useSuspenseQuery(subsQO);
  const { data: routes } = useSuspenseQuery(routesQO);
  const router = useRouter();
  const search = useServerFn(searchTransportStudents);
  const save = useServerFn(upsertSubscription);
  const del = useServerFn(deleteSubscription);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchTransportStudents>>>([]);
  const [form, setForm] = useState<{
    student_id: string;
    student_name: string;
    route_id: string;
    stop_name: string;
    monthly_fee_fcfa: number;
    status: "active" | "paused" | "ended";
  }>({
    student_id: "",
    student_name: "",
    route_id: "",
    stop_name: "",
    monthly_fee_fcfa: 0,
    status: "active",
  });
  const [open, setOpen] = useState(false);

  async function doSearch(term: string) {
    setQ(term);
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setResults(await search({ data: { q: term } }));
  }

  async function submit() {
    if (!form.student_id || !form.route_id) {
      toast.error("Pick student and route");
      return;
    }
    try {
      await save({
        data: {
          student_id: form.student_id,
          route_id: form.route_id,
          stop_name: form.stop_name,
          monthly_fee_fcfa: form.monthly_fee_fcfa,
          status: form.status,
        },
      });
      toast.success("Saved");
      setOpen(false);
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Student subscriptions</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setForm({
                  student_id: "",
                  student_name: "",
                  route_id: "",
                  stop_name: "",
                  monthly_fee_fcfa: 0,
                  status: "active",
                });
                setResults([]);
                setQ("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Subscribe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New subscription</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Student</Label>
                {form.student_id ? (
                  <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <span>{form.student_name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setForm({ ...form, student_id: "", student_name: "" })}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="Search by name or matricule"
                        value={q}
                        onChange={(e) => doSearch(e.target.value)}
                      />
                    </div>
                    {results.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                        {results.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted"
                            onClick={() =>
                              setForm({
                                ...form,
                                student_id: r.id,
                                student_name: `${r.full_name} · ${r.class_name ?? ""}`,
                              })
                            }
                          >
                            <span>{r.full_name}</span>
                            <span className="text-muted-foreground">
                              {r.matricule} · {r.class_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <Label>Route</Label>
                <Select
                  value={form.route_id}
                  onValueChange={(v) => {
                    const rt = routes.find((r) => r.id === v);
                    setForm({ ...form, route_id: v, monthly_fee_fcfa: rt?.monthly_fee_fcfa ?? 0 });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · {fmt(r.monthly_fee_fcfa)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stop</Label>
                  <Input
                    value={form.stop_name}
                    onChange={(e) => setForm({ ...form, stop_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Monthly fee (FCFA)</Label>
                  <Input
                    type="number"
                    value={form.monthly_fee_fcfa}
                    onChange={(e) => setForm({ ...form, monthly_fee_fcfa: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Student</th>
                <th>Class</th>
                <th>Route</th>
                <th>Stop</th>
                <th>Fee/mo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((r) => {
                const s = (r as { students?: { matricule?: string; class_name?: string } })
                  .students;
                const rt = (r as { transport_routes?: { name?: string } }).transport_routes;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s?.matricule}</div>
                    </td>
                    <td>{s?.class_name ?? "—"}</td>
                    <td>{rt?.name ?? "—"}</td>
                    <td>{r.stop_name ?? "—"}</td>
                    <td>{fmt(r.monthly_fee_fcfa)}</td>
                    <td>
                      <Badge
                        variant={r.status === "active" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (confirm("Delete?")) {
                            await del({ data: { id: r.id } });
                            router.invalidate();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Boarding Log ────────────────────────────────────────────────────────
function LogTab() {
  const { data: rows } = useSuspenseQuery(logQO);
  const { data: subs } = useSuspenseQuery(subsQO);
  const router = useRouter();
  const rec = useServerFn(recordBoarding);
  const [routeId, setRouteId] = useState<string>("");
  const [direction, setDirection] = useState<"am" | "pm">("am");
  const today = new Date().toISOString().slice(0, 10);

  const routeSubs = useMemo(
    () => subs.filter((s) => s.route_id === routeId && s.status === "active"),
    [subs, routeId],
  );

  async function mark(studentId: string, boarded: boolean) {
    try {
      await rec({
        data: { route_id: routeId, student_id: studentId, direction, log_date: today, boarded },
      });
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const routes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subs) {
      const rt = (s as { transport_routes?: { name?: string } }).transport_routes;
      if (rt?.name) map.set(s.route_id, rt.name);
    }
    return [...map.entries()];
  }, [subs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record today's boarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Route</Label>
              <Select value={routeId} onValueChange={setRouteId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "am" | "pm")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="am">AM</SelectItem>
                  <SelectItem value="pm">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {routeId && (
            <div className="rounded-md border border-border">
              {routeSubs.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  No active subscribers on this route.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {routeSubs.map((s) => {
                      const stu = (s as { students?: { class_name?: string } }).students;
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="p-2">
                            <div className="font-medium">{s.full_name}</div>
                            <div className="text-xs text-muted-foreground">{stu?.class_name}</div>
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => mark(s.student_id, true)}
                            >
                              Boarded
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-2"
                              onClick={() => mark(s.student_id, false)}
                            >
                              Absent
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent log</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Direction</th>
                  <th>Route</th>
                  <th>Student</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => {
                  const rt = (r as { transport_routes?: { name?: string } }).transport_routes;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2">{r.log_date}</td>
                      <td className="uppercase">{r.direction}</td>
                      <td>{rt?.name ?? "—"}</td>
                      <td>{r.full_name}</td>
                      <td>
                        {r.boarded ? (
                          <Badge>Boarded</Badge>
                        ) : (
                          <Badge variant="secondary">Absent</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Incidents ───────────────────────────────────────────────────────────
function IncidentsTab() {
  const { data: rows } = useSuspenseQuery(incidentsQO);
  const { data: vehicles } = useSuspenseQuery(vehiclesQO);
  const { data: routes } = useSuspenseQuery(routesQO);
  const router = useRouter();
  const save = useServerFn(upsertIncident);
  const del = useServerFn(deleteIncident);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    vehicle_id: string | null;
    route_id: string | null;
    incident_date: string;
    kind: "incident" | "maintenance";
    severity: string;
    cost_fcfa: number;
    description: string;
    resolved: boolean;
  }>({
    vehicle_id: null,
    route_id: null,
    incident_date: new Date().toISOString().slice(0, 10),
    kind: "maintenance",
    severity: "low",
    cost_fcfa: 0,
    description: "",
    resolved: false,
  });

  async function submit() {
    if (!form.description) {
      toast.error("Description required");
      return;
    }
    try {
      await save({ data: { ...form } });
      toast.success("Saved");
      setOpen(false);
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Incidents & maintenance</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() =>
                setForm({
                  vehicle_id: null,
                  route_id: null,
                  incident_date: new Date().toISOString().slice(0, 10),
                  kind: "maintenance",
                  severity: "low",
                  cost_fcfa: 0,
                  description: "",
                  resolved: false,
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "Add"} record</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as typeof form.kind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incident">Incident</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.incident_date}
                  onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Vehicle</Label>
                <Select
                  value={form.vehicle_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, vehicle_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Route</Label>
                <Select
                  value={form.route_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, route_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cost (FCFA)</Label>
                <Input
                  type="number"
                  value={form.cost_fcfa}
                  onChange={(e) => setForm({ ...form, cost_fcfa: Number(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="res"
                  type="checkbox"
                  checked={form.resolved}
                  onChange={(e) => setForm({ ...form, resolved: e.target.checked })}
                />
                <Label htmlFor="res">Resolved</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Date</th>
                <th>Type</th>
                <th>Vehicle</th>
                <th>Severity</th>
                <th>Cost</th>
                <th>Description</th>
                <th>Resolved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = (r as { transport_vehicles?: { plate_no?: string } }).transport_vehicles;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">{r.incident_date}</td>
                    <td className="capitalize">{r.kind}</td>
                    <td>{v?.plate_no ?? "—"}</td>
                    <td className="capitalize">{r.severity ?? "—"}</td>
                    <td>{fmt(r.cost_fcfa)}</td>
                    <td className="max-w-sm truncate">{r.description}</td>
                    <td>
                      {r.resolved ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}
                    </td>
                    <td className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setForm({
                            id: r.id,
                            vehicle_id: r.vehicle_id,
                            route_id: r.route_id,
                            incident_date: r.incident_date,
                            kind: r.kind as "incident",
                            severity: r.severity ?? "low",
                            cost_fcfa: r.cost_fcfa,
                            description: r.description,
                            resolved: r.resolved,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (confirm("Delete?")) {
                            await del({ data: { id: r.id } });
                            router.invalidate();
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
