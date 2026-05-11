import { describe, expect, it } from "vitest";
import { seedManagerId, seedTenantId } from "@clientloop/domain";
import { CRMClient } from "./client";

describe("CRMClient session support", () => {
  it("stores CSRF tokens from dev login and sends them with mutations", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });

      if (String(input).endsWith("/v1/session/dev-login")) {
        return jsonResponse({
          authenticated: true,
          tenantId: seedTenantId,
          user: {
            id: seedManagerId,
            email: "morgan.manager@clientloop.test",
            displayName: "Morgan Manager"
          },
          csrfToken: "csrf-token"
        });
      }

      if (String(input).endsWith("/v1/contacts")) {
        return jsonResponse({
          id: "00000000-0000-4000-8000-000000009001",
          tenantId: seedTenantId,
          accountId: null,
          firstName: "Casey",
          lastName: "Nguyen",
          email: "casey.nguyen@example.com",
          phone: null,
          ownerUserId: seedManagerId,
          customFields: {},
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:00:00.000Z",
          createdBy: seedManagerId,
          updatedBy: seedManagerId,
          version: 1
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    };

    const client = new CRMClient({ baseUrl: "http://api.test", fetchImpl });
    await client.devLogin({ tenantId: seedTenantId, userId: seedManagerId });
    await client.createContact({
      firstName: "Casey",
      lastName: "Nguyen",
      email: "casey.nguyen@example.com",
      customFields: {}
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]!.init.credentials).toBe("include");
    expect(calls[1]!.init.credentials).toBe("include");

    const mutationHeaders = new Headers(calls[1]!.init.headers);
    expect(mutationHeaders.get("x-csrf-token")).toBe("csrf-token");
    expect(mutationHeaders.has("x-user-id")).toBe(false);
    expect(mutationHeaders.has("x-tenant-id")).toBe(false);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
