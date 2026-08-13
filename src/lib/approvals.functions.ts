import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type ApprovalRequestType =
  "expense" | "fee_structure_change" | "discount" | "budget" | "staffing" | "other";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export const listMyApprovalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: ApprovalStatus } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("approval_requests")
      .select(
        "id, request_type, title, description, amount_fcfa, status, reviewed_at, review_note, created_at",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const submitApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      requestType: ApprovalRequestType;
      title: string;
      description?: string;
      amountFcfa?: number;
      payload?: Record<string, unknown>;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.title.trim()) throw new Error("Title is required");
    const { error } = await supabase.from("approval_requests").insert({
      school_id: schoolId,
      request_type: data.requestType,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      amount_fcfa: data.amountFcfa ?? null,
      payload: (data.payload ?? null) as unknown as never,
      requested_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const withdrawApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("approval_requests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Diocese-side: every pending (and recently-reviewed) request across every
// school in the diocese, for the review queue.
export const listDioceseApprovalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dioceseId: string; status?: ApprovalStatus }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("approval_requests")
      .select(
        "id, request_type, title, description, amount_fcfa, status, created_at, school_id, schools(name)",
      )
      .order("created_at", { ascending: false });
    q = data.status ? q.eq("status", data.status) : q.eq("status", "pending");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // RLS already scopes this to schools in the caller's diocese; filter
    // defensively in case a school with a different diocese slips through
    // a future policy change.
    const schoolsRes = await supabase.from("schools").select("id").eq("diocese_id", data.dioceseId);
    const allowed = new Set((schoolsRes.data ?? []).map((s) => s.id));
    return (rows ?? []).filter((r) => allowed.has(r.school_id));
  });

export const reviewApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approved" | "rejected"; note?: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing, error: fErr } = await supabase
      .from("approval_requests")
      .select("id, school_id, request_type, payload, status")
      .eq("id", data.id)
      .single();
    if (fErr) throw new Error(fErr.message);
    if (existing.status !== "pending") throw new Error("This request has already been reviewed");

    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: data.decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.note?.trim() || null,
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    // Apply the change now that the approval is committed — the
    // fee_structures trigger requires this exact approved row to already
    // exist, so this must happen as a separate call after the update above,
    // not combined into one transaction.
    if (data.decision === "approved" && existing.request_type === "fee_structure_change") {
      const payload = existing.payload as {
        class_name?: string;
        label?: string;
        kind?: string;
        academic_year?: string | null;
        new_amount_fcfa?: number;
        fee_structure_id?: string | null;
      } | null;
      if (payload?.class_name && payload.label && payload.new_amount_fcfa != null) {
        const { error: applyErr } = await supabase.from("fee_structures").upsert(
          {
            id: payload.fee_structure_id ?? undefined,
            school_id: existing.school_id,
            class_name: payload.class_name,
            label: payload.label,
            kind: (payload.kind ?? "tuition") as "tuition",
            academic_year: payload.academic_year ?? null,
            amount_fcfa: payload.new_amount_fcfa,
          },
          { onConflict: "id" },
        );
        if (applyErr) {
          throw new Error(
            `Approved, but applying the change failed: ${applyErr.message}. The tuition amount was not changed — try again or apply it manually in Classes → Manage.`,
          );
        }
      }
    }

    return { ok: true };
  });
