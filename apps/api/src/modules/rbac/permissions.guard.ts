import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Actor, Permission } from "@waypoint/shared-types";
import { PERMISSION_KEY } from "./require-permission.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ actor?: Actor }>();
    const actor = req.actor;
    if (!actor) {
      throw new ForbiddenException("Not authenticated");
    }
    if (!actor.scopes.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
