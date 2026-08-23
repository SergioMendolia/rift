FROM oven/bun:1.4

WORKDIR /app

COPY package.json bun.lockb* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile || bun install

COPY . .

RUN bun run build:client

RUN mkdir -p /app/data/themes

EXPOSE 3000

VOLUME ["/app/data"]

ENV DB_PATH=/app/data/rift.db
ENV DATA_DIR=/app/data
ENV JWT_SECRET=changeme-please
ENV PORT=3000
ENV POLL_CRON="*/30 * * * *"

CMD ["bun", "run", "server/src/index.ts"]
