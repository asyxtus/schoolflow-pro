import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({ id: z.string().uuid() });

const testMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const supabase = createClient<Database>("http://example.com", "key");
  return next({
    context: {
      supabase,
      userId: "user-id",
      claims: { sub: "user-id" } as any,
    },
  });
});

export const testFn = createServerFn({ method: "GET" })
  .middleware([testMiddleware])
  .inputValidator((data: { id: string }) => schema.parse(data))
  .handler(async ({ data, context }) => {
    return data.id + context.userId;
  });

const result = testFn({ data: { id: "123e4567-e89b-12d3-a456-426614174000" } });
