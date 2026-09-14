import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Actor } from "@waypoint/shared-types";

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest<{ actor: Actor }>();
    return req.actor;
  },
);
