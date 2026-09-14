import { z } from "zod";

export const roles = ["admin", "responder", "viewer"] as const;
export const RoleSchema = z.enum(roles);
export type Role = z.infer<typeof RoleSchema>;

export const permissions = [
  "org:read",
  "org:update",
  "membership:invite",
  "membership:update",
  "membership:read",
  "service:read",
  "service:create",
  "service:update",
  "service:delete",
  "rotation:read",
  "rotation:create",
  "rotation:update",
  "rotation:delete",
  "escalation_policy:read",
  "escalation_policy:create",
  "escalation_policy:update",
  "escalation_policy:delete",
  "incident:read",
  "incident:create",
  "incident:acknowledge",
  "incident:resolve",
  "incident:comment",
  "api_key:read",
  "api_key:create",
  "api_key:revoke",
] as const;

export const PermissionSchema = z.enum(permissions);
export type Permission = z.infer<typeof PermissionSchema>;

export const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: permissions,
  responder: [
    "org:read",
    "membership:read",
    "service:read",
    "rotation:read",
    "escalation_policy:read",
    "incident:read",
    "incident:create",
    "incident:acknowledge",
    "incident:resolve",
    "incident:comment",
  ],
  viewer: [
    "org:read",
    "membership:read",
    "service:read",
    "rotation:read",
    "escalation_policy:read",
    "incident:read",
  ],
};

export function permissionsForRole(role: Role): Permission[] {
  return [...rolePermissions[role]];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
