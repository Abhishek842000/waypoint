import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getTenantOrgId, tenantDb, unscopedDb } from "@waypoint/db";
import {
  currentlyOnCall,
  type CreateRotationInput,
  type UpdateRotationInput,
} from "@waypoint/shared-types";

@Injectable()
export class RotationsService {
  async list() {
    const rotations = await tenantDb().rotation.findMany({
      include: { members: { orderBy: { position: "asc" } } },
      orderBy: { name: "asc" },
    });
    return Promise.all(rotations.map((r) => this.hydrate(r)));
  }

  async get(id: string) {
    const rotation = await tenantDb().rotation.findFirst({
      where: { id },
      include: { members: { orderBy: { position: "asc" } } },
    });
    if (!rotation) throw new NotFoundException("Rotation not found");
    return this.hydrate(rotation);
  }

  async create(input: CreateRotationInput) {
    const memberUserIds = uniqueIds(input.memberUserIds);
    await this.assertOrgMembers(memberUserIds);

    try {
      const rotation = await tenantDb().rotation.create({
        data: {
          orgId: getTenantOrgId(),
          name: input.name,
          currentPointer: 0,
          handoffIntervalDays: input.handoffIntervalDays,
          lastHandoffAt: new Date(),
          members: {
            create: memberUserIds.map((userId, position) => ({
              orgId: getTenantOrgId(),
              userId,
              position,
            })),
          },
        },
        include: { members: { orderBy: { position: "asc" } } },
      });
      return this.hydrate(rotation);
    } catch {
      throw new ConflictException("A rotation with that name already exists");
    }
  }

  async update(id: string, input: UpdateRotationInput) {
    const existing = await tenantDb().rotation.findFirst({
      where: { id },
      include: { members: true },
    });
    if (!existing) throw new NotFoundException("Rotation not found");

    const memberUserIds = input.memberUserIds
      ? uniqueIds(input.memberUserIds)
      : existing.members.sort((a, b) => a.position - b.position).map((m) => m.userId);

    if (input.memberUserIds) {
      await this.assertOrgMembers(memberUserIds);
    }

    const memberCount = memberUserIds.length;
    let currentPointer = input.currentPointer ?? existing.currentPointer;
    if (memberCount === 0) currentPointer = 0;
    else currentPointer = currentPointer % memberCount;

    await tenantDb().rotationMember.deleteMany({ where: { rotationId: id } });

    const rotation = await tenantDb().rotation.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.handoffIntervalDays !== undefined
          ? { handoffIntervalDays: input.handoffIntervalDays }
          : {}),
        currentPointer,
        members: {
          create: memberUserIds.map((userId, position) => ({
            orgId: getTenantOrgId(),
            userId,
            position,
          })),
        },
      },
      include: { members: { orderBy: { position: "asc" } } },
    });
    return this.hydrate(rotation);
  }

  async remove(id: string) {
    await this.get(id);
    await tenantDb().rotation.delete({ where: { id } });
    return { ok: true };
  }

  private async assertOrgMembers(userIds: string[]) {
    const memberships = await tenantDb().membership.findMany({
      where: { userId: { in: userIds } },
    });
    const found = new Set(memberships.map((m) => m.userId));
    const missing = userIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new BadRequestException("Every rotation member must belong to this organization");
    }
  }

  private async hydrate(rotation: {
    id: string;
    orgId: string;
    name: string;
    currentPointer: number;
    handoffIntervalDays: number;
    lastHandoffAt: Date;
    createdAt: Date;
    updatedAt: Date;
    members: Array<{ id: string; userId: string; position: number }>;
  }) {
    const users = await unscopedDb().user.findMany({
      where: { id: { in: rotation.members.map((m) => m.userId) } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const members = rotation.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      position: m.position,
      user: {
        id: m.userId,
        name: byId.get(m.userId)?.name,
        email: byId.get(m.userId)?.email,
      },
    }));
    const onCall = currentlyOnCall(members, rotation.currentPointer);
    return {
      ...rotation,
      members,
      currentlyOnCall: onCall
        ? { userId: onCall.userId, user: onCall.user }
        : null,
    };
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
