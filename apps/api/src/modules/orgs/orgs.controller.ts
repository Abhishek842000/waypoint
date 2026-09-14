import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { inviteMemberSchema, type Actor } from "@waypoint/shared-types";
import { CurrentActor } from "../../common/current-actor.decorator";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { OrgsService } from "./orgs.service";

@Controller("orgs")
export class OrgsController {
  constructor(@Inject(OrgsService) private readonly orgs: OrgsService) {}

  @Get("current")
  @RequirePermission("org:read")
  current(@CurrentActor() actor: Actor) {
    return this.orgs.current(actor);
  }

  @Get("members")
  @RequirePermission("membership:read")
  members() {
    return this.orgs.listMembers();
  }

  @Post("members")
  @RequirePermission("membership:invite")
  invite(@Body() body: unknown) {
    return this.orgs.invite(inviteMemberSchema.parse(body));
  }
}
