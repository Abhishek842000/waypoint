import { z } from "zod";
import { RoleSchema, PermissionSchema } from "./rbac";

export const authMethods = ["session", "api_key"] as const;
export const AuthMethodSchema = z.enum(authMethods);
export type AuthMethod = z.infer<typeof AuthMethodSchema>;

/**
 * Unified authenticated principal. Session auth and API-key auth both
 * resolve to this so downstream services never branch on auth method.
 */
export const actorSchema = z.object({
  authMethod: AuthMethodSchema,
  userId: z.string().nullable(),
  orgId: z.string(),
  role: RoleSchema.nullable(),
  scopes: z.array(PermissionSchema),
});
export type Actor = z.infer<typeof actorSchema>;
