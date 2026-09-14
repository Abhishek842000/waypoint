import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { unscopedDb } from "@waypoint/db";
import {
  type Actor,
  PermissionSchema,
  permissionsForRole,
} from "@waypoint/shared-types";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "waypoint_session";
const API_KEY_PREFIX = "wp_live_";

type JwtPayload = {
  sub: string;
  orgId: string;
  role: "admin" | "responder" | "viewer";
};

@Injectable()
export class AuthService {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  signSession(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }

  async actorFromSessionToken(token: string): Promise<Actor> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid session");
    }

    const membership = await unscopedDb().membership.findUnique({
      where: { userId_orgId: { userId: payload.sub, orgId: payload.orgId } },
    });
    if (!membership) {
      throw new UnauthorizedException("Membership not found");
    }

    return {
      authMethod: "session",
      userId: payload.sub,
      orgId: payload.orgId,
      role: membership.role,
      scopes: permissionsForRole(membership.role),
    };
  }

  generateApiKey(): { plaintext: string; prefix: string; hashedKey: string } {
    const secret = randomBytes(24).toString("base64url");
    const plaintext = `${API_KEY_PREFIX}${secret}`;
    const prefix = plaintext.slice(0, 16);
    const hashedKey = hashApiKey(plaintext);
    return { plaintext, prefix, hashedKey };
  }

  async actorFromApiKey(plaintext: string): Promise<Actor> {
    if (!plaintext.startsWith(API_KEY_PREFIX)) {
      throw new UnauthorizedException("Invalid API key");
    }
    const prefix = plaintext.slice(0, 16);
    const key = await unscopedDb().apiKey.findUnique({
      where: { prefix },
    });
    if (!key || key.revokedAt) {
      throw new UnauthorizedException("Invalid API key");
    }
    if (key.hashedKey !== hashApiKey(plaintext)) {
      throw new UnauthorizedException("Invalid API key");
    }

    await unscopedDb().apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    const scopes = key.scopes
      .map((s) => PermissionSchema.safeParse(s))
      .filter((r) => r.success)
      .map((r) => r.data);

    return {
      authMethod: "api_key",
      userId: null,
      orgId: key.orgId,
      role: null,
      scopes,
    };
  }

  async actorFromRequest(token: string | undefined, apiKey: string | undefined): Promise<Actor> {
    if (apiKey) {
      return this.actorFromApiKey(apiKey);
    }
    if (token) {
      if (token.startsWith(API_KEY_PREFIX)) {
        return this.actorFromApiKey(token);
      }
      return this.actorFromSessionToken(token);
    }
    throw new UnauthorizedException("Authentication required");
  }
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "org"}-${suffix}`;
}
