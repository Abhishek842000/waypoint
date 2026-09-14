import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Actor } from "@waypoint/shared-types";
import { IS_PUBLIC_KEY } from "../../common/public.decorator";
import { AuthService, SESSION_COOKIE } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const apiKeyHeader = req.headers["x-api-key"];
    const apiKey = typeof apiKeyHeader === "string" ? apiKeyHeader : undefined;

    const token = bearer ?? cookieToken;
    if (!token && !apiKey) {
      throw new UnauthorizedException("Authentication required");
    }

    req.actor = await this.auth.actorFromRequest(token, apiKey);
    return true;
  }
}
