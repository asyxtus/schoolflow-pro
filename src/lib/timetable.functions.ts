import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";

export const getTimetable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { className: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { data: slots, error } = await supabase
      .from("timetable_slots")
      .select("id, day_of_week, period, subject, teacher, room")
      .eq("school_id", schoolId)
      .eq("class_name", data.className)
      .order("day_of_week")
      .order("period");
    if (error) throw new Error(error.message);
    return slots ?? [];
  });

export const upsertTimetableSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      className: string;
      day_of_week: number;
      period: number;
      subject: string;
      teacher?: string;
      room?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");
    const { error } = await supabase.from("timetable_slots").upsert(
      {
        school_id: schoolId,
        class_name: data.className,
        day_of_week: data.day_of_week,
        period: data.period,
        subject: data.subject,
        teacher: data.teacher ?? null,
        room: data.room ?? null,
      },
      { onConflict: "school_id,class_name,day_of_week,period" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTimetableSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("timetable_slots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });