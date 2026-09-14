import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";

@Module({
  imports: [OrgsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
