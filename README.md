# Rift

A clean, efficient, self-hostable RSS reader.

## Features

- Multi-user accounts (admin-created)
- Feed subscription
- Folders for organizing feeds
- Read/unread state, save for later
- Tags
- Dark mode / theming (CSS-only, custom themes supported)
- PWA (installable, works in-browser)
- Cron-based feed polling
- Single Docker container with SQLite

## Quick Start

### Docker

```bash
docker compose up -d
```

Visit `http://localhost:3000` and create your admin account on first run.

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
