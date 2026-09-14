import { Header, Controller, MessageEvent, Sse } from "@nestjs/common";
import { Observable } from "rxjs";
import { subscribeOrgRealtime } from "@waypoint/jobs";
import type { Actor } from "@waypoint/shared-types";
import { CurrentActor } from "../../common/current-actor.decorator";
import { RequirePermission } from "../rbac/require-permission.decorator";

/**
 * Authenticated, org-scoped incident stream. orgId always comes from the
 * actor — query params cannot retarget the subscription.
 */
@Controller("realtime")
export class RealtimeController {
  @Sse("incidents")
  @RequirePermission("incident:read")
  @Header("Cache-Control", "no-cache, no-transform")
  @Header("X-Accel-Buffering", "no")
  incidents(@CurrentActor() actor: Actor): Observable<MessageEvent> {
    const orgId = actor.orgId;
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({
        type: "connected",
        data: { type: "connected", orgId },
      });
      const unsubscribe = subscribeOrgRealtime(orgId, (event) => {
        subscriber.next({ type: event.type, data: event });
      });
      return unsubscribe;
    });
  }
}
