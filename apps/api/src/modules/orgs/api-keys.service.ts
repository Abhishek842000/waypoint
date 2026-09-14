import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { tenantDb, getTenantOrgId } from "@waypoint/db";
import type { CreateApiKeyInput } from "@waypoint/shared-types";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class ApiKeysService {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async list() {
    const keys = await tenantDb().apiKey.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }

  async create(input: CreateApiKeyInput) {
    const generated = this.auth.generateApiKey();
    const key = await tenantDb().apiKey.create({
      data: {
        orgId: getTenantOrgId(),
        name: input.name,
        hashedKey: generated.hashedKey,
        prefix: generated.prefix,
        scopes: input.scopes,
      },
    });
    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      plaintext: generated.plaintext,
    };
  }

  async revoke(id: string) {
    const existing = await tenantDb().apiKey.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException("API key not found");
    await tenantDb().apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
