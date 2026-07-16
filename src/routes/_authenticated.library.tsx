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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Pencil, Search, Copy as CopyIcon } from "lucide-react";
import {
  listBooks, upsertBook, deleteBook,
  listCopies, addCopies, deleteCopy,
  listLoans, createLoan, returnLoan,
  listReservations, createReservation, updateReservation, fulfilReservation,
  searchLibraryStudents, listStaffLite, librarySummary,
  type BorrowerType, type LoanStatus, type ReservationStatus,
} from "@/lib/library.functions";

const summaryQO = queryOptions({ queryKey: ["library", "summary"], queryFn: () => librarySummary() });
const booksQO = queryOptions({ queryKey: ["library", "books"], queryFn: () => listBooks({ data: {} }) });
const loansQO = queryOptions({ queryKey: ["library", "loans"], queryFn: () => listLoans({ data: { status: "all" } }) });
const resQO = queryOptions({ queryKey: ["library", "res"], queryFn: () => listReservations() });
const staffQO = queryOptions({ queryKey: ["library", "staff"], queryFn: () => listStaffLite() });

export const Route = createFileRoute("/_authenticated/library")({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(summaryQO),
    context.queryClient.ensureQueryData(booksQO),
  ]),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
  component: LibraryPage,
});

function LibraryPage() {
  const { data: summary } = useSuspenseQuery(summaryQO);
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted-foreground">Catalog, copies, loans, and reservations.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Titles" value={summary.titles} />
        <Stat label="Copies" value={summary.copies} />
        <Stat label="Available" value={summary.available} />
        <Stat label="Active loans" value={summary.activeLoans} />
        <Stat label="Overdue" value={summary.overdue} tone={summary.overdue > 0 ? "text-destructive" : ""} />
        <Stat label="Reservations" value={summary.reservations} />
      </div>
      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="res">Reservations</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog"><CatalogTab /></TabsContent>
        <TabsContent value="loans"><LoansTab /></TabsContent>
        <TabsContent value="res"><ReservationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground"><span>{label}</span><BookOpen className="h-4 w-4" /></div>
      <div className={`mt-2 text-lg font-semibold ${tone ?? ""}`}>{value}</div>
    </CardContent></Card>
  );
}

// ── Catalog ────────────────────────────────────────────────────────────
function CatalogTab() {
  const { data: books } = useSuspenseQuery(booksQO);
  const router = useRouter();
  const save = useServerFn(upsertBook);
  const del = useServerFn(deleteBook);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; title: string; author: string; isbn: string; category: string; publisher: string; year: number | ""; location: string }>({ title: "", author: "", isbn: "", category: "", publisher: "", year: "", location: "" });
  const [copiesOpen, setCopiesOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return books;
    return books.filter((b) => `${b.title} ${b.author ?? ""} ${b.isbn ?? ""}`.toLowerCase().includes(t));
  }, [books, q]);

  async function submit() {
    if (!form.title) { toast.error("Title required"); return; }
    try { await save({ data: { ...form, year: form.year === "" ? undefined : Number(form.year) } }); toast.success("Saved"); setOpen(false); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative"><Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="w-64 pl-8" placeholder="Search title, author, ISBN" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" onClick={() => setForm({ title: "", author: "", isbn: "", category: "", publisher: "", year: "", location: "" })}><Plus className="mr-1 h-4 w-4" />Add book</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "Add"} book</DialogTitle></DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
                <div><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div><Label>Publisher</Label><Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} /></div>
                <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
                <div><Label>Shelf / location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No books.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-2">Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Copies</th><th>Available</th><th></th></tr></thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="py-2 font-medium">{b.title}</td>
                    <td>{b.author ?? "—"}</td>
                    <td className="font-mono text-xs">{b.isbn ?? "—"}</td>
                    <td>{b.category ?? "—"}</td>
                    <td>{b.total_copies}</td>
                    <td>{b.available_copies}</td>
                    <td className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setCopiesOpen(b.id)}><CopyIcon className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setForm({ id: b.id, title: b.title, author: b.author ?? "", isbn: b.isbn ?? "", category: b.category ?? "", publisher: b.publisher ?? "", year: b.year ?? "", location: b.location ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete book and all copies?")) { await del({ data: { id: b.id } }); router.invalidate(); } }}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {copiesOpen && <CopiesDialog bookId={copiesOpen} onClose={() => setCopiesOpen(null)} />}
    </>
  );
}

function CopiesDialog({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const router = useRouter();
  const copiesQO = queryOptions({ queryKey: ["library", "copies", bookId], queryFn: () => listCopies({ data: { bookId } }) });
  const { data: copies } = useSuspenseQuery(copiesQO);
  const add = useServerFn(addCopies);
  const del = useServerFn(deleteCopy);
  const [count, setCount] = useState(1);
  const [prefix, setPrefix] = useState("");

  async function doAdd() {
    try { await add({ data: { book_id: bookId, count, barcode_prefix: prefix || undefined } }); toast.success("Added"); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Copies</DialogTitle></DialogHeader>
        <div className="flex items-end gap-2">
          <div><Label>Barcode prefix</Label><Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. LIB-" /></div>
          <div><Label>Count</Label><Input type="number" className="w-24" value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
          <Button onClick={doAdd}>Add copies</Button>
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border">
          {copies.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No copies yet.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {copies.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-2 font-mono text-xs">{c.barcode ?? c.id.slice(0, 8)}</td>
                    <td className="p-2"><Badge variant={c.status === "available" ? "default" : "secondary"} className="capitalize">{c.status}</Badge></td>
                    <td className="p-2 text-right">{c.status !== "loaned" && <Button size="icon" variant="ghost" onClick={async () => { await del({ data: { id: c.id } }); router.invalidate(); }}><Trash2 className="h-4 w-4" /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Loans ──────────────────────────────────────────────────────────────
function LoansTab() {
  const { data: loans } = useSuspenseQuery(loansQO);
  const { data: books } = useSuspenseQuery(booksQO);
  const { data: staff } = useSuspenseQuery(staffQO);
  const router = useRouter();
  const create = useServerFn(createLoan);
  const ret = useServerFn(returnLoan);
  const search = useServerFn(searchLibraryStudents);
  const listCopiesFn = useServerFn(listCopies);
  const [statusFilter, setStatusFilter] = useState<LoanStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ book_id: string; copy_id: string; borrower_type: BorrowerType; student_id: string; student_name: string; staff_id: string; due_date: string; note: string }>({ book_id: "", copy_id: "", borrower_type: "student", student_id: "", student_name: "", staff_id: "", due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), note: "" });
  const [availableCopies, setAvailableCopies] = useState<Awaited<ReturnType<typeof listCopies>>>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchLibraryStudents>>>([]);

  async function loadCopies(bookId: string) {
    setForm({ ...form, book_id: bookId, copy_id: "" });
    const all = await listCopiesFn({ data: { bookId } });
    setAvailableCopies(all.filter((c) => c.status === "available"));
  }

  async function submit() {
    if (!form.copy_id) { toast.error("Select a copy"); return; }
    try { await create({ data: { copy_id: form.copy_id, borrower_type: form.borrower_type, student_id: form.student_id || undefined, staff_id: form.staff_id || undefined, due_date: form.due_date, note: form.note } }); toast.success("Loan created"); setOpen(false); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const filtered = useMemo(() => statusFilter === "all" ? loans : loans.filter((l) => l.status === statusFilter), [loans, statusFilter]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LoanStatus | "all")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="returned">Returned</SelectItem><SelectItem value="lost">Lost</SelectItem></SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={() => { setForm({ book_id: "", copy_id: "", borrower_type: "student", student_id: "", student_name: "", staff_id: "", due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), note: "" }); setAvailableCopies([]); setQ(""); setResults([]); }}><Plus className="mr-1 h-4 w-4" />New loan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Check out</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Book</Label>
                <Select value={form.book_id} onValueChange={loadCopies}>
                  <SelectTrigger><SelectValue placeholder="Select book" /></SelectTrigger>
                  <SelectContent>{books.filter((b) => b.available_copies > 0).map((b) => <SelectItem key={b.id} value={b.id}>{b.title} · {b.available_copies} avail.</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.book_id && (
                <div><Label>Copy</Label>
                  <Select value={form.copy_id} onValueChange={(v) => setForm({ ...form, copy_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select copy" /></SelectTrigger>
                    <SelectContent>{availableCopies.map((c) => <SelectItem key={c.id} value={c.id}>{c.barcode ?? c.id.slice(0, 8)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Borrower type</Label>
                <Select value={form.borrower_type} onValueChange={(v) => setForm({ ...form, borrower_type: v as BorrowerType, student_id: "", staff_id: "", student_name: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="staff">Staff</SelectItem></SelectContent>
                </Select>
              </div>
              {form.borrower_type === "student" ? (
                <div><Label>Student</Label>
                  {form.student_id ? (
                    <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm"><span>{form.student_name}</span><Button size="sm" variant="ghost" onClick={() => setForm({ ...form, student_id: "", student_name: "" })}>Change</Button></div>
                  ) : (
                    <>
                      <Input placeholder="Search…" value={q} onChange={async (e) => { setQ(e.target.value); if (e.target.value.length >= 2) setResults(await search({ data: { q: e.target.value } })); else setResults([]); }} />
                      {results.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-border">
                          {results.map((r) => (
                            <button key={r.id} type="button" className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted" onClick={() => setForm({ ...form, student_id: r.id, student_name: `${r.full_name} · ${r.class_name ?? ""}` })}>
                              <span>{r.full_name}</span><span className="text-muted-foreground">{r.matricule}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div><Label>Staff</Label>
                  <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name} · {s.position}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Create loan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No loans.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Book</th><th>Borrower</th><th>Loaned</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((l) => {
                const b = (l as { library_books?: { title?: string } }).library_books;
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="py-2 font-medium">{b?.title ?? "—"}</td>
                    <td>{l.borrower_name} <span className="text-xs text-muted-foreground capitalize">({l.borrower_type})</span></td>
                    <td>{new Date(l.loaned_at).toLocaleDateString()}</td>
                    <td>{l.due_date}</td>
                    <td>
                      {l.is_overdue ? <Badge variant="destructive">Overdue</Badge>
                        : l.status === "active" ? <Badge>Active</Badge>
                        : <Badge variant="secondary" className="capitalize">{l.status}</Badge>}
                    </td>
                    <td className="text-right">
                      {l.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={async () => { await ret({ data: { id: l.id } }); router.invalidate(); }}>Return</Button>
                          <Button size="sm" variant="ghost" className="ml-1 text-destructive" onClick={async () => { if (confirm("Mark as lost?")) { await ret({ data: { id: l.id, lost: true } }); router.invalidate(); } }}>Lost</Button>
                        </>
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
  );
}

// ── Reservations ───────────────────────────────────────────────────────
function ReservationsTab() {
  const { data: res } = useSuspenseQuery(resQO);
  const { data: books } = useSuspenseQuery(booksQO);
  const { data: staff } = useSuspenseQuery(staffQO);
  const router = useRouter();
  const create = useServerFn(createReservation);
  const update = useServerFn(updateReservation);
  const search = useServerFn(searchLibraryStudents);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ book_id: string; borrower_type: BorrowerType; student_id: string; student_name: string; staff_id: string; note: string }>({ book_id: "", borrower_type: "student", student_id: "", student_name: "", staff_id: "", note: "" });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchLibraryStudents>>>([]);

  async function submit() {
    if (!form.book_id) { toast.error("Select a book"); return; }
    try { await create({ data: { book_id: form.book_id, borrower_type: form.borrower_type, student_id: form.student_id || undefined, staff_id: form.staff_id || undefined, note: form.note } }); toast.success("Reserved"); setOpen(false); router.invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Reservations</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={() => { setForm({ book_id: "", borrower_type: "student", student_id: "", student_name: "", staff_id: "", note: "" }); setQ(""); setResults([]); }}><Plus className="mr-1 h-4 w-4" />Reserve</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New reservation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Book</Label>
                <Select value={form.book_id} onValueChange={(v) => setForm({ ...form, book_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{books.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Borrower type</Label>
                <Select value={form.borrower_type} onValueChange={(v) => setForm({ ...form, borrower_type: v as BorrowerType, student_id: "", staff_id: "", student_name: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="staff">Staff</SelectItem></SelectContent>
                </Select>
              </div>
              {form.borrower_type === "student" ? (
                <div><Label>Student</Label>
                  {form.student_id ? (
                    <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm"><span>{form.student_name}</span><Button size="sm" variant="ghost" onClick={() => setForm({ ...form, student_id: "", student_name: "" })}>Change</Button></div>
                  ) : (
                    <>
                      <Input placeholder="Search…" value={q} onChange={async (e) => { setQ(e.target.value); if (e.target.value.length >= 2) setResults(await search({ data: { q: e.target.value } })); else setResults([]); }} />
                      {results.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-border">
                          {results.map((r) => (
                            <button key={r.id} type="button" className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted" onClick={() => setForm({ ...form, student_id: r.id, student_name: `${r.full_name} · ${r.class_name ?? ""}` })}>
                              <span>{r.full_name}</span><span className="text-muted-foreground">{r.matricule}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div><Label>Staff</Label>
                  <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Reserve</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {res.length === 0 ? <p className="text-sm text-muted-foreground">No reservations.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Book</th><th>Borrower</th><th>Reserved</th><th>Available now?</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {res.map((r) => {
                const b = (r as { library_books?: { title?: string; available_copies?: number } }).library_books;
                const avail = (b?.available_copies ?? 0) > 0;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 font-medium">{b?.title ?? "—"}</td>
                    <td>{r.borrower_name} <span className="text-xs text-muted-foreground capitalize">({r.borrower_type})</span></td>
                    <td>{new Date(r.reserved_at).toLocaleDateString()}</td>
                    <td>{avail ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                    <td><Badge variant={r.status === "pending" ? "default" : "secondary"} className="capitalize">{r.status}</Badge></td>
                    <td className="text-right">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={async () => { await update({ data: { id: r.id, status: "fulfilled" as ReservationStatus } }); router.invalidate(); }}>Fulfill</Button>
                          <Button size="sm" variant="ghost" className="ml-1" onClick={async () => { await update({ data: { id: r.id, status: "cancelled" as ReservationStatus } }); router.invalidate(); }}>Cancel</Button>
                        </>
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
  );
}