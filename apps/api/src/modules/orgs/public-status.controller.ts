import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { runWithTenant, tenantDb, unscopedDb } from "@waypoint/db";
import { Public } from "../../common/public.decorator";

/**
 * Unauthenticated status payload. Still goes through tenantDb() after
 * resolving the org slug — public does not mean unscoped.
 */
@Controller("public")
export class PublicStatusController {
  @Public()
  @Get("status/:orgSlug")
  async bySlug(@Param("orgSlug") orgSlug: string) {
    const org = await unscopedDb().org.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new NotFoundException("Status page not found");

    return runWithTenant(org.id, async () => {
      const services = await tenantDb().service.findMany({
        orderBy: { name: "asc" },
      });
      const openIncidents = await tenantDb().incident.findMany({
        where: { status: { not: "resolved" } },
        orderBy: { createdAt: "desc" },
      });
      return {
        org: { name: org.name, slug: org.slug },
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          currentStatus: s.currentStatus,
        })),
        incidents: openIncidents.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          severity: i.severity,
          createdAt: i.createdAt,
        })),
      };
    });
  }
}
