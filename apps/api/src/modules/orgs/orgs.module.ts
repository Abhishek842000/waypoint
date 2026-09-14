import { Module } from "@nestjs/common";
import { OrgsController } from "./orgs.controller";
import { OrgsService } from "./orgs.service";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { PublicStatusController } from "./public-status.controller";
import { PublicStatusRevalidateService } from "./public-status-revalidate.service";
import { PublicStatusService } from "./public-status.service";

@Module({
  controllers: [OrgsController, ApiKeysController, PublicStatusController],
  providers: [OrgsService, ApiKeysService, PublicStatusService, PublicStatusRevalidateService],
  exports: [PublicStatusRevalidateService],
})
export class OrgsModule {}
