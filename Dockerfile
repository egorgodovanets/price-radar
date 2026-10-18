# One recipe for every Node service; SERVICE picks which one:
#   docker build --build-arg SERVICE=tracker -t price-radar-tracker .
# docker compose (profile "app") builds tracker, bff and scraper with it.

FROM node:24-bookworm AS build
ARG SERVICE
# Corepack installs the pnpm version pinned in "packageManager" (package.json).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# 1. Download every package in the lockfile. Cached until the lockfile changes,
#    so editing source code does not download dependencies again.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# 2. Production dependencies of this service in a self-contained folder.
#    Only manifests are copied so far, so a code change does not invalidate this layer.
#    All of them: with one missing, the lockfile no longer matches the workspace. Add new packages here.
COPY apps/web/package.json apps/web/
COPY services/bff/package.json services/bff/
COPY services/notifications/package.json services/notifications/
COPY services/scraper/package.json services/scraper/
COPY services/tracker/package.json services/tracker/
RUN pnpm --filter "@price-radar/${SERVICE}" deploy --prod --legacy /out

# 3. node-rdkafka is a native addon (C++ around librdkafka). pnpm skips its build on purpose
#    (allowBuilds in pnpm-workspace.yaml), so developer machines need no C++ toolchain;
#    it is compiled here, for Linux, with the compilers of the full node image. Takes minutes,
#    which is why it sits before "COPY . .": it reruns only when dependencies change.
RUN if [ -d /out/node_modules/node-rdkafka ]; then cd /out/node_modules/node-rdkafka && npm run install; fi

# 4. Compile TypeScript (needs dev dependencies) and put the result next to the dependencies.
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter price-radar --filter "@price-radar/${SERVICE}"
RUN pnpm --filter "@price-radar/${SERVICE}" build && cp -r "services/${SERVICE}/dist" /out/dist

# Runtime: a slim image without compilers and dev dependencies.
FROM node:24-bookworm-slim
# Shared libraries librdkafka was linked against (TLS, HTTP for OAuth); compilers stay in the build stage.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libcurl4 libssl3 \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
# Exec form: node is PID 1 and receives SIGTERM from "docker stop" directly.
CMD ["node", "dist/index.js"]
