# Cadence backend — production Docker image
# Build:  docker build -t cadence-server .
# Run:    docker run -p 3001:3001 --env-file .env -v cadence_data:/data cadence-server

FROM node:22-alpine AS deps

RUN apk add --no-cache python3 make g++ \
  && ln -sf python3 /usr/bin/python

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile --ignore-engines --production=false

# ---

FROM node:22-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# better-sqlite3 native binding needs to match runtime; rebuild for alpine if needed
RUN node -e "require('better-sqlite3')" 2>/dev/null || (apk add --no-cache --virtual .build-deps python3 make g++ && cd node_modules/better-sqlite3 && npm rebuild && apk del .build-deps)

# Data dir for SQLite — mount a volume here in production
RUN mkdir -p /data && chown -R node:node /data

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/cadence.db
ENV PORT=3001

EXPOSE 3001

USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--experimental-strip-types", "server/index.ts"]
