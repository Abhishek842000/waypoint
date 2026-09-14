import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { createIncidentSchema, type Actor } from "@waypoint/shared-types";
import { CurrentActor } from "../../common/current-actor.decorator";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ApiKeyIncidentCreateThrottleGuard } from "./api-key-incident-create-throttle.guard";
import { IncidentsService } from "./incidents.service";

@Controller("incidents")
export class IncidentsController {
  constructor(@Inject(IncidentsService) private readonly incidents: IncidentsService) {}

  @Get()
  @RequirePermission("incident:read")
  list() {
    return this.incidents.list();
  }

  @Get(":id/timeline")
  @RequirePermission("incident:read")
  timeline(@Param("id") id: string) {
    return this.incidents.timeline(id);
  }

  @Get(":id")
  @RequirePermission("incident:read")
  get(@Param("id") id: string) {
    return this.incidents.get(id);
  }

  @Post()
  @RequirePermission("incident:create")
  @UseGuards(ApiKeyIncidentCreateThrottleGuard)
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.incidents.create(actor, createIncidentSchema.parse(body));
  }

  @HttpCode(200)
  @Post(":id/acknowledge")
  @RequirePermission("incident:acknowledge")
  acknowledge(@CurrentActor() actor: Actor, @Param("id") id: string) {
    return this.incidents.acknowledge(actor, id);
  }

  @HttpCode(200)
  @Post(":id/resolve")
  @RequirePermission("incident:resolve")
  resolve(@CurrentActor() actor: Actor, @Param("id") id: string) {
    return this.incidents.resolve(actor, id);
  }
}
