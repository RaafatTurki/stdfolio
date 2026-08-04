# syntax=docker/dockerfile:1
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY . .
RUN bunx svelte-kit sync && bun run build

FROM caddy:2 AS runner
COPY --from=build /app/build /usr/share/caddy
EXPOSE 80
