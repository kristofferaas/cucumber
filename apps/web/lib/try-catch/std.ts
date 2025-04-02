import { z } from "zod";
import { err, ok } from ".";

export function parse<T>(schema: z.ZodSchema<T>, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? ok(result.data) : err(result.error);
}
