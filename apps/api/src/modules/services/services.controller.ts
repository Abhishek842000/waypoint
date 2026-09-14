import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { createServiceSchema, updateServiceSchema } from "@waypoint/shared-types";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ServicesService } from "./services.service";

@Controller("services")
export class ServicesController {
  constructor(@Inject(ServicesService) private readonly services: ServicesService) {}

  @Get()
  @RequirePermission("service:read")
  list() {
    return this.services.list();
  }

  @Get(":id")
  @RequirePermission("service:read")
  get(@Param("id") id: string) {
    return this.services.get(id);
  }

  @Post()
  @RequirePermission("service:create")
  create(@Body() body: unknown) {
    return this.services.create(createServiceSchema.parse(body));
  }

  @Patch(":id")
  @RequirePermission("service:update")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.services.update(id, updateServiceSchema.parse(body));
  }

  @Delete(":id")
  @RequirePermission("service:delete")
  remove(@Param("id") id: string) {
    return this.services.remove(id);
  }
}
