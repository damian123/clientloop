import { describe, expect, it } from "vitest";
import {
  seedAccounts,
  seedActivities,
  seedLeads,
  seedManagerId,
  seedOpportunities
} from "@clientloop/domain";
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

  it("updates an activity with optimistic concurrency", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const activity = seedActivities[0]!;

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/activities/${activity.id}`,
      headers: {
        "x-user-id": seedManagerId,
        "If-Match": String(activity.version),
        "Idempotency-Key": "activity-update-test"
      },
      payload: {
        expectedVersion: activity.version,
        subject: "Corrected renewal pricing review",
        payload: {
          durationMinutes: 30,
          outcome: "pricing approved"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().subject).toBe("Corrected renewal pricing review");
    expect(response.json().payload.outcome).toBe("pricing approved");
    expect(response.json().version).toBe(activity.version + 1);

    const staleResponse = await app.inject({
      method: "PATCH",
      url: `/v1/activities/${activity.id}`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        expectedVersion: activity.version,
        subject: "Stale correction"
      }
    });

    expect(staleResponse.statusCode).toBe(409);
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

  it("converts a lead into CRM records", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const lead = seedLeads[0]!;

    const response = await app.inject({
      method: "POST",
      url: `/v1/leads/${lead.id}/convert`,
      headers: {
        "x-user-id": seedManagerId,
        "Idempotency-Key": "convert-lead-test"
      },
      payload: {
        expectedVersion: lead.version,
        accountName: lead.companyName,
        opportunity: {
          name: `${lead.companyName} new business`,
          amount: 42000,
          currency: "USD",
          ownerUserId: seedManagerId,
          probabilityPct: 25
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().lead.status).toBe("converted");
    expect(response.json().lead.convertedAccountId).toBe(response.json().account.id);
    expect(response.json().lead.convertedContactId).toBe(response.json().contact.id);
    expect(response.json().lead.convertedOpportunityId).toBe(response.json().opportunity.id);
    expect(response.json().contact.email).toBe(lead.email);
    expect(response.json().opportunity.amount).toBe(42000);

    const dashboardAfterConversion = await app.inject({
      method: "GET",
      url: "/v1/dashboard"
    });
    const convertedCounts = {
      accounts: dashboardAfterConversion.json().accounts.length,
      contacts: dashboardAfterConversion.json().contacts.length,
      opportunities: dashboardAfterConversion.json().opportunities.length
    };

    const staleResponse = await app.inject({
      method: "POST",
      url: `/v1/leads/${lead.id}/convert`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        expectedVersion: lead.version,
        accountName: lead.companyName
      }
    });

    expect(staleResponse.statusCode).toBe(409);
    const dashboardAfterConflict = await app.inject({
      method: "GET",
      url: "/v1/dashboard"
    });
    expect(dashboardAfterConflict.json().accounts).toHaveLength(convertedCounts.accounts);
    expect(dashboardAfterConflict.json().contacts).toHaveLength(convertedCounts.contacts);
    expect(dashboardAfterConflict.json().opportunities).toHaveLength(convertedCounts.opportunities);
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

  it("creates custom field definitions and rejects duplicate keys", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const response = await app.inject({
      method: "POST",
      url: "/v1/custom-fields",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        entityType: "account",
        label: "Renewal tier",
        fieldType: "single_select",
        isIndexed: true,
        schema: { options: ["gold", "silver"] }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().key).toBe("renewal_tier");
    expect(response.json().label).toBe("Renewal tier");

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/custom-fields",
      headers: {
        "x-user-id": seedManagerId
      }
    });
    expect(listResponse.statusCode).toBe(200);
    expect(
      listResponse.json().some((definition: { key: string }) => definition.key === "renewal_tier")
    ).toBe(true);

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/v1/custom-fields",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        entityType: "account",
        key: "renewal_tier",
        label: "Renewal tier duplicate",
        fieldType: "text"
      }
    });
    expect(duplicateResponse.statusCode).toBe(409);
    await app.close();
  });

  it("updates record custom field values with validation and concurrency", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const account = seedAccounts[0]!;

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/custom-field-values/account/${account.id}`,
      headers: {
        "x-user-id": seedManagerId,
        "If-Match": String(account.version),
        "Idempotency-Key": "custom-field-value-test"
      },
      payload: {
        expectedVersion: account.version,
        customFields: {
          health_score: 88
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().customFields.health_score).toBe(88);
    expect(response.json().version).toBe(account.version + 1);

    const staleResponse = await app.inject({
      method: "PATCH",
      url: `/v1/custom-field-values/account/${account.id}`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        expectedVersion: account.version,
        customFields: {
          health_score: 72
        }
      }
    });
    expect(staleResponse.statusCode).toBe(409);

    const invalidResponse = await app.inject({
      method: "PATCH",
      url: `/v1/custom-field-values/account/${seedAccounts[1]!.id}`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        expectedVersion: seedAccounts[1]!.version,
        customFields: {
          health_score: "not a number"
        }
      }
    });
    expect(invalidResponse.statusCode).toBe(400);
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
