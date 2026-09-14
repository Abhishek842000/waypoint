import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  createNotificationChannelSchema,
  updateNotificationChannelSchema,
} from "@waypoint/shared-types";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { NotificationChannelsService } from "./notification-channels.service";

@Controller("notification-channels")
export class NotificationChannelsController {
  constructor(
    @Inject(NotificationChannelsService)
    private readonly channels: NotificationChannelsService,
  ) {}

  @Get()
  @RequirePermission("notification_channel:read")
  list() {
    return this.channels.list();
  }

  @Post()
  @RequirePermission("notification_channel:create")
  create(@Body() body: unknown) {
    return this.channels.create(createNotificationChannelSchema.parse(body));
  }

  @Patch(":id")
  @RequirePermission("notification_channel:update")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.channels.update(id, updateNotificationChannelSchema.parse(body));
  }

  @Delete(":id")
  @RequirePermission("notification_channel:delete")
  remove(@Param("id") id: string) {
    return this.channels.remove(id);
  }
}
