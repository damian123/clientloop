import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as oidc from "openid-client";

const OIDC_TRANSACTION_TTL_SECONDS = 10 * 60;
const OIDC_TRANSACTION_COOKIE = "clientloop_oidc_transaction";

export interface OidcTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}

export interface OidcIdentity {
  subject: string;
  email: string;
}

export interface OidcProvider {
  readonly tenantId: string;
  createAuthorizationRequest(returnTo: string): Promise<{
    authorizationUrl: URL;
    transaction: OidcTransaction;
  }>;
  exchangeCallback(callbackUrl: URL, transaction: OidcTransaction): Promise<OidcIdentity>;
}

export class OpenIdClientProvider implements OidcProvider {
  private configurationPromise: Promise<oidc.Configuration> | undefined;

  constructor(
    private readonly settings: {
      issuer: URL;
      clientId: string;
      clientSecret?: string | undefined;
      redirectUri: URL;
      tenantId: string;
    }
  ) {
    if (
      settings.issuer.protocol !== "https:" &&
      !(settings.issuer.hostname === "localhost" || settings.issuer.hostname === "127.0.0.1")
    ) {
      throw new Error("OIDC_ISSUER must use HTTPS outside localhost");
    }
    if (
      settings.redirectUri.protocol !== "https:" &&
      !(settings.redirectUri.hostname === "localhost" ||
        settings.redirectUri.hostname === "127.0.0.1")
    ) {
      throw new Error("OIDC_REDIRECT_URI must use HTTPS outside localhost");
    }
  }

  get tenantId(): string {
    return this.settings.tenantId;
  }

  async createAuthorizationRequest(returnTo: string): Promise<{
    authorizationUrl: URL;
    transaction: OidcTransaction;
  }> {
    const configuration = await this.configuration();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const transaction: OidcTransaction = {
      state,
      nonce,
      codeVerifier,
      returnTo,
      expiresAt: Date.now() + OIDC_TRANSACTION_TTL_SECONDS * 1000
    };

    return {
      authorizationUrl: oidc.buildAuthorizationUrl(configuration, {
        redirect_uri: this.settings.redirectUri.href,
        scope: "openid email profile",
        response_type: "code",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        nonce
      }),
      transaction
    };
  }

  async exchangeCallback(
    callbackUrl: URL,
    transaction: OidcTransaction
  ): Promise<OidcIdentity> {
    const tokens = await oidc.authorizationCodeGrant(
      await this.configuration(),
      callbackUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        idTokenExpected: true
      }
    );
    return oidcIdentityFromClaims(tokens.claims());
  }

  private configuration(): Promise<oidc.Configuration> {
    this.configurationPromise ??= oidc.discovery(
      this.settings.issuer,
      this.settings.clientId,
      this.settings.clientSecret
    );
    return this.configurationPromise;
  }
}

export function oidcIdentityFromClaims(claims: unknown): OidcIdentity {
  if (!claims || typeof claims !== "object") {
    throw new Error("OIDC provider did not return valid ID-token claims");
  }
  const record = claims as Record<string, unknown>;
  if (typeof record.sub !== "string" || record.sub.length === 0) {
    throw new Error("OIDC provider did not return a valid subject");
  }
  if (typeof record.email !== "string" || record.email.length === 0) {
    throw new Error("OIDC provider did not return an email address");
  }
  if (record.email_verified !== true) {
    throw new Error("OIDC email address is not verified");
  }

  return {
    subject: record.sub,
    email: record.email
  };
}

export function oidcProviderFromEnv(): OidcProvider | undefined {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const tenantId = process.env.OIDC_TENANT_ID;
  const configured = [issuer, clientId, redirectUri, tenantId].filter(Boolean).length;

  if (configured === 0) {
    return undefined;
  }
  if (!issuer || !clientId || !redirectUri || !tenantId) {
    throw new Error(
      "OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI, and OIDC_TENANT_ID must be configured together"
    );
  }
  if (process.env.NODE_ENV === "production" && !process.env.OIDC_CLIENT_SECRET) {
    throw new Error("OIDC_CLIENT_SECRET must be configured in production");
  }

  return new OpenIdClientProvider({
    issuer: new URL(issuer),
    clientId,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    redirectUri: new URL(redirectUri),
    tenantId
  });
}

export function normalizeReturnTo(value: unknown): string {
  const fallback = process.env.OIDC_POST_LOGIN_REDIRECT ?? "/";
  const candidate = typeof value === "string" && value.length > 0 ? value : fallback;
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    throw new Error("returnTo must be an application-relative path");
  }
  return candidate;
}

export function callbackUrlFromRequest(request: FastifyRequest): URL {
  const configured = process.env.OIDC_REDIRECT_URI;
  const base = configured ? new URL(configured) : new URL("http://localhost/v1/session/oidc/callback");
  const requestUrl = new URL(request.url, "http://localhost");
  base.search = requestUrl.search;
  return base;
}

export function setOidcTransactionCookie(
  reply: FastifyReply,
  transaction: OidcTransaction
): void {
  reply.header(
    "Set-Cookie",
    serializeCookie(OIDC_TRANSACTION_COOKIE, signTransaction(transaction), {
      httpOnly: true,
      maxAge: OIDC_TRANSACTION_TTL_SECONDS
    })
  );
}

export function readOidcTransaction(request: FastifyRequest): OidcTransaction | null {
  const token = parseCookies(headerValue(request.headers.cookie))[OIDC_TRANSACTION_COOKIE];
  if (!token) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OidcTransaction>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.returnTo !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      return null;
    }
    return parsed as OidcTransaction;
  } catch {
    return null;
  }
}

export function appendClearedOidcTransactionCookie(reply: FastifyReply): void {
  const current = reply.getHeader("Set-Cookie");
  const cookies = Array.isArray(current)
    ? current.map(String)
    : current === undefined
      ? []
      : [String(current)];
  cookies.push(
    serializeCookie(OIDC_TRANSACTION_COOKIE, "", {
      httpOnly: true,
      maxAge: 0
    })
  );
  reply.header("Set-Cookie", cookies);
}

function signTransaction(transaction: OidcTransaction): string {
  const payload = Buffer.from(JSON.stringify(transaction)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function sign(value: string): string {
  const configured =
    process.env.OIDC_TRANSACTION_SECRET ??
    process.env.SESSION_SIGNING_SECRET ??
    process.env.WEBHOOK_SIGNING_SECRET;
  if ((!configured || configured === "replace-me") && process.env.NODE_ENV === "production") {
    throw new Error("OIDC_TRANSACTION_SECRET or SESSION_SIGNING_SECRET is required in production");
  }
  const secret = configured && configured !== "replace-me"
    ? configured
    : "clientloop-local-oidc-transaction-secret";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function useSecureCookies(): boolean {
  return process.env.SESSION_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

function serializeCookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAge: number }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/v1/session/oidc",
    `Max-Age=${options.maxAge}`,
    `Expires=${
      options.maxAge === 0
        ? new Date(0).toUTCString()
        : new Date(Date.now() + options.maxAge * 1000).toUTCString()
    }`,
    "SameSite=Lax"
  ];
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (useSecureCookies()) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }
  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName) {
      try {
        cookies[rawName] = decodeURIComponent(rawValue.join("="));
      } catch {
        // A malformed cookie is unauthenticated input, not a server error.
      }
    }
    return cookies;
  }, {});
}
