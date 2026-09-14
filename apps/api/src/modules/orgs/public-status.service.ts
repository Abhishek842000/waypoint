import { Injectable, NotFoundException } from "@nestjs/common";
import { runWithTenant, tenantDb, unscopedDb } from "@waypoint/db";
import { toPublicStatusPayload } from "@waypoint/shared-types";

const RECENT_INCIDENT_LIMIT = 20;

/**
 * Unauthenticated status payload. Still goes through tenantDb() after
 * resolving the org slug — public does not mean unscoped.
 */
@Injectable()
export class PublicStatusService {
  async bySlug(orgSlug: string) {
    const org = await unscopedDb().org.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException("Status page not found");

    return runWithTenant(org.id, async () => {
      const services = await tenantDb().service.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, currentStatus: true },
      });
      const incidents = await tenantDb().incident.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_INCIDENT_LIMIT,
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
          resolvedAt: true,
        },
      });
      return toPublicStatusPayload({
        org: { name: org.name, slug: org.slug },
        services,
        incidents,
      });
    });
  }
}
