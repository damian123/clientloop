import { describe, expect, it } from "vitest";
import {
  seedAccounts,
  seedContacts,
  seedTenantId,
  seedUserId
} from "@clientloop/domain";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";
import { buildServer } from "../server";

describe("CRM GraphQL read layer", () => {
  it("returns a dense tenant-scoped account detail graph", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const account = seedAccounts[0]!;

    const response = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query: `
          query AccountDetail($id: ID!) {
            recordDetail(entityType: ACCOUNT, id: $id) {
              entityType
              account { id name status customFields }
              contacts { id firstName lastName accountId }
              opportunities { id name stage accountId }
              tasks { id title status parent { type id } }
              notes { id body bodyFormat }
              activities { id subject type payload }
              customFieldDefinitions { key label fieldType required isIndexed schema }
            }
          }
        `,
        variables: { id: account.id }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().errors).toBeUndefined();
    expect(response.json().data.recordDetail.account.name).toBe(account.name);
    expect(
      response
        .json()
        .data.recordDetail.contacts.some(
          (contact: { id: string }) =>
            contact.id === seedContacts.find((candidate) => candidate.accountId === account.id)?.id
        )
    ).toBe(true);
    await app.close();
  });

  it("exposes no GraphQL mutation surface", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const response = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query: "mutation { createAccount(name: \"Nope\") { id } }"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().errors[0].message).toContain("mutation operation is not supported");
    await app.close();
  });

  it("bounds aliased field amplification", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const fields = Array.from({ length: 101 }, (_, index) => `f${index}: entityType`).join("\n");

    const response = await app.inject({
      method: "POST",
      url: "/graphql",
      payload: {
        query: `{ recordDetail(entityType: ACCOUNT, id: "${seedAccounts[0]!.id}") { ${fields} } }`
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("too many fields");
    await app.close();
  });

  it("requires CSRF for cookie-authenticated GraphQL POST requests", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const login = await app.inject({
      method: "POST",
      url: "/v1/session/dev-login",
      payload: { tenantId: seedTenantId, userId: seedUserId }
    });
    const cookie = setCookieValues(login)
      .map((value) => value.split(";")[0])
      .join("; ");
    const payload = {
      query: `{ recordDetail(entityType: ACCOUNT, id: "${seedAccounts[0]!.id}") { entityType } }`
    };

    const rejected = await app.inject({
      method: "POST",
      url: "/graphql",
      headers: { cookie },
      payload
    });
    expect(rejected.statusCode).toBe(403);

    const accepted = await app.inject({
      method: "POST",
      url: "/graphql",
      headers: {
        cookie,
        "x-csrf-token": String(login.json().csrfToken)
      },
      payload
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.recordDetail.entityType).toBe("ACCOUNT");

    await app.close();
  });
});

function setCookieValues(response: {
  headers: Record<string, number | string | string[] | undefined>;
}): string[] {
  const raw = response.headers["set-cookie"];
  return Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
}
