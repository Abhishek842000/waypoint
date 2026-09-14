import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Actor } from "@waypoint/shared-types";
import {
  consumeIncidentCreateLimit,
  incidentCreateRateLimit,
} from "./incident-create-rate-limit";

/**
 * Only API-key callers of POST /v1/incidents are throttled. Session users
 * still go through @RequirePermission + tenantDb(); this guard never
 * bypasses either.
 */
@Injectable()
export class ApiKeyIncidentCreateThrottleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ actor?: Actor }>();
    const actor = req.actor;
    if (!actor || actor.authMethod !== "api_key") {
      return true;
    }

    const result = consumeIncidentCreateLimit(actor.orgId);
    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    res.setHeader("X-RateLimit-Limit", String(incidentCreateRateLimit()));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    if (result.ok) return true;

    res.setHeader("Retry-After", String(result.retryAfterSec));
    throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
  }
}
