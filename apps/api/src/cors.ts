const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
] as const;

interface CorsEnvironment {
  CORS_ALLOWED_ORIGINS?: string | undefined;
  NODE_ENV?: string | undefined;
}

export function corsAllowedOriginsFromEnv(
  env: CorsEnvironment = process.env
): string[] {
  const configured = env.CORS_ALLOWED_ORIGINS;
  if (configured === undefined) {
    return env.NODE_ENV === "production" ? [] : [...LOCAL_DEVELOPMENT_ORIGINS];
  }
  if (configured.trim().length === 0) {
    return [];
  }

  return normalizeCorsAllowedOrigins(configured.split(","));
}

export function normalizeCorsAllowedOrigins(origins: readonly string[]): string[] {
  return [...new Set(origins.map(normalizeCorsOrigin))];
}

function normalizeCorsOrigin(value: string): string {
  const candidate = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${JSON.stringify(candidate)}`);
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.pathname !== "/" ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    parsed.origin === "null"
  ) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS must contain only HTTP(S) origins without paths: ${JSON.stringify(
        candidate
      )}`
    );
  }

  return parsed.origin;
}
