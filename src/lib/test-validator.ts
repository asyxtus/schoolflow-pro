import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ id: z.string().uuid() });

export const testFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => schema.parse(data))
  .handler(async ({ data, context }) => {
    return data.id + context.userId;
  });

const result = testFn({ id: "123e4567-e89b-12d3-a456-426614174000" });
