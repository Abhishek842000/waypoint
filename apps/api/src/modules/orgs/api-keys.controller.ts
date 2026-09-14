import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { createApiKeySchema } from "@waypoint/shared-types";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { ApiKeysService } from "./api-keys.service";

@Controller("api-keys")
export class ApiKeysController {
  constructor(@Inject(ApiKeysService) private readonly apiKeys: ApiKeysService) {}

  @Get()
  @RequirePermission("api_key:read")
  list() {
    return this.apiKeys.list();
  }

  @Post()
  @RequirePermission("api_key:create")
  create(@Body() body: unknown) {
    return this.apiKeys.create(createApiKeySchema.parse(body));
  }

  @Delete(":id")
  @RequirePermission("api_key:revoke")
  revoke(@Param("id") id: string) {
    return this.apiKeys.revoke(id);
  }
}
