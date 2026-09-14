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
    try {
      return await tenantDb().service.create({
        data: { orgId: getTenantOrgId(), name: input.name },
      });
    } catch {
      throw new ConflictException("A service with that name already exists");
    }
  }

  async update(id: string, input: UpdateServiceInput) {
    await this.get(id);
    return tenantDb().service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.currentStatus !== undefined
          ? { currentStatus: input.currentStatus }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await tenantDb().service.delete({ where: { id } });
    return { ok: true };
  }
}
