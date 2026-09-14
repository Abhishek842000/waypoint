import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  createEscalationPolicySchema,
  updateEscalationPolicySchema,
} from "@waypoint/shared-types";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { EscalationPoliciesService } from "./escalation-policies.service";

@Controller("escalation-policies")
export class EscalationPoliciesController {
  constructor(
    @Inject(EscalationPoliciesService)
    private readonly policies: EscalationPoliciesService,
  ) {}

  @Get()
  @RequirePermission("escalation_policy:read")
  list() {
    return this.policies.list();
  }

  @Get(":id")
  @RequirePermission("escalation_policy:read")
  get(@Param("id") id: string) {
    return this.policies.get(id);
  }

  @Post()
  @RequirePermission("escalation_policy:create")
  create(@Body() body: unknown) {
    return this.policies.create(createEscalationPolicySchema.parse(body));
  }

  @Patch(":id")
  @RequirePermission("escalation_policy:update")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.policies.update(id, updateEscalationPolicySchema.parse(body));
  }

  @Delete(":id")
  @RequirePermission("escalation_policy:delete")
  remove(@Param("id") id: string) {
    return this.policies.remove(id);
  }
}
