import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getTenantOrgId, tenantDb } from "@waypoint/db";
import {
  currentlyOnCall,
  orderedSteps,
  resolveStepTarget,
  validatePolicySteps,
  type CreateEscalationPolicyInput,
  type EscalationStepInput,
  type UpdateEscalationPolicyInput,
} from "@waypoint/shared-types";

@Injectable()
export class EscalationPoliciesService {
  async list() {
    const policies = await tenantDb().escalationPolicy.findMany({
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { name: "asc" },
    });
    return Promise.all(policies.map((p) => this.hydrate(p)));
  }

  async get(id: string) {
    const policy = await tenantDb().escalationPolicy.findFirst({
      where: { id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!policy) throw new NotFoundException("Escalation policy not found");
    return this.hydrate(policy);
  }

  async create(input: CreateEscalationPolicyInput) {
    const steps = await this.normalizedSteps(input.steps);
    try {
      const policy = await tenantDb().escalationPolicy.create({
        data: {
          orgId: getTenantOrgId(),
          name: input.name,
          steps: {
            create: steps.map((step) => ({
              orgId: getTenantOrgId(),
              ...step,
            })),
          },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
      return this.hydrate(policy);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new ConflictException("An escalation policy with that name already exists");
    }
  }

  async update(id: string, input: UpdateEscalationPolicyInput) {
    await this.get(id);

    if (input.steps) {
      const steps = await this.normalizedSteps(input.steps);
      await tenantDb().escalationStep.deleteMany({ where: { escalationPolicyId: id } });
      const policy = await tenantDb().escalationPolicy.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          steps: {
            create: steps.map((step) => ({
              orgId: getTenantOrgId(),
              ...step,
            })),
          },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
      return this.hydrate(policy);
    }

    const policy = await tenantDb().escalationPolicy.update({
      where: { id },
      data: input.name !== undefined ? { name: input.name } : {},
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    return this.hydrate(policy);
  }

  async remove(id: string) {
    await this.get(id);
    await tenantDb().escalationPolicy.delete({ where: { id } });
    return { ok: true };
  }

  private async normalizedSteps(input: EscalationStepInput[]) {
    const steps = input.map((step, stepOrder) => ({
      stepOrder,
      waitMinutes: step.waitMinutes,
      targetType: step.targetType,
      targetRotationId: step.targetType === "rotation" ? (step.targetRotationId ?? null) : null,
      targetUserId: step.targetType === "user" ? (step.targetUserId ?? null) : null,
    }));

    const issues = validatePolicySteps(steps);
    if (issues.length) {
      throw new BadRequestException(issues.map((i) => i.message).join("; "));
    }

    for (const step of steps) {
      if (step.targetType === "rotation" && step.targetRotationId) {
        const rotation = await tenantDb().rotation.findFirst({
          where: { id: step.targetRotationId },
        });
        if (!rotation) throw new BadRequestException("Step targets a rotation that does not exist");
      }
      if (step.targetType === "user" && step.targetUserId) {
        const membership = await tenantDb().membership.findFirst({
          where: { userId: step.targetUserId },
        });
        if (!membership) {
          throw new BadRequestException("Step targets a user who is not in this organization");
        }
      }
    }

    return steps;
  }

  private async hydrate(policy: {
    id: string;
    orgId: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    steps: Array<{
      id: string;
      stepOrder: number;
      waitMinutes: number;
      targetType: "rotation" | "user";
      targetRotationId: string | null;
      targetUserId: string | null;
    }>;
  }) {
    const steps = orderedSteps(policy.steps);
    const rotationIds = steps
      .map((s) => s.targetRotationId)
      .filter((id): id is string => Boolean(id));
    const rotations = rotationIds.length
      ? await tenantDb().rotation.findMany({
          where: { id: { in: rotationIds } },
          include: { members: { orderBy: { position: "asc" } } },
        })
      : [];
    const rotationById = new Map(rotations.map((r) => [r.id, r]));

    return {
      ...policy,
      steps: steps.map((step, index) => {
        const rotation = step.targetRotationId
          ? rotationById.get(step.targetRotationId)
          : undefined;
        const onCall = rotation
          ? currentlyOnCall(rotation.members, rotation.currentPointer)
          : null;
        const target = resolveStepTarget(step, onCall?.userId ?? null);
        return {
          ...step,
          isTerminal: index === steps.length - 1,
          resolvedTarget: target,
        };
      }),
    };
  }
}
