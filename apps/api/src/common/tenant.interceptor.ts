import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { runWithTenant } from "@waypoint/db";
import { Observable, lastValueFrom, from } from "rxjs";
import type { Actor } from "@waypoint/shared-types";

/**
 * After AuthGuard attaches request.actor, wrap the rest of the request
 * in AsyncLocalStorage tenant context so tenantDb() cannot run unscoped.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ actor?: Actor }>();
    const orgId = req.actor?.orgId;
    if (!orgId) {
      return next.handle();
    }
    return from(runWithTenant(orgId, () => lastValueFrom(next.handle())));
  }
}
