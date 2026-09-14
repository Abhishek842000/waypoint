import { Module } from "@nestjs/common";
import { OrgsController } from "./orgs.controller";
import { OrgsService } from "./orgs.service";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { PublicStatusController } from "./public-status.controller";

@Module({
  controllers: [OrgsController, ApiKeysController, PublicStatusController],
  providers: [OrgsService, ApiKeysService],
})
export class OrgsModule {}
