import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type CopyStatus = "available" | "loaned" | "lost" | "damaged";
export type LoanStatus = "active" | "returned" | "overdue" | "lost";
export type BorrowerType = "student" | "staff";
export type ReservationStatus = "pending" | "fulfilled" | "cancelled" | "expired";

// ── Books & Copies ──────────────────────────────────────────────────────
export const listBooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data: rows, error } = await context.supabase
      .from("library_books")
      .select("*")
      .eq("school_id", schoolId)
      .order("title");
    if (error) throw new Error(error.message);
    const term = (data.q ?? "").trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((r) =>
      `${r.title} ${r.author ?? ""} ${r.isbn ?? ""} ${r.category ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  });

export const upsertBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      title: string;
      author?: string;
      isbn?: string;
      category?: string;
      publisher?: string;
      year?: number;
      location?: string;
      cover_url?: string;
      initial_copies?: number;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      title: data.title,
      author: data.author ?? null,
      isbn: data.isbn ?? null,
      category: data.category ?? null,
      publisher: data.publisher ?? null,
      year: data.year ?? null,
      location: data.location ?? null,
      cover_url: data.cover_url ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("library_books").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await context.supabase
        .from("library_books")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const n = Math.max(0, Math.min(100, Math.floor(data.initial_copies ?? 1)));
      if (inserted && n > 0) {
        const copies = Array.from({ length: n }, () => ({
          school_id: schoolId,
          book_id: inserted.id,
          status: "available" as CopyStatus,
        }));
        await context.supabase.from("library_copies").insert(copies);
      }
    }
    return { ok: true };
  });

export const deleteBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("library_books").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCopies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookId: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data: rows, error } = await context.supabase
      .from("library_copies")
      .select("*")
      .eq("school_id", schoolId)
      .eq("book_id", data.bookId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addCopies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { book_id: string; count: number; barcode_prefix?: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const count = Math.max(1, Math.min(100, Math.floor(data.count)));
    const prefix = data.barcode_prefix ?? "";
    const rows = Array.from({ length: count }, (_, i) => ({
      school_id: schoolId,
      book_id: data.book_id,
      barcode: prefix ? `${prefix}${String(Date.now()).slice(-6)}${i + 1}` : null,
      status: "available" as CopyStatus,
    }));
    const { error } = await context.supabase.from("library_copies").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count };
  });

export const deleteCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("library_copies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Loans ───────────────────────────────────────────────────────────────
export const listLoans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: LoanStatus | "all" }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    let q = context.supabase
      .from("library_loans")
      .select(
        "*, library_books(title, author), library_copies(barcode), students(first_name,last_name,matricule,class_name), staff(first_name,last_name)",
      )
      .eq("school_id", schoolId)
      .order("loaned_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const today = new Date().toISOString().slice(0, 10);
    return (rows ?? []).map((r) => {
      const s = (r as { students?: { first_name?: string; last_name?: string } }).students;
      const st = (r as { staff?: { first_name?: string; last_name?: string } }).staff;
      const borrower_name =
        r.borrower_type === "student"
          ? s
            ? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()
            : ""
          : st
            ? `${st.first_name ?? ""} ${st.last_name ?? ""}`.trim()
            : "";
      const is_overdue = r.status === "active" && r.due_date < today;
      return { ...r, borrower_name, is_overdue };
    });
  });

export const createLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      copy_id: string;
      borrower_type: BorrowerType;
      student_id?: string;
      staff_id?: string;
      due_date: string;
      note?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const { data: copy, error: ce } = await context.supabase
      .from("library_copies")
      .select("id, book_id, status")
      .eq("id", data.copy_id)
      .single();
    if (ce || !copy) throw new Error("Copy not found");
    if (copy.status !== "available") throw new Error("Copy is not available");
    if (data.borrower_type === "student" && !data.student_id) throw new Error("Select a student");
    if (data.borrower_type === "staff" && !data.staff_id) throw new Error("Select a staff member");

    const { error: le } = await context.supabase.from("library_loans").insert({
      school_id: schoolId,
      copy_id: data.copy_id,
      book_id: copy.book_id,
      borrower_type: data.borrower_type,
      student_id: data.borrower_type === "student" ? data.student_id : null,
      staff_id: data.borrower_type === "staff" ? data.staff_id : null,
      due_date: data.due_date,
      note: data.note ?? null,
      recorded_by: context.userId,
    });
    if (le) throw new Error(le.message);
    await context.supabase
      .from("library_copies")
      .update({ status: "loaned" })
      .eq("id", data.copy_id);
    return { ok: true };
  });

export const returnLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; lost?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { data: loan, error } = await context.supabase
      .from("library_loans")
      .select("id, copy_id, status")
      .eq("id", data.id)
      .single();
    if (error || !loan) throw new Error("Loan not found");
    if (loan.status !== "active") throw new Error("Loan already closed");
    const newStatus: LoanStatus = data.lost ? "lost" : "returned";
    const copyStatus: CopyStatus = data.lost ? "lost" : "available";
    await context.supabase
      .from("library_loans")
      .update({ status: newStatus, returned_at: new Date().toISOString() })
      .eq("id", loan.id);
    await context.supabase
      .from("library_copies")
      .update({ status: copyStatus })
      .eq("id", loan.copy_id);
    return { ok: true };
  });

// ── Reservations ────────────────────────────────────────────────────────
export const listReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data, error } = await context.supabase
      .from("library_reservations")
      .select(
        "*, library_books(title, author, available_copies), students(first_name,last_name,matricule,class_name), staff(first_name,last_name)",
      )
      .eq("school_id", schoolId)
      .order("reserved_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const s = (r as { students?: { first_name?: string; last_name?: string } }).students;
      const st = (r as { staff?: { first_name?: string; last_name?: string } }).staff;
      const borrower_name =
        r.borrower_type === "student"
          ? s
            ? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()
            : ""
          : st
            ? `${st.first_name ?? ""} ${st.last_name ?? ""}`.trim()
            : "";
      return { ...r, borrower_name };
    });
  });

export const createReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      book_id: string;
      borrower_type: BorrowerType;
      student_id?: string;
      staff_id?: string;
      note?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const { error } = await context.supabase.from("library_reservations").insert({
      school_id: schoolId,
      book_id: data.book_id,
      borrower_type: data.borrower_type,
      student_id: data.borrower_type === "student" ? (data.student_id ?? null) : null,
      staff_id: data.borrower_type === "staff" ? (data.staff_id ?? null) : null,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: ReservationStatus }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("library_reservations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fulfilReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; due_date: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const { data: res, error: rErr } = await context.supabase
      .from("library_reservations")
      .select("id, book_id, borrower_type, student_id, staff_id, status")
      .eq("id", data.id)
      .single();
    if (rErr || !res) throw new Error("Reservation not found");
    if (res.status !== "pending") throw new Error("Reservation is not pending");
    const { data: copy, error: cErr } = await context.supabase
      .from("library_copies")
      .select("id")
      .eq("book_id", res.book_id)
      .eq("status", "available")
      .limit(1)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!copy) throw new Error("No available copy — add copies first");
    const { error: lErr } = await context.supabase.from("library_loans").insert({
      school_id: schoolId,
      copy_id: copy.id,
      book_id: res.book_id,
      borrower_type: res.borrower_type,
      student_id: res.borrower_type === "student" ? res.student_id : null,
      staff_id: res.borrower_type === "staff" ? res.staff_id : null,
      due_date: data.due_date,
      recorded_by: context.userId,
    });
    if (lErr) throw new Error(lErr.message);
    await context.supabase.from("library_copies").update({ status: "loaned" }).eq("id", copy.id);
    await context.supabase
      .from("library_reservations")
      .update({ status: "fulfilled" })
      .eq("id", res.id);
    return { ok: true };
  });

// ── Search helpers ──────────────────────────────────────────────────────
export const searchLibraryStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const term = data.q.trim();
    if (!term) return [];
    const { data: rows, error } = await context.supabase
      .from("students")
      .select("id, first_name, last_name, matricule, class_name")
      .eq("school_id", schoolId)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,matricule.ilike.%${term}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name}` }));
  });

export const listStaffLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data, error } = await context.supabase
      .from("staff")
      .select("id, first_name, last_name, position")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("last_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name}` }));
  });

export const librarySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId)
      return { titles: 0, copies: 0, available: 0, activeLoans: 0, overdue: 0, reservations: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const [b, c, l, o, r] = await Promise.all([
      context.supabase
        .from("library_books")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      context.supabase
        .from("library_copies")
        .select("id, status", { count: "exact" })
        .eq("school_id", schoolId),
      context.supabase
        .from("library_loans")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "active"),
      context.supabase
        .from("library_loans")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "active")
        .lt("due_date", today),
      context.supabase
        .from("library_reservations")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "pending"),
    ]);
    const copies = c.count ?? 0;
    const available = (c.data ?? []).filter((x) => x.status === "available").length;
    return {
      titles: b.count ?? 0,
      copies,
      available,
      activeLoans: l.count ?? 0,
      overdue: o.count ?? 0,
      reservations: r.count ?? 0,
    };
  });
