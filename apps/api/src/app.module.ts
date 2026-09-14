import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthGuard } from "./modules/auth/auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { OrgsModule } from "./modules/orgs/orgs.module";
import { PermissionsGuard } from "./modules/rbac/permissions.guard";
import { ServicesModule } from "./modules/services/services.module";
import { TenantContextInterceptor } from "./common/tenant.interceptor";

@Module({
  imports: [HealthModule, AuthModule, OrgsModule, ServicesModule, IncidentsModule],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
