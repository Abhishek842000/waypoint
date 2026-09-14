import { Module } from "@nestjs/common";
import { EscalationPoliciesController } from "./escalation-policies.controller";
import { EscalationPoliciesService } from "./escalation-policies.service";

@Module({
  controllers: [EscalationPoliciesController],
  providers: [EscalationPoliciesService],
  exports: [EscalationPoliciesService],
})
export class EscalationPoliciesModule {}
