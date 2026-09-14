import { Controller, Get, Header, Inject, Param } from "@nestjs/common";
import { Public } from "../../common/public.decorator";
import { PublicStatusService } from "./public-status.service";

@Controller("public")
export class PublicStatusController {
  constructor(
    @Inject(PublicStatusService) private readonly publicStatus: PublicStatusService,
  ) {}

  @Public()
  @Get("status/:orgSlug")
  @Header("Cache-Control", "public, max-age=5, s-maxage=5, stale-while-revalidate=15")
  bySlug(@Param("orgSlug") orgSlug: string) {
    return this.publicStatus.bySlug(orgSlug);
  }
}
