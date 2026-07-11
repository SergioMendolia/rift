function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export const env = {
  port: parseInt(optional("PORT", "3000")!, 10),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-in-production"),
  dbPath: optional("DB_PATH", "./data/rift.db")!,
  pollCron: optional("POLL_CRON", "*/30 * * * *")!,
  dataDir: optional("DATA_DIR", "./data")!,
  oidcIssuer: optional("OIDC_ISSUER"),
  oidcClientId: optional("OIDC_CLIENT_ID"),
  oidcClientSecret: optional("OIDC_CLIENT_SECRET"),
};