import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

function randomToken(len = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export const getOrCreatePortalToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string; rotate?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    const existing = await supabase
      .from("student_portal_tokens")
      .select("*")
      .eq("student_id", data.studentId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    if (existing.data && !data.rotate)
      return { token: existing.data.token, active: existing.data.active };

    const token = randomToken();
    if (existing.data) {
      const { error } = await supabase
        .from("student_portal_tokens")
        .update({ token, active: true, created_by: userId })
        .eq("id", existing.data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("student_portal_tokens").insert({
        school_id: schoolId,
        student_id: data.studentId,
        token,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    }
    return { token, active: true };
  });

export const setPortalTokenActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { studentId: string; active: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("student_portal_tokens")
      .update({ active: data.active })
      .eq("student_id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * PUBLIC read used by the parent portal. The token itself is the credential:
 * we look it up server-side with the service-role client (bypasses RLS) and
 * only return safe data for that specific student.
 */
export const getPortalBundle = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tok = await supabaseAdmin
      .from("student_portal_tokens")
      .select("id, student_id, school_id, active")
      .eq("token", data.token)
      .maybeSingle();
    if (tok.error) throw new Error(tok.error.message);
    if (!tok.data || !tok.data.active) return { ok: false as const };

    const { student_id, school_id, id } = tok.data;

    await supabaseAdmin
      .from("student_portal_tokens")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", id);

    const [studentQ, schoolQ, feesQ, paymentsQ, attendanceQ, gradesQ, messagesQ] =
      await Promise.all([
        supabaseAdmin
          .from("students")
          .select(
            "id, first_name, last_name, matricule, class_name, fee_balance, wallet_balance, photo_url",
          )
          .eq("id", student_id)
          .single(),
        supabaseAdmin
          .from("schools")
          .select("name, city, region, code")
          .eq("id", school_id)
          .single(),
        supabaseAdmin
          .from("student_fee_status")
          .select(
            "id, label, amount_fcfa, discount_fcfa, net_fcfa, paid_fcfa, balance_fcfa, status, due_date",
          )
          .eq("student_id", student_id)
          .order("due_date", { ascending: true }),
        supabaseAdmin
          .from("payments")
          .select("id, amount_fcfa, method, paid_at, receipt_no, reference")
          .eq("student_id", student_id)
          .eq("voided", false)
          .order("paid_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("attendance")
          .select("date, status, subject")
          .eq("student_id", student_id)
          .order("date", { ascending: false })
          .limit(60),
        supabaseAdmin
          .from("grades")
          .select("subject, sequence, ca_score, exam_score")
          .eq("student_id", student_id)
          .order("sequence", { ascending: true }),
        supabaseAdmin
          .from("messages")
          .select("id, subject, body, created_at, audience")
          .eq("school_id", school_id)
          .in("audience", ["guardians", "all"])
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    return {
      ok: true as const,
      student: studentQ.data,
      school: schoolQ.data,
      fees: feesQ.data ?? [],
      payments: paymentsQ.data ?? [],
      attendance: attendanceQ.data ?? [],
      grades: gradesQ.data ?? [],
      messages: messagesQ.data ?? [],
    };
  });
