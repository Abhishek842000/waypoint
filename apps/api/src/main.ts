import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./common/prisma-exception.filter";
import { ZodExceptionFilter } from "./common/zod-exception.filter";

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix("v1", {
    exclude: [{ path: "health", method: RequestMethod.ALL }],
  });
  app.useGlobalFilters(new ZodExceptionFilter(), new PrismaExceptionFilter());
  app.enableCors({
    origin: corsOrigin(),
    credentials: true,
  });

  return app;
}

function corsOrigin(): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  const allowed = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (origin, cb) => {
    if (!origin || allowed.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(null, false);
  };
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`Waypoint API listening on ${port}`);
}

if (require.main === module) {
  bootstrap();
}
