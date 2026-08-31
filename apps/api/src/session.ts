import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionClaims {
  tenantId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export function createSessionToken(input: { tenantId: string; userId: string }): string {
  const now = Date.now();
  const claims: SessionClaims = {
    tenantId: input.tenantId,
    userId: input.userId,
    issuedAt: now,
    expiresAt: now + sessionTtlSeconds() * 1000
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts as [string, string];
  if (!timingSafeStringEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<SessionClaims>;
    if (
      typeof claims.tenantId !== "string" ||
      typeof claims.userId !== "string" ||
      typeof claims.issuedAt !== "number" ||
      typeof claims.expiresAt !== "number" ||
      claims.expiresAt <= Date.now()
    ) {
      return null;
    }
    return {
      tenantId: claims.tenantId,
      userId: claims.userId,
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt
    };
  } catch {
    return null;
  }
}

export function readSessionToken(request: FastifyRequest): string | undefined {
  return parseCookies(headerValue(request.headers.cookie))[sessionCookieName()];
}

export function sessionClaimsFromRequest(request: FastifyRequest): SessionClaims | null {
  const token = readSessionToken(request);
  return token ? verifySessionToken(token) : null;
}

export function csrfTokenForSessionToken(sessionToken: string): string {
  return sign(`csrf.${sessionToken}`);
}

export function requiresCsrfProtection(request: FastifyRequest): boolean {
  if (request.url.split("?")[0] === "/v1/session/dev-login") {
    return false;
  }

  const token = readSessionToken(request);
  return (
    ["DELETE", "PATCH", "POST", "PUT"].includes(request.method.toUpperCase()) &&
    Boolean(token)
  );
}

export function isValidCsrfRequest(request: FastifyRequest): boolean {
  const sessionToken = readSessionToken(request);
  if (!sessionToken || !verifySessionToken(sessionToken)) {
    return false;
  }

  const actual = headerValue(request.headers["x-csrf-token"]);
  return actual ? timingSafeStringEqual(actual, csrfTokenForSessionToken(sessionToken)) : false;
}

export function setSessionCookies(reply: FastifyReply, sessionToken: string): void {
  const maxAge = sessionTtlSeconds();
  reply.header("Set-Cookie", [
    serializeCookie(sessionCookieName(), sessionToken, {
      httpOnly: true,
      maxAge,
      sameSite: "Lax",
      secure: useSecureCookies()
    }),
    serializeCookie(csrfCookieName(), csrfTokenForSessionToken(sessionToken), {
      maxAge,
      sameSite: "Lax",
      secure: useSecureCookies()
    })
  ]);
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.header("Set-Cookie", [
    serializeCookie(sessionCookieName(), "", {
      httpOnly: true,
      maxAge: 0,
      sameSite: "Lax",
      secure: useSecureCookies()
    }),
    serializeCookie(csrfCookieName(), "", {
      maxAge: 0,
      sameSite: "Lax",
      secure: useSecureCookies()
    })
  ]);
}

export function allowHeaderAuth(): boolean {
  if (process.env.ALLOW_HEADER_AUTH === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_HEADER_AUTH === "true";
}

export function allowDevLogin(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_LOGIN === "true";
}

function sessionCookieName(): string {
  return process.env.SESSION_COOKIE_NAME ?? "clientloop_session";
}

function csrfCookieName(): string {
  return process.env.CSRF_COOKIE_NAME ?? "clientloop_csrf";
}

function sessionTtlSeconds(): number {
  const configured = Number(process.env.SESSION_TTL_SECONDS ?? DEFAULT_SESSION_TTL_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_TTL_SECONDS;
}

function useSecureCookies(): boolean {
  return process.env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SIGNING_SECRET ?? process.env.WEBHOOK_SIGNING_SECRET;
  if (configured && configured !== "replace-me") {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SIGNING_SECRET must be configured in production");
  }

  return "clientloop-local-session-secret";
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) {
      return cookies;
    }

    try {
      cookies[rawName] = decodeURIComponent(rawValue.join("="));
    } catch {
      // Ignore malformed client input so authentication fails closed.
    }
    return cookies;
  }, {});
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    maxAge: number;
    sameSite: "Lax" | "Strict" | "None";
    secure: boolean;
  }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${options.maxAge}`,
    `Expires=${
      options.maxAge === 0
        ? new Date(0).toUTCString()
        : new Date(Date.now() + options.maxAge * 1000).toUTCString()
    }`,
    `SameSite=${options.sameSite}`
  ];

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
