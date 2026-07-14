import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type DormGender = "male" | "female" | "mixed";
export type RollStatus = "present" | "absent" | "exeat" | "sick" | "late";
export type RollSession = "morning" | "evening" | "night";
export type ExeatStatus = "pending" | "approved" | "denied" | "departed" | "returned" | "overdue" | "cancelled";

/* ============ DORMITORIES ============ */
export const listDormitories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    const { data: dorms, error } = await supabase
      .from("dormitories")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Error(error.message);
    const ids = (dorms ?? []).map((d) => d.id);
    let occupancy: Record<string, number> = {};
    if (ids.length) {
      const { data: assigns } = await supabase
        .from("boarding_assignments")
        .select("dormitory_id")
        .eq("school_id", schoolId)
        .eq("active", true)
        .in("dormitory_id", ids);
      for (const a of assigns ?? []) occupancy[a.dormitory_id] = (occupancy[a.dormitory_id] ?? 0) + 1;
    }
    return (dorms ?? []).map((d) => ({ ...d, occupied: occupancy[d.id] ?? 0 }));
  });

export const upsertDormitory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; gender: DormGender; capacity: number; warden_name?: string | null; warden_phone?: string | null; notes?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const payload = { school_id: schoolId, name: data.name, gender: data.gender, capacity: data.capacity, warden_name: data.warden_name ?? null, warden_phone: data.warden_phone ?? null, notes: data.notes ?? null };
    const { error } = data.id
      ? await supabase.from("dormitories").update(payload).eq("id", data.id)
      : await supabase.from("dormitories").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDormitory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("dormitories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ROOMS ============ */
export const listRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dormitoryId?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase.from("dorm_rooms").select("*").eq("school_id", schoolId).order("room_number");
    if (data.dormitoryId) q = q.eq("dormitory_id", data.dormitoryId);
    const { data: rooms, error } = await q;
    if (error) throw new Error(error.message);
    return rooms ?? [];
  });

export const upsertRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; dormitory_id: string; room_number: string; capacity: number; notes?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const payload = { school_id: schoolId, dormitory_id: data.dormitory_id, room_number: data.room_number, capacity: data.capacity, notes: data.notes ?? null };
    const { error } = data.id
      ? await supabase.from("dorm_rooms").update(payload).eq("id", data.id)
      : await supabase.from("dorm_rooms").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("dorm_rooms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ASSIGNMENTS ============ */
export const listBoardingAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dormitoryId?: string; q?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("boarding_assignments")
      .select("id, student_id, dormitory_id, room_id, bed_number, assigned_on, active, students(first_name, last_name, matricule, class_name, gender), dormitories(name), dorm_rooms(room_number)")
      .eq("school_id", schoolId)
      .eq("active", true)
      .order("assigned_on", { ascending: false })
      .limit(1000);
    if (data.dormitoryId) q = q.eq("dormitory_id", data.dormitoryId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let out = (rows ?? []).map((r: any) => ({ ...r, students: r.students ? { ...r.students, full_name: `${r.students.first_name ?? ""} ${r.students.last_name ?? ""}`.trim() } : r.students }));
    if (data.q) {
      const t = data.q.toLowerCase();
      out = out.filter((r: any) => r.students?.full_name?.toLowerCase().includes(t) || r.students?.matricule?.toLowerCase().includes(t));
    }
    return out;
  });

export const assignBoardingStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string; dormitory_id: string; room_id?: string | null; bed_number?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    // Release previous active assignment
    await supabase.from("boarding_assignments").update({ active: false, released_on: new Date().toISOString().slice(0, 10) }).eq("student_id", data.student_id).eq("active", true);
    const { error } = await supabase.from("boarding_assignments").insert({
      school_id: schoolId, student_id: data.student_id, dormitory_id: data.dormitory_id,
      room_id: data.room_id ?? null, bed_number: data.bed_number ?? null, active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseBoardingAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("boarding_assignments").update({ active: false, released_on: new Date().toISOString().slice(0, 10) }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ROLL CALL ============ */
export const getRollCall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dormitory_id: string; date: string; session: RollSession }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { roster: [], marks: {} };
    const { data: assigns } = await supabase
      .from("boarding_assignments")
      .select("student_id, bed_number, dorm_rooms(room_number), students(first_name, last_name, matricule, class_name)")
      .eq("school_id", schoolId).eq("dormitory_id", data.dormitory_id).eq("active", true);
    const { data: marks } = await supabase
      .from("boarding_roll_call")
      .select("student_id, status, note")
      .eq("school_id", schoolId).eq("dormitory_id", data.dormitory_id)
      .eq("roll_date", data.date).eq("session", data.session);
    const map: Record<string, { status: RollStatus; note: string | null }> = {};
    for (const m of marks ?? []) map[m.student_id] = { status: m.status as RollStatus, note: m.note };
    const roster = (assigns ?? []).map((r: any) => ({ ...r, students: r.students ? { ...r.students, full_name: `${r.students.first_name ?? ""} ${r.students.last_name ?? ""}`.trim() } : r.students }));
    return { roster, marks: map };
  });

export const saveRollCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dormitory_id: string; date: string; session: RollSession; entries: Array<{ student_id: string; status: RollStatus; note?: string | null }> }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const rows = data.entries.map((e) => ({
      school_id: schoolId, dormitory_id: data.dormitory_id, student_id: e.student_id,
      roll_date: data.date, session: data.session, status: e.status, note: e.note ?? null, recorded_by: userId,
    }));
    if (!rows.length) return { ok: true };
    const { error } = await supabase.from("boarding_roll_call").upsert(rows, { onConflict: "student_id,roll_date,session" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ EXEATS ============ */
export const listExeats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: ExeatStatus | "all"; q?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase.from("boarding_exeats")
      .select("*, students(first_name, last_name, matricule, class_name)")
      .eq("school_id", schoolId).order("depart_at", { ascending: false }).limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let out = (rows ?? []).map((r: any) => ({ ...r, students: r.students ? { ...r.students, full_name: `${r.students.first_name ?? ""} ${r.students.last_name ?? ""}`.trim() } : r.students }));
    if (data.q) {
      const t = data.q.toLowerCase();
      out = out.filter((r: any) => r.students?.full_name?.toLowerCase().includes(t) || r.students?.matricule?.toLowerCase().includes(t));
    }
    // Mark overdue
    const now = Date.now();
    for (const r of out as any[]) {
      if ((r.status === "departed" || r.status === "approved") && new Date(r.return_by).getTime() < now && !r.actual_return_at) {
        r.status = "overdue";
      }
    }
    return out;
  });

export const createExeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id: string; reason: string; destination?: string | null; depart_at: string; return_by: string; guardian_name?: string | null; guardian_phone?: string | null; guardian_approved: boolean; guardian_approval_note?: string | null; notes?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { error } = await supabase.from("boarding_exeats").insert({
      school_id: schoolId, student_id: data.student_id, reason: data.reason,
      destination: data.destination ?? null, depart_at: data.depart_at, return_by: data.return_by,
      guardian_name: data.guardian_name ?? null, guardian_phone: data.guardian_phone ?? null,
      guardian_approved: data.guardian_approved, guardian_approval_note: data.guardian_approval_note ?? null,
      notes: data.notes ?? null, status: data.guardian_approved ? "approved" : "pending",
      approved_by: data.guardian_approved ? userId : null, approved_at: data.guardian_approved ? new Date().toISOString() : null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateExeatStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: ExeatStatus }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: any = { status: data.status };
    if (data.status === "approved") { patch.guardian_approved = true; patch.approved_by = userId; patch.approved_at = new Date().toISOString(); }
    if (data.status === "returned") patch.actual_return_at = new Date().toISOString();
    const { error } = await supabase.from("boarding_exeats").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("boarding_exeats").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ VISITORS ============ */
export const listVisitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; activeOnly?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase.from("boarding_visitors")
      .select("*, students(first_name, last_name, matricule, class_name)")
      .eq("school_id", schoolId).order("check_in_at", { ascending: false }).limit(500);
    if (data.activeOnly) q = q.is("check_out_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let out = (rows ?? []).map((r: any) => ({ ...r, students: r.students ? { ...r.students, full_name: `${r.students.first_name ?? ""} ${r.students.last_name ?? ""}`.trim() } : r.students }));
    if (data.q) {
      const t = data.q.toLowerCase();
      out = out.filter((r: any) => r.visitor_name?.toLowerCase().includes(t) || r.students?.full_name?.toLowerCase().includes(t));
    }
    return out;
  });

export const checkInVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { student_id?: string | null; visitor_name: string; visitor_phone?: string | null; relationship?: string | null; id_document?: string | null; purpose?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school");
    const { error } = await supabase.from("boarding_visitors").insert({
      school_id: schoolId, student_id: data.student_id ?? null, visitor_name: data.visitor_name,
      visitor_phone: data.visitor_phone ?? null, relationship: data.relationship ?? null,
      id_document: data.id_document ?? null, purpose: data.purpose ?? null, recorded_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkOutVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("boarding_visitors").update({ check_out_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ SUMMARY ============ */
export const boardingSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return { dorms: 0, boarders: 0, capacity: 0, exeatsOut: 0, visitorsIn: 0 };
    const [dorms, boarders, exeats, visitors] = await Promise.all([
      supabase.from("dormitories").select("capacity").eq("school_id", schoolId),
      supabase.from("boarding_assignments").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("active", true),
      supabase.from("boarding_exeats").select("id", { count: "exact", head: true }).eq("school_id", schoolId).in("status", ["approved", "departed", "overdue"]),
      supabase.from("boarding_visitors").select("id", { count: "exact", head: true }).eq("school_id", schoolId).is("check_out_at", null),
    ]);
    const capacity = (dorms.data ?? []).reduce((a, r: any) => a + (r.capacity ?? 0), 0);
    return {
      dorms: dorms.data?.length ?? 0,
      boarders: boarders.count ?? 0,
      capacity,
      exeatsOut: exeats.count ?? 0,
      visitorsIn: visitors.count ?? 0,
    };
  });

/* ============ STUDENT SEARCH ============ */
export const searchBoardingStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId || !data.q) return [];
    const t = `%${data.q}%`;
    const { data: rows } = await supabase.from("students")
      .select("id, first_name, last_name, matricule, class_name, gender")
      .eq("school_id", schoolId).eq("status", "active")
      .or(`first_name.ilike.${t},last_name.ilike.${t},matricule.ilike.${t}`)
      .limit(20);
    return (rows ?? []).map((r: any) => ({ ...r, full_name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() }));
  });