import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export type VehicleStatus = "active" | "maintenance" | "retired";
export type SubStatus = "active" | "paused" | "ended";
export type IncidentKind = "incident" | "maintenance";

// ── Vehicles ────────────────────────────────────────────────────────────
export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data, error } = await context.supabase
      .from("transport_vehicles")
      .select("*")
      .eq("school_id", schoolId)
      .order("plate_no");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      plate_no: string;
      model?: string;
      capacity: number;
      driver_name?: string;
      driver_phone?: string;
      status: VehicleStatus;
      notes?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      plate_no: data.plate_no,
      model: data.model ?? null,
      capacity: data.capacity,
      driver_name: data.driver_name ?? null,
      driver_phone: data.driver_phone ?? null,
      status: data.status,
      notes: data.notes ?? null,
    };
    const { error } = data.id
      ? await context.supabase.from("transport_vehicles").update(row).eq("id", data.id)
      : await context.supabase.from("transport_vehicles").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("transport_vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Routes ──────────────────────────────────────────────────────────────
export const listRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data, error } = await context.supabase
      .from("transport_routes")
      .select("*, transport_vehicles(plate_no, model)")
      .eq("school_id", schoolId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      code?: string;
      vehicle_id?: string | null;
      stops?: { name: string; time_am?: string; time_pm?: string }[];
      monthly_fee_fcfa: number;
      active: boolean;
      notes?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      name: data.name,
      code: data.code ?? null,
      vehicle_id: data.vehicle_id ?? null,
      stops: data.stops ?? [],
      monthly_fee_fcfa: data.monthly_fee_fcfa,
      active: data.active,
      notes: data.notes ?? null,
    };
    const { error } = data.id
      ? await context.supabase.from("transport_routes").update(row).eq("id", data.id)
      : await context.supabase.from("transport_routes").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("transport_routes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Subscriptions ───────────────────────────────────────────────────────
export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { routeId?: string }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    let q = context.supabase
      .from("transport_subscriptions")
      .select("*, students(first_name,last_name,matricule,class_name), transport_routes(name)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (data.routeId) q = q.eq("route_id", data.routeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const s = (r as { students?: { first_name?: string; last_name?: string } }).students;
      return { ...r, full_name: s ? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() : "" };
    });
  });

export const searchTransportStudents = createServerFn({ method: "GET" })
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

export const upsertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      student_id: string;
      route_id: string;
      stop_name?: string;
      start_date?: string;
      end_date?: string;
      status: SubStatus;
      monthly_fee_fcfa: number;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      student_id: data.student_id,
      route_id: data.route_id,
      stop_name: data.stop_name ?? null,
      start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: data.end_date ?? null,
      status: data.status,
      monthly_fee_fcfa: data.monthly_fee_fcfa,
    };
    const { error } = data.id
      ? await context.supabase.from("transport_subscriptions").update(row).eq("id", data.id)
      : await context.supabase.from("transport_subscriptions").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("transport_subscriptions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Boarding Log ────────────────────────────────────────────────────────
export const listBoardingLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { routeId?: string; date?: string; direction?: "am" | "pm" }) => d)
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    let q = context.supabase
      .from("transport_boarding_log")
      .select("*, students(first_name,last_name,matricule,class_name), transport_routes(name)")
      .eq("school_id", schoolId)
      .order("log_date", { ascending: false })
      .limit(500);
    if (data.routeId) q = q.eq("route_id", data.routeId);
    if (data.date) q = q.eq("log_date", data.date);
    if (data.direction) q = q.eq("direction", data.direction);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const s = (r as { students?: { first_name?: string; last_name?: string } }).students;
      return { ...r, full_name: s ? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() : "" };
    });
  });

export const recordBoarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      route_id: string;
      student_id: string;
      log_date?: string;
      direction: "am" | "pm";
      boarded: boolean;
      note?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const { error } = await context.supabase.from("transport_boarding_log").insert({
      school_id: schoolId,
      route_id: data.route_id,
      student_id: data.student_id,
      log_date: data.log_date ?? new Date().toISOString().slice(0, 10),
      direction: data.direction,
      boarded: data.boarded,
      note: data.note ?? null,
      recorded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Incidents ───────────────────────────────────────────────────────────
export const listIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) return [];
    const { data, error } = await context.supabase
      .from("transport_incidents")
      .select("*, transport_vehicles(plate_no), transport_routes(name)")
      .eq("school_id", schoolId)
      .order("incident_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      vehicle_id?: string | null;
      route_id?: string | null;
      incident_date?: string;
      kind: IncidentKind;
      severity?: string;
      cost_fcfa: number;
      description: string;
      resolved: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId) throw new Error("No school");
    const row = {
      school_id: schoolId,
      vehicle_id: data.vehicle_id ?? null,
      route_id: data.route_id ?? null,
      incident_date: data.incident_date ?? new Date().toISOString().slice(0, 10),
      kind: data.kind,
      severity: data.severity ?? null,
      cost_fcfa: data.cost_fcfa,
      description: data.description,
      resolved: data.resolved,
    };
    const { error } = data.id
      ? await context.supabase.from("transport_incidents").update(row).eq("id", data.id)
      : await context.supabase.from("transport_incidents").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("transport_incidents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transportSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const schoolId = await getUserSchoolId(context.supabase, context.userId);
    if (!schoolId)
      return { vehicles: 0, routes: 0, subscribers: 0, monthlyRevenue: 0, openIncidents: 0 };
    const [v, r, s, i] = await Promise.all([
      context.supabase
        .from("transport_vehicles")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      context.supabase
        .from("transport_routes")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("active", true),
      context.supabase
        .from("transport_subscriptions")
        .select("monthly_fee_fcfa")
        .eq("school_id", schoolId)
        .eq("status", "active"),
      context.supabase
        .from("transport_incidents")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("resolved", false),
    ]);
    const monthlyRevenue = (s.data ?? []).reduce((a, r) => a + (r.monthly_fee_fcfa ?? 0), 0);
    return {
      vehicles: v.count ?? 0,
      routes: r.count ?? 0,
      subscribers: s.data?.length ?? 0,
      monthlyRevenue,
      openIncidents: i.count ?? 0,
    };
  });
