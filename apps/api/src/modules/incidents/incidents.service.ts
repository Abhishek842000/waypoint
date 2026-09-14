import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { tenantDb, getTenantOrgId } from "@waypoint/db";
import {
  cancelIncidentEscalation,
  onIncidentOpened,
  recordIncidentEvent,
} from "@waypoint/jobs";
import {
  IllegalIncidentTransitionError,
  assertIncidentTransition,
  type Actor,
  type CreateIncidentInput,
  type IncidentStatus,
} from "@waypoint/shared-types";

@Injectable()
export class IncidentsService {
  list() {
    return tenantDb().incident.findMany({
      orderBy: { createdAt: "desc" },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
  }

  async get(id: string) {
    const incident = await tenantDb().incident.findFirst({
      where: { id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    if (!incident) throw new NotFoundException("Incident not found");
    return incident;
  }

  /** Same ordered log the UI timeline and the audit API both read. */
  async timeline(id: string) {
    const incident = await this.get(id);
    return incident.events;
  }

  async create(actor: Actor, input: CreateIncidentInput) {
    const service = await tenantDb().service.findFirst({
      where: { id: input.serviceId },
    });
    if (!service) throw new NotFoundException("Service not found");

    const escalationPolicyId = await this.resolvePolicyId(
      input.escalationPolicyId ?? service.escalationPolicyId,
    );

    const orgId = getTenantOrgId();
    const incident = await tenantDb().incident.create({
      data: {
        orgId,
        serviceId: input.serviceId,
        title: input.title,
        severity: input.severity,
        status: "triggered",
        escalationPolicyId,
        currentEscalationStep: 0,
      },
    });

    await onIncidentOpened({
      incidentId: incident.id,
      title: input.title,
      severity: input.severity,
      escalationPolicyId,
      actorId: actor.userId,
    });

    return this.get(incident.id);
  }

  acknowledge(actor: Actor, id: string) {
    return this.transition(actor, id, "acknowledged");
  }

  resolve(actor: Actor, id: string) {
    return this.transition(actor, id, "resolved");
  }

  /**
   * Single write path for ack/resolve so the worker and HTTP layer cannot
   * drift: guard the edge, persist status, append IncidentEvent, cancel jobs.
   */
  private async transition(actor: Actor, id: string, to: Exclude<IncidentStatus, "triggered">) {
    const incident = await this.get(id);
    try {
      assertIncidentTransition(incident.status, to);
    } catch (err) {
      if (err instanceof IllegalIncidentTransitionError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }

    const now = new Date();
    await tenantDb().incident.update({
      where: { id },
      data:
        to === "acknowledged"
          ? {
              status: "acknowledged",
              acknowledgedAt: now,
              acknowledgedById: actor.userId,
            }
          : {
              status: "resolved",
              resolvedAt: now,
              ...(incident.status === "triggered" && actor.userId
                ? { acknowledgedAt: now, acknowledgedById: actor.userId }
                : {}),
            },
    });

    await recordIncidentEvent({
      incidentId: id,
      type: to,
      actorId: actor.userId,
      payload: { previousStatus: incident.status },
    });

    await cancelIncidentEscalation(id);
    return this.get(id);
  }

  private async resolvePolicyId(policyId: string | null): Promise<string | null> {
    if (!policyId) return null;
    const policy = await tenantDb().escalationPolicy.findFirst({
      where: { id: policyId },
    });
    if (!policy) throw new NotFoundException("Escalation policy not found");
    return policy.id;
  }
}
