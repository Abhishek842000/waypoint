import { Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { startRealtimeSubscriber, stopRealtimeSubscriber } from "@waypoint/jobs";
import { RealtimeController } from "./realtime.controller";

@Injectable()
class RealtimeSubscriberHost implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await startRealtimeSubscriber();
  }

  async onModuleDestroy() {
    await stopRealtimeSubscriber();
  }
}

@Module({
  controllers: [RealtimeController],
  providers: [RealtimeSubscriberHost],
})
export class RealtimeModule {}
