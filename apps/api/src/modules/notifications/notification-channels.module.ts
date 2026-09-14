import { Module } from "@nestjs/common";
import { NotificationChannelsController } from "./notification-channels.controller";
import { NotificationChannelsService } from "./notification-channels.service";

@Module({
  controllers: [NotificationChannelsController],
  providers: [NotificationChannelsService],
})
export class NotificationChannelsModule {}
