import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const listVisitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { activeOnly?: boolean } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("visitor_log")
      .select("id, visitor_name, visitor_phone, purpose, host_name, check_in_at, check_out_at")
      .eq("school_id", schoolId)
      .order("check_in_at", { ascending: false });
    if (data.activeOnly) q = q.is("check_out_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const checkInVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { visitorName: string; visitorPhone?: string; purpose?: string; hostName?: string }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.visitorName.trim()) throw new Error("Visitor name is required");
    const { error } = await supabase.from("visitor_log").insert({
      school_id: schoolId,
      visitor_name: data.visitorName.trim(),
      visitor_phone: data.visitorPhone?.trim() || null,
      purpose: data.purpose?.trim() || null,
      host_name: data.hostName?.trim() || null,
      recorded_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkOutVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("visitor_log")
      .update({ check_out_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVisitorEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("visitor_log").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pendingOnly?: boolean } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) return [];
    let q = supabase
      .from("message_log")
      .select("id, for_staff_name, caller_name, caller_phone, message, delivered, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (data.pendingOnly) q = q.eq("delivered", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const logMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { forStaffName: string; callerName: string; callerPhone?: string; message: string }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    if (!data.forStaffName.trim() || !data.callerName.trim() || !data.message.trim()) {
      throw new Error("Who it's for, the caller's name, and the message are all required");
    }
    const { error } = await supabase.from("message_log").insert({
      school_id: schoolId,
      for_staff_name: data.forStaffName.trim(),
      caller_name: data.callerName.trim(),
      caller_phone: data.callerPhone?.trim() || null,
      message: data.message.trim(),
      recorded_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markMessageDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("message_log")
      .update({ delivered: true, delivered_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("message_log").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
