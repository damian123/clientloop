import { describe, expect, it } from "vitest";
import { seedTenantId, seedUserId, seedUsers } from "@clientloop/domain";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";
import {
  oidcIdentityFromClaims,
  type OidcProvider,
  type OidcTransaction
} from "../oidc";
import { buildServer } from "../server";

describe("CRM API sessions", () => {
  it("creates a local development session and reads it back", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/session/dev-login",
      payload: {
        tenantId: seedTenantId,
        userId: seedUserId
      }
    });

    expect(loginResponse.statusCode).toBe(201);
    expect(loginResponse.json().csrfToken).toBeTruthy();

    const sessionResponse = await app.inject({
      method: "GET",
      url: "/v1/session",
      headers: {
        cookie: cookieHeader(loginResponse)
      }
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json().tenantId).toBe(seedTenantId);
    expect(sessionResponse.json().user.id).toBe(seedUserId);
    expect(sessionResponse.json().user.permissions.length).toBeGreaterThan(0);
    expect(sessionResponse.json().csrfToken).toBe(loginResponse.json().csrfToken);

    await app.close();
  });

  it("authenticates CRM reads with the session cookie", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/session/dev-login",
      payload: {}
    });

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: {
        cookie: cookieHeader(loginResponse)
      }
    });

    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.json().accounts.length).toBeGreaterThan(0);

    await app.close();
  });

  it("requires CSRF protection for session-cookie mutations", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/session/dev-login",
      payload: {}
    });
    const cookies = cookieHeader(loginResponse);
    const csrfToken = String(loginResponse.json().csrfToken);
    const payload = {
      firstName: "Casey",
      lastName: "Nguyen",
      email: "casey.nguyen@example.com",
      customFields: {}
    };

    const rejectedResponse = await app.inject({
      method: "POST",
      url: "/v1/contacts",
      headers: {
        cookie: cookies
      },
      payload
    });

    expect(rejectedResponse.statusCode).toBe(403);

    const acceptedResponse = await app.inject({
      method: "POST",
      url: "/v1/contacts",
      headers: {
        cookie: cookies,
        "x-csrf-token": csrfToken
      },
      payload
    });

    expect(acceptedResponse.statusCode).toBe(201);
    expect(acceptedResponse.json().email).toBe("casey.nguyen@example.com");

    await app.close();
  });

  it("rejects unsafe requests with invalid session cookies", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/contacts",
      headers: {
        cookie: "clientloop_session=invalid"
      },
      payload: {
        firstName: "Invalid",
        lastName: "Cookie",
        email: "invalid.cookie@example.com",
        customFields: {}
      }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it("completes an OIDC authorization-code flow with PKCE transaction state", async () => {
    const provider = new FakeOidcProvider();
    const app = await buildServer({
      repository: new InMemoryCRMRepository(),
      oidcProvider: provider
    });

    const loginResponse = await app.inject({
      method: "GET",
      url: "/v1/session/oidc/login?returnTo=%2Fpipeline"
    });

    expect(loginResponse.statusCode).toBe(302);
    expect(loginResponse.headers.location).toBe(
      "https://identity.example/authorize?state=fixed-state"
    );
    const transactionCookie = cookieHeader(loginResponse);
    expect(transactionCookie).toContain("clientloop_oidc_transaction=");

    const callbackResponse = await app.inject({
      method: "GET",
      url: "/v1/session/oidc/callback?code=authorization-code&state=fixed-state",
      headers: {
        cookie: transactionCookie
      }
    });

    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.headers.location).toBe("/pipeline");
    expect(cookieHeader(callbackResponse)).toContain("clientloop_session=");
    expect(provider.callbackUrl?.searchParams.get("code")).toBe("authorization-code");
    expect(provider.callbackTransaction?.codeVerifier).toBe("fixed-code-verifier");
    const setCookies = setCookieValues(callbackResponse);
    expect(
      setCookies.some(
        (cookie) =>
          cookie.startsWith("clientloop_oidc_transaction=") && cookie.includes("Max-Age=0")
      )
    ).toBe(true);

    await app.close();
  });

  it("rejects OIDC callbacks without a valid one-time transaction", async () => {
    const app = await buildServer({
      repository: new InMemoryCRMRepository(),
      oidcProvider: new FakeOidcProvider()
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/session/oidc/callback?code=unexpected&state=unexpected"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("transaction");
    await app.close();
  });

  it("rejects malformed OIDC transaction cookies without a server error", async () => {
    const app = await buildServer({
      repository: new InMemoryCRMRepository(),
      oidcProvider: new FakeOidcProvider()
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/session/oidc/callback?code=unexpected&state=unexpected",
      headers: {
        cookie: "clientloop_oidc_transaction=%"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("transaction");
    await app.close();
  });

  it("rejects external OIDC post-login redirects", async () => {
    const app = await buildServer({
      repository: new InMemoryCRMRepository(),
      oidcProvider: new FakeOidcProvider()
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/session/oidc/login?returnTo=https%3A%2F%2Fevil.example"
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("maps only verified OIDC email claims", () => {
    expect(
      oidcIdentityFromClaims({
        sub: "provider-subject",
        email: "alex.rep@clientloop.test",
        email_verified: true
      })
    ).toEqual({
      subject: "provider-subject",
      email: "alex.rep@clientloop.test"
    });
    expect(() =>
      oidcIdentityFromClaims({
        sub: "provider-subject",
        email: "attacker@example.test",
        email_verified: false
      })
    ).toThrow("not verified");
  });
});

class FakeOidcProvider implements OidcProvider {
  readonly tenantId = seedTenantId;
  callbackUrl: URL | undefined;
  callbackTransaction: OidcTransaction | undefined;

  async createAuthorizationRequest(returnTo: string) {
    return {
      authorizationUrl: new URL("https://identity.example/authorize?state=fixed-state"),
      transaction: {
        state: "fixed-state",
        nonce: "fixed-nonce",
        codeVerifier: "fixed-code-verifier",
        returnTo,
        expiresAt: Date.now() + 60_000
      }
    };
  }

  async exchangeCallback(callbackUrl: URL, transaction: OidcTransaction) {
    this.callbackUrl = callbackUrl;
    this.callbackTransaction = transaction;
    return {
      subject: "identity-provider-subject",
      email: seedUsers.find((user) => user.id === seedUserId)!.email
    };
  }
}

function cookieHeader(response: {
  headers: Record<string, number | string | string[] | undefined>;
}): string {
  return setCookieValues(response)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function setCookieValues(response: {
  headers: Record<string, number | string | string[] | undefined>;
}): string[] {
  const raw = response.headers["set-cookie"];
  return Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
}
