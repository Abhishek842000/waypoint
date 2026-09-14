import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { createRotationSchema, updateRotationSchema } from "@waypoint/shared-types";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { RotationsService } from "./rotations.service";

@Controller("rotations")
export class RotationsController {
  constructor(@Inject(RotationsService) private readonly rotations: RotationsService) {}

  @Get()
  @RequirePermission("rotation:read")
  list() {
    return this.rotations.list();
  }

  @Get(":id")
  @RequirePermission("rotation:read")
  get(@Param("id") id: string) {
    return this.rotations.get(id);
  }

  @Post()
  @RequirePermission("rotation:create")
  create(@Body() body: unknown) {
    return this.rotations.create(createRotationSchema.parse(body));
  }

  @Patch(":id")
  @RequirePermission("rotation:update")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.rotations.update(id, updateRotationSchema.parse(body));
  }

  @Delete(":id")
  @RequirePermission("rotation:delete")
  remove(@Param("id") id: string) {
    return this.rotations.remove(id);
  }
}
