import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ id: z.string().uuid() });

const testMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  return next({ context: { foo: "bar" } });
});

export const testFn = createServerFn({ method: "GET" })
  .middleware([testMiddleware])
  .inputValidator((data: { id: string }) => schema.parse(data))
  .handler(async ({ data, context }) => {
    return data.id + context.foo;
  });

const result = testFn({ data: { id: "123e4567-e89b-12d3-a456-426614174000" } });
