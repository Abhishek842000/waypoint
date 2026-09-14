import { z } from "zod";
import { RoleSchema, PermissionSchema } from "./rbac";
import {
  EscalationTargetTypeSchema,
  IncidentSeveritySchema,
  ServiceStatusSchema,
} from "./domain";

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

export const createRotationSchema = z.object({
  name: z.string().min(1).max(120),
  memberUserIds: z.array(z.string().min(1)).min(1).max(50),
  handoffIntervalDays: z.number().int().min(1).max(365).default(7),
});
export type CreateRotationInput = z.infer<typeof createRotationSchema>;

export const updateRotationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  memberUserIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  handoffIntervalDays: z.number().int().min(1).max(365).optional(),
  currentPointer: z.number().int().min(0).optional(),
});
export type UpdateRotationInput = z.infer<typeof updateRotationSchema>;

export const escalationStepInputSchema = z
  .object({
    waitMinutes: z.number().int().min(0).max(24 * 60),
    targetType: EscalationTargetTypeSchema,
    targetRotationId: z.string().min(1).nullable().optional(),
    targetUserId: z.string().min(1).nullable().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.targetType === "user" && !step.targetUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "user target requires targetUserId",
        path: ["targetUserId"],
      });
    }
    if (step.targetType === "rotation" && !step.targetRotationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rotation target requires targetRotationId",
        path: ["targetRotationId"],
      });
    }
  });
export type EscalationStepInput = z.infer<typeof escalationStepInputSchema>;

export const createEscalationPolicySchema = z.object({
  name: z.string().min(1).max(120),
  steps: z.array(escalationStepInputSchema).min(1).max(20),
});
export type CreateEscalationPolicyInput = z.infer<typeof createEscalationPolicySchema>;

export const updateEscalationPolicySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  steps: z.array(escalationStepInputSchema).min(1).max(20).optional(),
});
export type UpdateEscalationPolicyInput = z.infer<typeof updateEscalationPolicySchema>;
