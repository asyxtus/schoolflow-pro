import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Search, Pencil, Trash2, Briefcase } from "lucide-react";
import { listStaff, upsertStaff, deleteStaff, type StaffInput, type StaffPosition, type ContractType, type StaffStatus } from "@/lib/hr.functions";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/,/g, " ") + " FCFA";

const staffQO = queryOptions({ queryKey: ["hr", "staff"], queryFn: () => listStaff() });

export const Route = createFileRoute("/_authenticated/hr")({
  loader: ({ context }) => context.queryClient.ensureQueryData(staffQO),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: HRPage,
});

const POSITIONS: StaffPosition[] = ["teacher","principal","vice_principal","bursar","secretary","discipline_master","librarian","nurse","driver","cook","cleaner","security","maintenance","other"];
const CONTRACTS: ContractType[] = ["permanent","fixed_term","part_time","volunteer","intern"];
const STATUSES: StaffStatus[] = ["active","on_leave","suspended","terminated"];

type StaffRow = Awaited<ReturnType<typeof listStaff>>[number];

const empty = (): StaffInput => ({
  first_name: "", last_name: "", position: "teacher", contract_type: "permanent",
  status: "active", base_salary_fcfa: 0,
});

function HRPage() {
  const { data: staff } = useSuspenseQuery(staffQO);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffInput>(empty());
  const save = useServerFn(upsertStaff);
  const del = useServerFn(deleteStaff);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return staff;
    return staff.filter((r) => `${r.first_name} ${r.last_name} ${r.matricule ?? ""} ${r.position} ${r.department ?? ""}`.toLowerCase().includes(s));
  }, [staff, q]);

  const totalPayroll = useMemo(() => staff.filter(s => s.status === "active").reduce((a, r) => a + (r.base_salary_fcfa ?? 0), 0), [staff]);

  function edit(r: StaffRow) {
    setForm({
      id: r.id, matricule: r.matricule, first_name: r.first_name, last_name: r.last_name,
      gender: r.gender, date_of_birth: r.date_of_birth, phone: r.phone, email: r.email,
      address: r.address, national_id: r.national_id, position: r.position as StaffPosition,
      department: r.department, contract_type: r.contract_type as ContractType,
      status: r.status as StaffStatus, hire_date: r.hire_date, end_date: r.end_date,
      base_salary_fcfa: r.base_salary_fcfa, bank_name: r.bank_name, bank_account: r.bank_account,
      momo_number: r.momo_number, notes: r.notes,
    });
    setOpen(true);
  }
  function create() { setForm(empty()); setOpen(true); }

  async function submit() {
    if (!form.first_name || !form.last_name) { toast.error("Name is required"); return; }
    try {
      await save({ data: form });
      toast.success("Saved");
      setOpen(false);
      router.invalidate();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this staff record? Payroll history is preserved.")) return;
    try { await del({ data: { id } }); toast.success("Deleted"); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><Briefcase className="h-7 w-7 text-primary" /> HR &amp; Staff</h1>
          <p className="text-sm text-muted-foreground">Manage personnel records, contracts, and salary base.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/payroll">Go to Payroll</Link></Button>
          <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Add staff</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total staff" value={staff.length.toString()} />
        <StatCard label="Active" value={staff.filter(s=>s.status==='active').length.toString()} />
        <StatCard label="Monthly base payroll" value={fmt(totalPayroll)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Personnel</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name, matricule, position…" className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Matricule</th>
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Contract</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Base salary</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r)=>(
                <tr key={r.id} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{r.first_name} {r.last_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.matricule ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{r.position.replace("_"," ")}</td>
                  <td className="px-3 py-2 capitalize">{r.contract_type.replace("_"," ")}</td>
                  <td className="px-3 py-2"><Badge variant={r.status==='active'?'default':'secondary'} className="capitalize">{r.status.replace("_"," ")}</Badge></td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.base_salary_fcfa ?? 0)}</td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={()=>edit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={()=>remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No staff yet. Click <b>Add staff</b> to create the first record.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{form.id ? "Edit staff" : "Add staff"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 max-h-[70vh] overflow-y-auto pr-2">
            <Field label="First name *"><Input value={form.first_name} onChange={(e)=>setForm({...form, first_name: e.target.value})} /></Field>
            <Field label="Last name *"><Input value={form.last_name} onChange={(e)=>setForm({...form, last_name: e.target.value})} /></Field>
            <Field label="Matricule"><Input value={form.matricule ?? ""} onChange={(e)=>setForm({...form, matricule: e.target.value})} /></Field>
            <Field label="National ID"><Input value={form.national_id ?? ""} onChange={(e)=>setForm({...form, national_id: e.target.value})} /></Field>
            <Field label="Gender">
              <Select value={form.gender ?? ""} onValueChange={(v)=>setForm({...form, gender: v})}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="M">Male</SelectItem><SelectItem value="F">Female</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="Date of birth"><Input type="date" value={form.date_of_birth ?? ""} onChange={(e)=>setForm({...form, date_of_birth: e.target.value || null})} /></Field>
            <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e)=>setForm({...form, phone: e.target.value})} /></Field>
            <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e)=>setForm({...form, email: e.target.value})} /></Field>
            <Field label="Address" className="md:col-span-2"><Input value={form.address ?? ""} onChange={(e)=>setForm({...form, address: e.target.value})} /></Field>
            <Field label="Position">
              <Select value={form.position} onValueChange={(v)=>setForm({...form, position: v as StaffPosition})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POSITIONS.map(p=><SelectItem key={p} value={p} className="capitalize">{p.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Department"><Input value={form.department ?? ""} onChange={(e)=>setForm({...form, department: e.target.value})} /></Field>
            <Field label="Contract type">
              <Select value={form.contract_type} onValueChange={(v)=>setForm({...form, contract_type: v as ContractType})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACTS.map(p=><SelectItem key={p} value={p} className="capitalize">{p.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v)=>setForm({...form, status: v as StaffStatus})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(p=><SelectItem key={p} value={p} className="capitalize">{p.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Hire date"><Input type="date" value={form.hire_date ?? ""} onChange={(e)=>setForm({...form, hire_date: e.target.value || null})} /></Field>
            <Field label="End date"><Input type="date" value={form.end_date ?? ""} onChange={(e)=>setForm({...form, end_date: e.target.value || null})} /></Field>
            <Field label="Base monthly salary (FCFA)"><Input type="number" value={form.base_salary_fcfa} onChange={(e)=>setForm({...form, base_salary_fcfa: Number(e.target.value)||0})} /></Field>
            <Field label="Bank name"><Input value={form.bank_name ?? ""} onChange={(e)=>setForm({...form, bank_name: e.target.value})} /></Field>
            <Field label="Bank account"><Input value={form.bank_account ?? ""} onChange={(e)=>setForm({...form, bank_account: e.target.value})} /></Field>
            <Field label="MoMo number"><Input value={form.momo_number ?? ""} onChange={(e)=>setForm({...form, momo_number: e.target.value})} /></Field>
            <Field label="Notes" className="md:col-span-2"><Textarea rows={2} value={form.notes ?? ""} onChange={(e)=>setForm({...form, notes: e.target.value})} /></Field>
          </div>
          <DialogFooter>
            {form.id && <Button asChild variant="secondary"><Link to="/hr/$staffId" params={{ staffId: form.id }}>Open profile</Link></Button>}
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-6">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </CardContent></Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}