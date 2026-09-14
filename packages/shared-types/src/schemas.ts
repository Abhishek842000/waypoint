import { z } from "zod";
import { RoleSchema, PermissionSchema } from "./rbac";
import { IncidentSeveritySchema, ServiceStatusSchema } from "./domain";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80),
  orgName: z.string().min(1).max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8),
  role: RoleSchema,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const createServiceSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  currentStatus: ServiceStatusSchema.optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const createIncidentSchema = z.object({
  serviceId: z.string().min(1),
  title: z.string().min(1).max(200),
  severity: IncidentSeveritySchema.default("high"),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(PermissionSchema).min(1),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
