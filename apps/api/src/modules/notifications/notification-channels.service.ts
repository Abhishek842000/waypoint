import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getTenantOrgId, tenantDb } from "@waypoint/db";
import {
  createNotificationChannelSchema,
  emailChannelConfigSchema,
  slackChannelConfigSchema,
  smsChannelConfigSchema,
  type CreateNotificationChannelInput,
  type UpdateNotificationChannelInput,
} from "@waypoint/shared-types";

@Injectable()
export class NotificationChannelsService {
  list() {
    return tenantDb().notificationChannel.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const channel = await tenantDb().notificationChannel.findFirst({ where: { id } });
    if (!channel) throw new NotFoundException("Notification channel not found");
    return channel;
  }

  create(input: CreateNotificationChannelInput) {
    const parsed = createNotificationChannelSchema.parse(input);
    return tenantDb().notificationChannel.create({
      data: {
        orgId: getTenantOrgId(),
        name: parsed.name,
        type: parsed.type,
        config: this.configFor(parsed.type, parsed.config),
        enabled: parsed.enabled ?? true,
      },
    });
  }

  async update(id: string, input: UpdateNotificationChannelInput) {
    const existing = await this.get(id);
    const config = input.config
      ? this.configFor(existing.type, input.config)
      : undefined;
    return tenantDb().notificationChannel.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(config !== undefined ? { config } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await tenantDb().notificationChannel.delete({ where: { id } });
    return { ok: true };
  }

  private configFor(type: "slack" | "sms" | "email", config: Record<string, unknown>) {
    const parsed =
      type === "slack"
        ? slackChannelConfigSchema.safeParse(config)
        : type === "sms"
          ? smsChannelConfigSchema.safeParse(config)
          : emailChannelConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join("; "));
    }
    return parsed.data;
  }
}
