import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { tenantDb, getTenantOrgId } from "@waypoint/db";
import type { Actor, CreateIncidentInput } from "@waypoint/shared-types";

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

  async create(actor: Actor, input: CreateIncidentInput) {
    const service = await tenantDb().service.findFirst({
      where: { id: input.serviceId },
    });
    if (!service) throw new NotFoundException("Service not found");

    const orgId = getTenantOrgId();
    const incident = await tenantDb().incident.create({
      data: {
        orgId,
        serviceId: input.serviceId,
        title: input.title,
        severity: input.severity,
        status: "triggered",
      },
    });

    await tenantDb().incidentEvent.create({
      data: {
        orgId,
        incidentId: incident.id,
        type: "triggered",
        actorId: actor.userId,
        payload: { title: input.title, severity: input.severity },
      },
    });

    return this.get(incident.id);
  }

  async acknowledge(actor: Actor, id: string) {
    const incident = await this.get(id);
    if (incident.status === "resolved") {
      throw new ConflictException("Resolved incidents cannot be acknowledged");
    }
    if (incident.status === "acknowledged") {
      throw new ConflictException("Incident is already acknowledged");
    }

    await tenantDb().incident.update({
      where: { id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedById: actor.userId,
      },
    });

    await tenantDb().incidentEvent.create({
      data: {
        orgId: getTenantOrgId(),
        incidentId: id,
        type: "acknowledged",
        actorId: actor.userId,
        payload: { previousStatus: incident.status },
      },
    });

    return this.get(id);
  }

  async resolve(actor: Actor, id: string) {
    const incident = await this.get(id);
    if (incident.status === "resolved") {
      throw new ConflictException("Incident is already resolved");
    }

    await tenantDb().incident.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        ...(incident.status === "triggered" && actor.userId
          ? { acknowledgedAt: new Date(), acknowledgedById: actor.userId }
          : {}),
      },
    });

    await tenantDb().incidentEvent.create({
      data: {
        orgId: getTenantOrgId(),
        incidentId: id,
        type: "resolved",
        actorId: actor.userId,
        payload: { previousStatus: incident.status },
      },
    });

    return this.get(id);
  }
}
