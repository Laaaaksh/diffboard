# syntax=docker/dockerfile:1
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY packages/cli/package.json ./packages/cli/package.json
RUN pnpm install --frozen-lockfile --filter @diffboard/core --filter @diffboard/server
RUN pnpm --filter @diffboard/core run build
RUN pnpm --filter @diffboard/server run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# The standalone output only bundles what the running server actually
# imports, so the `prisma` CLI (needed once, at boot, to run migrations)
# isn't traced into it - install just the CLI, pinned to the schema's
# generator version.
RUN npm install -g prisma@6.19.3

COPY --from=build /repo/packages/server/.next/standalone ./
COPY --from=build /repo/packages/server/.next/static ./packages/server/.next/static
COPY --from=build /repo/packages/server/prisma ./packages/server/prisma
COPY packages/server/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4300
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "packages/server/server.js"]
