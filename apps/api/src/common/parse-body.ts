import type { Request } from "express";
import { ZodSchema } from "zod";

export function parseBody<T>(schema: ZodSchema<T>, req: Request): T {
  return schema.parse(req.body);
}
