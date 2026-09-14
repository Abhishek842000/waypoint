import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { tenantDb, getTenantOrgId } from "@waypoint/db";
import type { CreateServiceInput, UpdateServiceInput } from "@waypoint/shared-types";

@Injectable()
export class ServicesService {
  list() {
    return tenantDb().service.findMany({ orderBy: { name: "asc" } });
  }

  async get(id: string) {
    const service = await tenantDb().service.findFirst({ where: { id } });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }

  async create(input: CreateServiceInput) {
    const escalationPolicyId = await this.requirePolicy(input.escalationPolicyId);
    try {
      return await tenantDb().service.create({
        data: { orgId: getTenantOrgId(), name: input.name, escalationPolicyId },
      });
    } catch {
      throw new ConflictException("A service with that name already exists");
    }
  }

  async update(id: string, input: UpdateServiceInput) {
    await this.get(id);
    const escalationPolicyId =
      input.escalationPolicyId === undefined
        ? undefined
        : await this.requirePolicy(input.escalationPolicyId);
    return tenantDb().service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.currentStatus !== undefined
          ? { currentStatus: input.currentStatus }
          : {}),
        ...(escalationPolicyId !== undefined ? { escalationPolicyId } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await tenantDb().service.delete({ where: { id } });
    return { ok: true };
  }

  private async requirePolicy(policyId: string | null | undefined) {
    if (policyId === undefined) return undefined;
    if (policyId === null) return null;
    const policy = await tenantDb().escalationPolicy.findFirst({
      where: { id: policyId },
    });
    if (!policy) throw new NotFoundException("Escalation policy not found");
    return policy.id;
  }
}
