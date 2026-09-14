import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { unscopedDb } from "@waypoint/db";
import {
  loginSchema,
  registerSchema,
  type Actor,
} from "@waypoint/shared-types";
import { Public } from "../../common/public.decorator";
import { CurrentActor } from "../../common/current-actor.decorator";
import { AuthService, SESSION_COOKIE, slugify } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = registerSchema.parse(body);
    const existing = await unscopedDb().user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await this.auth.hashPassword(input.password);
    const slug = slugify(input.orgName);

    const result = await unscopedDb().$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
        },
      });
      const org = await tx.org.create({
        data: { name: input.orgName, slug },
      });
      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, role: "admin" },
      });
      return { user, org };
    });

    const token = this.auth.signSession({
      sub: result.user.id,
      orgId: result.org.id,
      role: "admin",
    });
    setSessionCookie(res, token);

    return {
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      org: { id: result.org.id, name: result.org.name, slug: result.org.slug },
      role: "admin" as const,
    };
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = loginSchema.parse(body);
    const user = await unscopedDb().user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user || !(await this.auth.verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const membership = await unscopedDb().membership.findFirst({
      where: { userId: user.id },
      include: { org: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      throw new UnauthorizedException("User has no organization");
    }

    const token = this.auth.signSession({
      sub: user.id,
      orgId: membership.orgId,
      role: membership.role,
    });
    setSessionCookie(res, token);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      org: {
        id: membership.org.id,
        name: membership.org.name,
        slug: membership.org.slug,
      },
      role: membership.role,
    };
  }

  @Public()
  @HttpCode(200)
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, {
      path: "/",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return { ok: true };
  }

  @Get("me")
  async me(@CurrentActor() actor: Actor) {
    if (actor.authMethod === "api_key") {
      const org = await unscopedDb().org.findUnique({ where: { id: actor.orgId } });
      return {
        actor,
        org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
        user: null,
      };
    }

    const user = await unscopedDb().user.findUnique({
      where: { id: actor.userId! },
    });
    const org = await unscopedDb().org.findUnique({ where: { id: actor.orgId } });
    return {
      actor,
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      role: actor.role,
    };
  }
}

function setSessionCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    // Cross-site Vercel (web) → Railway (API) needs None+Secure.
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
