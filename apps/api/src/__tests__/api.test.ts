import { describe, expect, it } from "vitest";
import { seedOpportunities } from "@clientloop/domain";
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
});
