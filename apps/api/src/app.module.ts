import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthGuard } from "./modules/auth/auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { EscalationPoliciesModule } from "./modules/escalation-policies/escalation-policies.module";
import { HealthModule } from "./modules/health/health.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { NotificationChannelsModule } from "./modules/notifications/notification-channels.module";
import { OrgsModule } from "./modules/orgs/orgs.module";
import { PermissionsGuard } from "./modules/rbac/permissions.guard";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { RotationsModule } from "./modules/rotations/rotations.module";
import { ServicesModule } from "./modules/services/services.module";
import { TenantContextInterceptor } from "./common/tenant.interceptor";

@Module({
  imports: [
    HealthModule,
    AuthModule,
    OrgsModule,
    ServicesModule,
    RotationsModule,
    EscalationPoliciesModule,
    IncidentsModule,
    NotificationChannelsModule,
    RealtimeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
