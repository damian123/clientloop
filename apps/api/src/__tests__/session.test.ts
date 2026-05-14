import { describe, expect, it } from "vitest";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";
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
});

function cookieHeader(response: {
  headers: Record<string, number | string | string[] | undefined>;
}): string {
  const raw = response.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return cookies
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
