import type { FastifyReply } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import { setOidcTransactionCookie } from "../oidc";
import { createSessionToken, verifySessionToken } from "../session";

describe("authentication signing secrets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not accept the webhook secret as a production session secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SIGNING_SECRET", undefined);
    vi.stubEnv("WEBHOOK_SIGNING_SECRET", "webhook-only-secret");

    expect(() =>
      createSessionToken({ tenantId: seedTenantId, userId: seedUserId })
    ).toThrow("SESSION_SIGNING_SECRET must be configured");
  });

  it("requires a dedicated production OIDC transaction secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OIDC_TRANSACTION_SECRET", undefined);
    vi.stubEnv("SESSION_SIGNING_SECRET", "s".repeat(32));
    vi.stubEnv("WEBHOOK_SIGNING_SECRET", "webhook-only-secret");
    const reply = { header: vi.fn() } as unknown as FastifyReply;

    expect(() =>
      setOidcTransactionCookie(reply, {
        state: "state",
        nonce: "nonce",
        codeVerifier: "verifier",
        returnTo: "/",
        expiresAt: Date.now() + 60_000
      })
    ).toThrow("OIDC_TRANSACTION_SECRET must be configured");
  });

  it("rejects public placeholders and short production session secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SIGNING_SECRET", "replace-this-with-a-long-random-secret");
    expect(() =>
      createSessionToken({ tenantId: seedTenantId, userId: seedUserId })
    ).toThrow("non-placeholder");

    vi.stubEnv("SESSION_SIGNING_SECRET", "short-private-value");
    expect(() =>
      createSessionToken({ tenantId: seedTenantId, userId: seedUserId })
    ).toThrow("at least 32 bytes");
  });

  it("keeps the local session fallback independent of webhook-secret changes", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SIGNING_SECRET", undefined);
    vi.stubEnv("WEBHOOK_SIGNING_SECRET", "first-webhook-secret");
    const token = createSessionToken({ tenantId: seedTenantId, userId: seedUserId });

    vi.stubEnv("WEBHOOK_SIGNING_SECRET", "second-webhook-secret");
    expect(verifySessionToken(token)?.userId).toBe(seedUserId);
  });
});
