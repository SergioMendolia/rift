# AGENTS.md

Bun-based RSS reader. Three workspaces: `server` (Hono + Drizzle + bun:sqlite), `client` (Vue 3 + Vite PWA), `packages/shared` (DTO types imported via `@rift/shared`).

## Commands

```bash
bun install                 # workspace install (bun.lock)
bun run dev                 # dev server + client (two processes)
bun run dev:server          # server only (watches, uses DB_PATH=../data/rift.db)
bun run dev:client          # client only (vite)
bun run build:client        # vue-tsc --noEmit && vite build  → client/dist
bun run start               # production server: bun run server/src/index.ts
bun run db:migrate           # run drizzle migrations (uses DB_PATH=../data/rift.db)
bun run db:generate          # generate a new migration from schema changes
bun run test                # vitest run (all projects)
bun run test:watch           # vitest watch mode
```

No `lint`, `format`, or `typecheck` script exists. Client build runs `vue-tsc --noEmit` for typecheck; server has no typecheck step.

`bun` is required — the server uses `bun:sqlite`, `Bun.password`, `Bun.cron`, `Bun.file`. Don't run server code or tests under node.

## Architecture

- **Entry**: `server/src/index.ts` builds the Hono app, runs migrations at startup, registers `Bun.cron` feed polling, serves `client/dist` + SPA fallback.
- **DB**: SQLite at `DB_PATH` (default `/app/data/rift.db`). Drizzle ORM. Schema in `server/src/schema/index.ts`. Migrations in `server/src/db/migrations/`. Auto-run on server start; `bun run db:migrate` to run manually.
- **Auth**: JWT via `hono/jwt`, `JWT_SECRET` env. Middleware in `server/src/middleware/index.ts` sets `c.get("user")`; routes call `requireAuth(c)` / `requireAdmin(c)`.
- **Feeds**: `server/src/services/feed-service.ts` — `subscribeToFeed` (with RSS auto-discovery via `discoverFeedUrl`), `refreshFeed`. `rss-parser` for parsing.
- **Shared types**: `packages/shared/src/types.ts`. Imported by both server and client as `@rift/shared` (TS path alias, resolved by vite/bun).
- **Client**: Pinia stores in `client/src/stores/`, API calls via `fetch` with `auth.authHeaders()`. Vue Router in `client/src/router.ts`.

## Testing

Tests run under vitest (not bun's built-in test runner). Config in `vitest.config.ts` defines two projects:
- `server` (node env): `server/tests/**/*.test.ts` + `server/src/**/*.test.ts`
- `client` (happy-dom env): `client/tests/**/*.test.ts` + `client/src/**/*.test.ts`

Setup files: `tests/setup.ts` (stubs `Bun` global), `tests/client-setup.ts` (polyfills `localStorage` — happy-dom 20 doesn't expose it).

Server tests mock `../src/db/connection` per-file via `vi.mock` (avoids loading `bun:sqlite`). Route tests use `server/tests/_helpers.ts` (`makeMockDb`, `appWithUser`, `request`). The mock `db` is chainable: queue return values with `db._queueAll([...])` / `db._queueGet(...)` / `db._queueReturning([...])`, reset with `db._reset()`.

Run a single project: `bunx vitest run --project server` / `--project client`.
Run a single file: `bunx vitest run server/tests/feeds.routes.test.ts`.

The server deps resolve from `server/node_modules` (bun workspace layout); `vitest.config.ts` aliases them so test files outside `server/` can import `hono`, `drizzle-orm`, etc.

## Gotchas

- Server `errorHandler` middleware (`try/await next()/catch`) catches thrown errors but Hono's app-level `onError` can override the response — the catch still runs (logs the error). Tests assert status + spy, not response body.
- `db/connection.ts` opens SQLite with WAL + foreign_keys ON at module import. Importing it under node fails (`bun:sqlite`); tests must mock it.
- Client `tsconfig.json` is `strict: false`; server `tsconfig.json` is `strict: true`.
- `@rift/shared` has no build step — both packages import the `.ts` source directly via path alias.
- First run creates an admin account via `POST /api/auth/setup` (only works when no users exist).

## CI

`.github/workflows/tests.yml` — runs `bun install && bun run test` on Bun 1.3.14, on push/PR to main.
`.github/workflows/docker.yml` — builds/pushes the multi-arch image to GHCR (gated behind non-PR events).