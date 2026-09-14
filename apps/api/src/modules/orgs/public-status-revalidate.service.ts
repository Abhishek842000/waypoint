import { Injectable, Logger } from "@nestjs/common";
import { unscopedDb } from "@waypoint/db";

/**
 * Best-effort on-demand revalidation of Next.js /status/[orgSlug].
 * Incident writes must not fail if the web app is down.
 */
@Injectable()
export class PublicStatusRevalidateService {
  private readonly log = new Logger(PublicStatusRevalidateService.name);

  async bump(orgId: string): Promise<void> {
    const secret = process.env.STATUS_REVALIDATE_SECRET;
    const webOrigin = process.env.WEB_ORIGIN;
    if (!secret || !webOrigin) return;

    const org = await unscopedDb().org.findUnique({
      where: { id: orgId },
      select: { slug: true },
    });
    if (!org) return;

    try {
      const res = await fetch(`${webOrigin}/api/revalidate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-revalidate-secret": secret,
        },
        body: JSON.stringify({ orgSlug: org.slug }),
      });
      if (!res.ok) {
        this.log.warn(`revalidate ${org.slug} returned ${res.status}`);
      }
    } catch (err) {
      this.log.warn(`revalidate ${org.slug} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
