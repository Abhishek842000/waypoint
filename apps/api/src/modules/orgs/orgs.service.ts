import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { tenantDb, unscopedDb, getTenantOrgId } from "@waypoint/db";
import type { Actor, InviteMemberInput } from "@waypoint/shared-types";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class OrgsService {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async current(actor: Actor) {
    const org = await unscopedDb().org.findUnique({ where: { id: actor.orgId } });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async listMembers() {
    const memberships = await tenantDb().membership.findMany({
      orderBy: { createdAt: "asc" },
    });
    const users = await unscopedDb().user.findMany({
      where: { id: { in: memberships.map((m) => m.userId) } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      user: {
        id: m.userId,
        email: byId.get(m.userId)?.email,
        name: byId.get(m.userId)?.name,
      },
    }));
  }

  async invite(input: InviteMemberInput) {
    const email = input.email.toLowerCase();
    let user = await unscopedDb().user.findUnique({ where: { email } });
    if (!user) {
      user = await unscopedDb().user.create({
        data: {
          email,
          name: input.name,
          passwordHash: await this.auth.hashPassword(input.password),
        },
      });
    }

    try {
      const membership = await tenantDb().membership.create({
        data: { orgId: getTenantOrgId(), userId: user.id, role: input.role },
      });
      return {
        id: membership.id,
        role: membership.role,
        user: { id: user.id, email: user.email, name: user.name },
      };
    } catch {
      throw new ConflictException("User is already a member of this organization");
    }
  }
}
