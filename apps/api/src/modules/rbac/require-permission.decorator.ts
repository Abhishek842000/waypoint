import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@waypoint/shared-types";

export const PERMISSION_KEY = "requiredPermission";
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
