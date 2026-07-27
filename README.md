# Rift

A clean, efficient, self-hostable RSS reader.

## Features

- Multi-user accounts (admin-created)
- Feed subscription
- Full-text search across article titles, summaries, and content
- Folders for organizing feeds
- Read/unread state, save for later
- Dark mode / theming (CSS-only, custom themes supported)
- PWA (installable, works in-browser)
- Cron-based feed polling
- Single Docker container with SQLite

## Quick Start

### Docker (development)

```bash
docker compose up -d
```

Visit `http://localhost:3000` and create your admin account on first run.

### Docker (production)

Copy the example production compose file and edit it:

```bash
cp docker-compose.prod.yml docker-compose.override.yml
```

Set a strong `JWT_SECRET`:

```bash
# Generate a random secret
openssl rand -base64 32
```

Edit `docker-compose.override.yml` and replace `JWT_SECRET=CHANGE_ME_TO_A_RANDOM_STRING` with the generated value.

Start the server:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

Or use the production file directly:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Visit `http://your-server:3000` and create your admin account on first run.

### Reverse Proxy (Pangolin, Traefik, Caddy, etc.)

When running behind a reverse proxy, make sure to forward these headers:
- `X-Forwarded-Proto` (e.g. `https`)
- `X-Forwarded-Host` (e.g. `rift.example.com`)

Example Caddy config:

```
rift.example.com {
    reverse_proxy localhost:3000
}
```

Example Traefik labels (add to the rift service in your compose file):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.rift.rule=Host(`rift.example.com`)"
  - "traefik.http.routers.rift.entrypoints=websecure"
  - "traefik.http.routers.rift.tls=true"
  - "traefik.http.services.rift.loadbalancer.server.port=3000"
```

### Development

```bash
# Install dependencies
bun install

# Run migrations
bun run db:migrate

# Build client
bun run build:client

# Start server
bun start

# Or run dev mode (server + client separately)
bun run dev:server  # in one terminal
bun run dev:client  # in another terminal
```

## Configuration

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `changeme` | Secret for JWT tokens |
| `DB_PATH` | `/app/data/rift.db` | SQLite database path |
| `DATA_DIR` | `/app/data` | Data directory (for custom themes) |
| `POLL_CRON` | `*/30 * * * *` | Cron schedule for feed polling |
| `CLEANUP_CRON` | `0 3 * * *` | Cron schedule for deleting unsaved articles older than 1 year |
| `OIDC_ISSUER` | - | Optional OIDC issuer URL |
| `OIDC_CLIENT_ID` | - | Optional OIDC client ID |
| `OIDC_CLIENT_SECRET` | - | Optional OIDC client secret |

## Custom Themes

Place a `custom.css` file at `/app/data/themes/custom.css` (or mount it as a volume). It should override CSS custom properties:

```css
[data-theme="custom"] {
  --bg: #1a1a2e;
  --surface: #16213e;
  --text: #e0e0e0;
  --accent: #0f3460;
  /* ... */
}
```

Select "Custom" in Settings to apply it.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `j` / `↓` | Next article |
| `k` / `↑` | Previous article |
| `s` | Toggle saved |
| `m` | Toggle read/unread |
| `o` | Open original article |

## Tech Stack

- **Runtime:** Bun
- **Backend:** Hono + Drizzle ORM + bun:sqlite
- **Frontend:** Vue 3 + Vite (PWA)
- **Styling:** CSS custom properties (no preprocessor)
- **Feed parsing:** rss-parser
- **Cron:** Bun.cron()

## License

MIT
