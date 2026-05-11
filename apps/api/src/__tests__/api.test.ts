import { describe, expect, it } from "vitest";
import { seedManagerId, seedOpportunities } from "@clientloop/domain";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";
import { buildServer } from "../server";

describe("CRM API", () => {
  it("returns dashboard data", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const response = await app.inject({
      method: "GET",
      url: "/v1/dashboard"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().opportunities.length).toBeGreaterThan(0);
    await app.close();
  });

  it("updates an opportunity with optimistic concurrency", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const opportunity = seedOpportunities[0]!;

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/opportunities/${opportunity.id}`,
      headers: {
        "If-Match": String(opportunity.version),
        "Idempotency-Key": "test-key"
      },
      payload: {
        expectedVersion: opportunity.version,
        stage: "proposal"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().stage).toBe("proposal");
    expect(response.json().version).toBe(opportunity.version + 1);
    await app.close();
  });

  it("rejects stale opportunity updates", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const opportunity = seedOpportunities[0]!;

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/opportunities/${opportunity.id}`,
      payload: {
        expectedVersion: 99,
        stage: "proposal"
      }
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("creates and lists webhook subscriptions without exposing the secret again", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/webhooks/subscriptions",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        url: "https://example.com/clientloop-webhook",
        eventTypes: ["opportunity.stage_changed"],
        signingSecret: "test-secret-with-enough-length"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().signingSecret).toBe("test-secret-with-enough-length");

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/webhooks/subscriptions",
      headers: {
        "x-user-id": seedManagerId
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
    expect(listResponse.json()[0].signingSecret).toBeUndefined();
    expect(listResponse.json()[0].secretFingerprint).toBeTruthy();
    await app.close();
  });

  it("exports contacts as CSV for managers", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const response = await app.inject({
      method: "GET",
      url: "/v1/exports/contacts",
      headers: {
        "x-user-id": seedManagerId
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("firstName,lastName,email");
    expect(response.body).toContain("Nina,Patel,nina@northstar.example");
    await app.close();
  });

  it("previews and imports contact CSV", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const csv = [
      "firstName,lastName,email,phone",
      "Riley,Park,riley.park@example.com,+1 415 555 0188"
    ].join("\n");

    const previewResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/contacts/preview",
      payload: { csv }
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().validRows).toBe(1);

    const importResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/contacts",
      payload: { csv }
    });

    expect(importResponse.statusCode).toBe(201);
    expect(importResponse.json().importedCount).toBe(1);
    expect(importResponse.json().contacts[0].email).toBe("riley.park@example.com");
    await app.close();
  });
});
