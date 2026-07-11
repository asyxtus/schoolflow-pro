import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ id: z.string().uuid() });

export const testFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => schema.parse(data))
  .handler(async ({ data }) => {
    return data.id;
  });

const result = testFn({ data: { id: "123e4567-e89b-12d3-a456-426614174000" } });
