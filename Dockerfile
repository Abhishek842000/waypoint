FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
COPY tests ./tests
COPY tsconfig.base.json vitest.config.ts ./

RUN pnpm install
RUN pnpm --filter @waypoint/db generate

EXPOSE 3000 3001

CMD ["pnpm", "--filter", "@waypoint/api", "start"]
