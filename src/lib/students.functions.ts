import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const [studentsRes, regFeesRes, paysRes] = await Promise.all([
      supabase
        .from("students")
        .select("*")
        .eq("school_id", schoolId)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
      supabase
        .from("student_fees")
        .select("student_id, amount_fcfa, discount_fcfa, fee_structures!inner(kind)")
        .eq("school_id", schoolId)
        .eq("fee_structures.kind", "registration"),
      supabase
        .from("payments")
        .select("student_id, amount_fcfa")
        .eq("school_id", schoolId),
    ]);
    if (studentsRes.error) throw studentsRes.error;

    const regBilled = new Map<string, number>();
    for (const r of regFeesRes.data ?? []) {
      const sid = (r as { student_id: string }).student_id;
      const amt = Math.max(Number(r.amount_fcfa ?? 0) - Number(r.discount_fcfa ?? 0), 0);
      regBilled.set(sid, (regBilled.get(sid) ?? 0) + amt);
    }
    const paid = new Map<string, number>();
    for (const p of paysRes.data ?? []) {
      paid.set(p.student_id, (paid.get(p.student_id) ?? 0) + Number(p.amount_fcfa ?? 0));
    }
    return (studentsRes.data ?? []).map((s) => {
      const billed = regBilled.get(s.id) ?? 0;
      const covered = Math.min(paid.get(s.id) ?? 0, billed);
      return { ...s, registration_owed: Math.max(billed - covered, 0), registration_billed: billed };
    });
  });

const studentByIdSchema = z.object({ id: z.string().uuid() });

export const getStudentById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => studentByIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data: student, error } = await supabase
      .from("students")
      .select("*, guardians(*)")
      .eq("id", data.id)
      .eq("school_id", schoolId)
      .single();

    if (error) throw error;

    // Live attendance counts + registration status
    const [attRes, regRes, paysAgg, feesAgg] = await Promise.all([
      supabase
        .from("attendance")
        .select("status")
        .eq("school_id", schoolId)
        .eq("student_id", data.id),
      supabase
        .from("student_fees")
        .select("amount_fcfa, discount_fcfa, fee_structures!inner(kind)")
        .eq("school_id", schoolId)
        .eq("student_id", data.id)
        .eq("fee_structures.kind", "registration"),
      supabase
        .from("payments")
        .select("amount_fcfa")
        .eq("school_id", schoolId)
        .eq("student_id", data.id),
      supabase
        .from("student_fees")
        .select("amount_fcfa, discount_fcfa")
        .eq("school_id", schoolId)
        .eq("student_id", data.id),
    ]);
    const att = attRes.data ?? [];
    const present = att.filter((a) => a.status === "present").length;
    const absent = att.filter((a) => a.status === "absent").length;
    const late = att.filter((a) => a.status === "late").length;
    const excused = att.filter((a) => a.status === "excused").length;
    const regBilled = (regRes.data ?? []).reduce(
      (s, r) => s + Math.max(Number(r.amount_fcfa ?? 0) - Number(r.discount_fcfa ?? 0), 0),
      0,
    );
    const totalBilled = (feesAgg.data ?? []).reduce(
      (s, r) => s + Math.max(Number(r.amount_fcfa ?? 0) - Number(r.discount_fcfa ?? 0), 0),
      0,
    );
    const totalPaid = (paysAgg.data ?? []).reduce((s, p) => s + Number(p.amount_fcfa ?? 0), 0);
    const regCovered = Math.min(totalPaid, regBilled);
    return {
      ...student,
      attendance_counts: { present, absent, late, excused, total: att.length },
      registration_billed: regBilled,
      registration_owed: Math.max(regBilled - regCovered, 0),
      total_billed: totalBilled,
      total_paid: totalPaid,
    };
  });

const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  matricule: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  className: z.string().optional(),
  section: z.string().optional(),
  status: z.enum(["active", "inactive", "graduated", "withdrawn", "suspended"]).optional(),
  feeBalance: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelationship: z.string().optional(),
});

type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateStudentInput) => createStudentSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned to this account");

    const { data: student, error } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        first_name: data.firstName,
        last_name: data.lastName,
        matricule: data.matricule,
        date_of_birth: data.dateOfBirth || null,
        gender: data.gender ?? null,
        class_name: data.className || null,
        section: data.section || null,
        status: data.status ?? "active",
        fee_balance: data.feeBalance ?? 0,
        notes: data.notes || null,
        guardian_phone: data.guardianPhone || null,
        guardian_email: data.guardianEmail || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (data.guardianName && student) {
      const { error: gErr } = await supabase.from("guardians").insert({
        school_id: schoolId,
        student_id: student.id,
        full_name: data.guardianName,
        phone: data.guardianPhone || null,
        email: data.guardianEmail || null,
        relationship: data.guardianRelationship || null,
        is_primary: true,
      });
      if (gErr) throw gErr;
    }

    // Auto-generate invoices from active fee structures for this class
    const invoices: Array<{ label: string; amount_fcfa: number; due_date: string | null; fee_structure_id: string }> = [];
    if (data.className && student) {
      const { data: structures } = await supabase
        .from("fee_structures")
        .select("id, label, amount_fcfa, academic_year, installments, due_date, kind")
        .eq("school_id", schoolId)
        .eq("class_name", data.className);
      const rows: Array<{
        school_id: string; student_id: string; fee_structure_id: string;
        label: string; amount_fcfa: number; academic_year: string | null; due_date: string | null;
      }> = [];
      for (const fs of structures ?? []) {
        const insts = Array.isArray(fs.installments) ? (fs.installments as Array<{ label?: string; amount_fcfa?: number; due_date?: string | null }>) : [];
        if (insts.length > 0) {
          for (const it of insts) {
            rows.push({
              school_id: schoolId, student_id: student.id, fee_structure_id: fs.id,
              label: `${fs.label} — ${it.label ?? "Installment"}`,
              amount_fcfa: Number(it.amount_fcfa ?? 0),
              academic_year: fs.academic_year, due_date: it.due_date ?? null,
            });
          }
        } else {
          rows.push({
            school_id: schoolId, student_id: student.id, fee_structure_id: fs.id,
            label: fs.label, amount_fcfa: fs.amount_fcfa,
            academic_year: fs.academic_year, due_date: fs.due_date,
          });
        }
      }
      if (rows.length > 0) {
        await supabase.from("student_fees").insert(rows);
        invoices.push(...rows.map((r) => ({ label: r.label, amount_fcfa: r.amount_fcfa, due_date: r.due_date, fee_structure_id: r.fee_structure_id })));
      }
    }

    return { id: student!.id, invoices };
  });
