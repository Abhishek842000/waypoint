import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type TenantStore = {
  orgId: string;
};

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getTenantOrgId(): string {
  const store = tenantStorage.getStore();
  if (!store?.orgId) {
    throw new Error("Tenant context missing: refused to run an unscoped query");
  }
  return store.orgId;
}

export function runWithTenant<T>(orgId: string, fn: () => T): T {
  return tenantStorage.run({ orgId }, fn);
}

/**
 * Models that carry orgId and MUST be scoped. User and Org are global
 * (users can belong to multiple orgs; orgs are looked up by slug/id
 * before entering tenant context).
 */
export const TENANT_MODELS = new Set<Prisma.ModelName>([
  "Membership",
  "Service",
  "Rotation",
  "RotationMember",
  "EscalationPolicy",
  "EscalationStep",
  "Incident",
  "IncidentEvent",
  "NotificationChannel",
  "ApiKey",
]);

type TenantClient = ReturnType<typeof extendWithTenant>;

function modelDelegate(model: string) {
  const name = model.charAt(0).toLowerCase() + model.slice(1);
  return (prisma as unknown as Record<string, { findFirst: Function }>)[name];
}

function notFound(model: string): never {
  throw new Prisma.PrismaClientKnownRequestError(`No ${model} found for this organization`, {
    code: "P2025",
    clientVersion: Prisma.prismaVersion.client,
  });
}

function extendWithTenant(orgId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model as Prisma.ModelName)) {
            return query(args);
          }

          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            throw new Error(
              `findUnique is not allowed on tenant model ${model}. Use findFirst so orgId scoping can be applied.`,
            );
          }

          const record = args as Record<string, unknown>;

          if (operation === "create") {
            return query({
              ...record,
              data: { ...((record.data as object) ?? {}), orgId },
            });
          }

          if (operation === "createMany") {
            const data = record.data;
            const next = Array.isArray(data)
              ? data.map((row) => ({ ...(row as object), orgId }))
              : { ...((data as object) ?? {}), orgId };
            return query({ ...record, data: next });
          }

          if (operation === "update" || operation === "delete") {
            const existing = await modelDelegate(model).findFirst({
              where: { ...((record.where as object) ?? {}), orgId },
            });
            if (!existing) notFound(model);
            const data = record.data
              ? { ...(record.data as object) }
              : undefined;
            if (data) delete (data as { orgId?: string }).orgId;
            return query({
              ...record,
              where: { id: existing.id },
              ...(data ? { data } : {}),
            });
          }

          if (operation === "upsert") {
            throw new Error(
              `upsert is not allowed on tenant model ${model}. Use findFirst + create/update.`,
            );
          }

          const where = { ...((record.where as object) ?? {}), orgId };
          if (operation === "updateMany") {
            const data = { ...((record.data as object) ?? {}) };
            delete (data as { orgId?: string }).orgId;
            return query({ ...record, where, data });
          }

          return query({ ...record, where });
        },
      },
    },
  });
}

/**
 * Prisma client bound to the current AsyncLocalStorage tenant.
 * Every query against TENANT_MODELS gets orgId forced in — including
 * overwriting a caller-supplied orgId on create, so tenant hopping
 * through the data layer is not possible.
 */
export function tenantDb(): TenantClient {
  return extendWithTenant(getTenantOrgId());
}

/**
 * Unscoped client — only for auth bootstrap (user lookup, org create)
 * and resolving a public org slug. Callers must be explicit.
 */
export function unscopedDb() {
  return prisma;
}
