import { describe, expect, it } from "vitest";
import {
  createSeedData,
  seedAccounts,
  seedActivities,
  seedContacts,
  seedLeads,
  seedManagerId,
  seedNotes,
  seedOpportunities,
  seedTasks,
  seedUserId
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

  it("creates account, contact, and opportunity records for contextual create flows", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const accountResponse = await app.inject({
      method: "POST",
      url: "/v1/accounts",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        name: "Contextual Create Co",
        domain: "contextual-create.example",
        status: "prospect",
        customFields: {}
      }
    });

    expect(accountResponse.statusCode).toBe(201);
    expect(accountResponse.json().name).toBe("Contextual Create Co");
    expect(accountResponse.json().ownerUserId).toBe(seedManagerId);

    const contactResponse = await app.inject({
      method: "POST",
      url: "/v1/contacts",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        accountId: accountResponse.json().id,
        firstName: "Casey",
        lastName: "Context",
        email: "casey.context@example.com",
        phone: "+1 555 0100",
        customFields: {}
      }
    });

    expect(contactResponse.statusCode).toBe(201);
    expect(contactResponse.json().accountId).toBe(accountResponse.json().id);

    const opportunityResponse = await app.inject({
      method: "POST",
      url: "/v1/opportunities",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        accountId: accountResponse.json().id,
        primaryContactId: contactResponse.json().id,
        name: "Contextual expansion",
        stage: "discovery",
        amount: 64000,
        currency: "USD",
        expectedCloseDate: "2026-06-30",
        ownerUserId: seedManagerId,
        probabilityPct: 45,
        customFields: {}
      }
    });

    expect(opportunityResponse.statusCode).toBe(201);
    expect(opportunityResponse.json().accountId).toBe(accountResponse.json().id);
    expect(opportunityResponse.json().primaryContactId).toBe(contactResponse.json().id);
    expect(opportunityResponse.json().amount).toBe(64000);
    expect(opportunityResponse.json().probabilityPct).toBe(45);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/v1/dashboard",
      headers: {
        "x-user-id": seedManagerId
      }
    });

    expect(dashboardResponse.statusCode).toBe(200);
    expect(
      dashboardResponse
        .json()
        .accounts.some((account: { id: string }) => account.id === accountResponse.json().id)
    ).toBe(true);
    expect(
      dashboardResponse
        .json()
        .contacts.some((contact: { id: string }) => contact.id === contactResponse.json().id)
    ).toBe(true);
    expect(
      dashboardResponse
        .json()
        .opportunities.some(
          (opportunity: { id: string }) => opportunity.id === opportunityResponse.json().id
        )
    ).toBe(true);

    await app.close();
  });

  it("creates, scores, and plans conference prospects with compliance guardrails", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });

    const conferenceResponse = await app.inject({
      method: "POST",
      url: "/v1/conferences",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        name: "Northwind Product Summit",
        startDate: "2026-07-10",
        location: "London",
        website: "https://example.com/northwind-product-summit",
        audienceType: "B2B software operators and partners",
        attendeeAccessStatus: "unknown"
      }
    });

    expect(conferenceResponse.statusCode).toBe(201);

    const companyResponse = await app.inject({
      method: "POST",
      url: `/v1/conferences/${conferenceResponse.json().id}/companies`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        company: "Stonebridge Analytics",
        conferenceRole: "speaker",
        sector: "Enterprise software",
        productFit: true,
        expansionFit: true,
        budgetFit: false,
        marketEntryRelevance: true,
        partnershipRelevance: true,
        companyScore: 18,
        sourceUrl: "https://example.com/northwind-product-summit/speakers"
      }
    });

    expect(companyResponse.statusCode).toBe(201);

    const personResponse = await app.inject({
      method: "POST",
      url: `/v1/conferences/${conferenceResponse.json().id}/people`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        conferenceCompanyId: companyResponse.json().id,
        name: "Morgan Vale",
        title: "Managing Partner",
        icpCategory: "economic_buyer",
        conferenceSignal: "Speaking on platform operations",
        buyingSignal: "Announced a platform expansion",
        relationshipPath: "Warm intro",
        sourceType: "speaker_agenda",
        source: "Agenda page",
        lawfulBasisNotes: "No email stored; use event app or warm intro.",
        optOutStatus: "not_opted_out",
        seniorityScore: 4,
        companyFitScore: 4,
        signalScore: 5,
        conferenceSignalScore: 3,
        warmIntroScore: 2,
        timingScore: 2
      }
    });

    expect(personResponse.statusCode).toBe(201);
    expect(personResponse.json().totalScore).toBe(20);
    expect(personResponse.json().priorityBand).toBe("request_meeting");

    const meetingResponse = await app.inject({
      method: "POST",
      url: `/v1/conferences/${conferenceResponse.json().id}/meetings`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        conferencePersonId: personResponse.json().id,
        reasonToMeet: "Discuss a possible product partnership",
        proposedAsk: "15-minute meeting",
        status: "requested"
      }
    });

    expect(meetingResponse.statusCode).toBe(201);
    expect(meetingResponse.json().status).toBe("requested");

    const blockedPersonResponse = await app.inject({
      method: "POST",
      url: `/v1/conferences/${conferenceResponse.json().id}/people`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        name: "Opted Out",
        title: "CIO",
        icpCategory: "champion",
        outreachStatus: "meeting_requested",
        sourceType: "manual_research",
        optOutStatus: "opted_out",
        seniorityScore: 4,
        companyFitScore: 4,
        signalScore: 4,
        conferenceSignalScore: 2,
        warmIntroScore: 0,
        timingScore: 1
      }
    });

    expect(blockedPersonResponse.statusCode).toBe(409);
    await app.close();
  });

  it("rejects contextual create endpoints without create permissions", async () => {
    const seed = createSeedData();
    seed.roles = seed.roles.map((role) =>
      role.name === "Sales Rep"
        ? {
            ...role,
            permissions: role.permissions.filter((permission) => permission.action !== "create")
          }
        : role
    );
    const app = await buildServer({ repository: new InMemoryCRMRepository(seed) });

    const accountResponse = await app.inject({
      method: "POST",
      url: "/v1/accounts",
      headers: {
        "x-user-id": seedUserId
      },
      payload: {
        name: "Unauthorized Account",
        status: "prospect",
        customFields: {}
      }
    });

    expect(accountResponse.statusCode).toBe(403);

    const contactResponse = await app.inject({
      method: "POST",
      url: "/v1/contacts",
      headers: {
        "x-user-id": seedUserId
      },
      payload: {
        accountId: seedAccounts[0]!.id,
        firstName: "Unauthorized",
        lastName: "Contact",
        email: "unauthorized.contact@example.com",
        customFields: {}
      }
    });

    expect(contactResponse.statusCode).toBe(403);

    const opportunityResponse = await app.inject({
      method: "POST",
      url: "/v1/opportunities",
      headers: {
        "x-user-id": seedUserId
      },
      payload: {
        accountId: seedAccounts[0]!.id,
        primaryContactId: seedContacts[0]!.id,
        name: "Unauthorized opportunity",
        stage: "qualification",
        amount: 25000,
        currency: "USD",
        ownerUserId: seedUserId,
        probabilityPct: 20,
        customFields: {}
      }
    });

    expect(opportunityResponse.statusCode).toBe(403);
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

  it("updates a note with optimistic concurrency", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const note = seedNotes[0]!;

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/notes/${note.id}`,
      headers: {
        "x-user-id": seedManagerId,
        "If-Match": String(note.version),
        "Idempotency-Key": "note-update-test"
      },
      payload: {
        expectedVersion: note.version,
        body: "Corrected note body"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().body).toBe("Corrected note body");
    expect(response.json().version).toBe(note.version + 1);

    const staleResponse = await app.inject({
      method: "PATCH",
      url: `/v1/notes/${note.id}`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        expectedVersion: note.version,
        body: "Stale note correction"
      }
    });

    expect(staleResponse.statusCode).toBe(409);
    await app.close();
  });

  it("updates a task with optimistic concurrency", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const task = seedTasks[0]!;

    const response = await app.inject({
      method: "PATCH",
      url: `/v1/tasks/${task.id}`,
      headers: {
        "x-user-id": seedManagerId,
        "If-Match": String(task.version),
        "Idempotency-Key": "task-update-test"
      },
      payload: {
        expectedVersion: task.version,
        title: "Corrected task title",
        description: "Corrected task description",
        dueAt: "2026-06-01",
        priority: "high"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe("Corrected task title");
    expect(response.json().description).toBe("Corrected task description");
    expect(response.json().dueAt).toContain("2026-06-01");
    expect(response.json().priority).toBe("high");
    expect(response.json().version).toBe(task.version + 1);

    const staleResponse = await app.inject({
      method: "PATCH",
      url: `/v1/tasks/${task.id}`,
      headers: {
        "x-user-id": seedManagerId
      },
      payload: {
        expectedVersion: task.version,
        title: "Stale task correction"
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

  it("rejects updates to records outside the principal ownership scope", async () => {
    const seed = createSeedData();
    const managerOwnedAccount = seed.accounts.find((account) => account.id === seedAccounts[2]!.id)!;
    const managerOwnedOpportunity = seed.opportunities.find(
      (opportunity) => opportunity.id === seedOpportunities[2]!.id
    )!;
    managerOwnedAccount.ownerUserId = seedManagerId;
    managerOwnedAccount.createdBy = seedManagerId;
    managerOwnedAccount.updatedBy = seedManagerId;
    managerOwnedOpportunity.ownerUserId = seedManagerId;
    managerOwnedOpportunity.createdBy = seedManagerId;
    managerOwnedOpportunity.updatedBy = seedManagerId;
    const app = await buildServer({ repository: new InMemoryCRMRepository(seed) });

    const opportunityResponse = await app.inject({
      method: "PATCH",
      url: `/v1/opportunities/${managerOwnedOpportunity.id}`,
      headers: {
        "x-user-id": seedUserId,
        "If-Match": String(managerOwnedOpportunity.version),
        "Idempotency-Key": "unauthorized-opportunity-update"
      },
      payload: {
        expectedVersion: managerOwnedOpportunity.version,
        stage: "proposal"
      }
    });

    expect(opportunityResponse.statusCode).toBe(403);

    const customFieldResponse = await app.inject({
      method: "PATCH",
      url: `/v1/custom-field-values/account/${managerOwnedAccount.id}`,
      headers: {
        "x-user-id": seedUserId,
        "If-Match": String(managerOwnedAccount.version),
        "Idempotency-Key": "unauthorized-custom-field-update"
      },
      payload: {
        expectedVersion: managerOwnedAccount.version,
        customFields: {
          health_score: 70
        }
      }
    });

    expect(customFieldResponse.statusCode).toBe(403);
    await app.close();
  });

  it("rejects timeline corrections outside the principal ownership scope", async () => {
    const seed = createSeedData();
    const managerAssignedTask = seed.tasks.find((task) => task.id === seedTasks[1]!.id)!;
    const managerCreatedNote = seed.notes.find((note) => note.id === seedNotes[0]!.id)!;
    const managerCreatedActivity = seed.activities.find(
      (activity) => activity.id === seedActivities[0]!.id
    )!;
    managerAssignedTask.assignedUserId = seedManagerId;
    managerAssignedTask.createdBy = seedManagerId;
    managerAssignedTask.updatedBy = seedManagerId;
    managerCreatedNote.createdBy = seedManagerId;
    managerCreatedNote.updatedBy = seedManagerId;
    managerCreatedActivity.createdBy = seedManagerId;
    managerCreatedActivity.updatedBy = seedManagerId;
    const app = await buildServer({ repository: new InMemoryCRMRepository(seed) });

    const taskResponse = await app.inject({
      method: "PATCH",
      url: `/v1/tasks/${managerAssignedTask.id}`,
      headers: {
        "x-user-id": seedUserId,
        "If-Match": String(managerAssignedTask.version),
        "Idempotency-Key": "unauthorized-task-update"
      },
      payload: {
        expectedVersion: managerAssignedTask.version,
        title: "Unauthorized task update"
      }
    });

    expect(taskResponse.statusCode).toBe(403);

    const noteResponse = await app.inject({
      method: "PATCH",
      url: `/v1/notes/${managerCreatedNote.id}`,
      headers: {
        "x-user-id": seedUserId,
        "If-Match": String(managerCreatedNote.version),
        "Idempotency-Key": "unauthorized-note-update"
      },
      payload: {
        expectedVersion: managerCreatedNote.version,
        body: "Unauthorized note update"
      }
    });

    expect(noteResponse.statusCode).toBe(403);

    const activityResponse = await app.inject({
      method: "PATCH",
      url: `/v1/activities/${managerCreatedActivity.id}`,
      headers: {
        "x-user-id": seedUserId,
        "If-Match": String(managerCreatedActivity.version),
        "Idempotency-Key": "unauthorized-activity-update"
      },
      payload: {
        expectedVersion: managerCreatedActivity.version,
        subject: "Unauthorized activity update"
      }
    });

    expect(activityResponse.statusCode).toBe(403);
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

  it("rejects bulk data endpoints without export or matching create permissions", async () => {
    const seed = createSeedData();
    seed.roles = seed.roles.map((role) =>
      role.name === "Sales Rep"
        ? {
            ...role,
            permissions: role.permissions.filter(
              (permission) =>
                permission.action !== "export" &&
                !(
                  ["account", "contact", "opportunity"].includes(permission.resource) &&
                  permission.action === "create"
                )
            )
          }
        : role
    );
    const app = await buildServer({ repository: new InMemoryCRMRepository(seed) });
    const contactCsv = [
      "firstName,lastName,email,phone",
      "Riley,Park,riley.park@example.com,+1 415 555 0188"
    ].join("\n");
    const accountCsv = ["name,domain,status", "Blocked Account,blocked.example,prospect"].join("\n");
    const opportunityCsv = [
      "name,accountId,ownerUserId,stage,amount,currency,probabilityPct",
      `Blocked Opportunity,${seedAccounts[0]!.id},${seedUserId},qualification,43000,USD,25`
    ].join("\n");

    const exportResponse = await app.inject({
      method: "GET",
      url: "/v1/exports/contacts",
      headers: {
        "x-user-id": seedUserId
      }
    });

    expect(exportResponse.statusCode).toBe(403);

    const accountPreviewResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/accounts/preview",
      headers: {
        "x-user-id": seedUserId
      },
      payload: { csv: accountCsv }
    });
    expect(accountPreviewResponse.statusCode).toBe(403);

    const accountImportResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/accounts",
      headers: {
        "x-user-id": seedUserId
      },
      payload: { csv: accountCsv }
    });
    expect(accountImportResponse.statusCode).toBe(403);

    const contactPreviewResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/contacts/preview",
      headers: {
        "x-user-id": seedUserId
      },
      payload: { csv: contactCsv }
    });
    expect(contactPreviewResponse.statusCode).toBe(403);

    const contactImportResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/contacts",
      headers: {
        "x-user-id": seedUserId
      },
      payload: { csv: contactCsv }
    });
    expect(contactImportResponse.statusCode).toBe(403);

    const opportunityPreviewResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/opportunities/preview",
      headers: {
        "x-user-id": seedUserId
      },
      payload: { csv: opportunityCsv }
    });
    expect(opportunityPreviewResponse.statusCode).toBe(403);

    const opportunityImportResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/opportunities",
      headers: {
        "x-user-id": seedUserId
      },
      payload: { csv: opportunityCsv }
    });
    expect(opportunityImportResponse.statusCode).toBe(403);
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

  it("previews and imports account CSV", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const csv = ["name,domain,status", "Imported Account,imported-account.example,prospect"].join("\n");

    const previewResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/accounts/preview",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: { csv }
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().validRows).toBe(1);

    const importResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/accounts",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: { csv }
    });

    expect(importResponse.statusCode).toBe(201);
    expect(importResponse.json().importedCount).toBe(1);
    expect(importResponse.json().accounts[0].name).toBe("Imported Account");
    await app.close();
  });

  it("previews and imports opportunity CSV", async () => {
    const app = await buildServer({ repository: new InMemoryCRMRepository() });
    const csv = [
      "name,accountId,ownerUserId,stage,amount,currency,probabilityPct",
      `Imported Opportunity,${seedAccounts[0]!.id},${seedUserId},qualification,43000,USD,25`
    ].join("\n");

    const previewResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/opportunities/preview",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: { csv }
    });

    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().validRows).toBe(1);

    const importResponse = await app.inject({
      method: "POST",
      url: "/v1/imports/opportunities",
      headers: {
        "x-user-id": seedManagerId
      },
      payload: { csv }
    });

    expect(importResponse.statusCode).toBe(201);
    expect(importResponse.json().importedCount).toBe(1);
    expect(importResponse.json().opportunities[0].name).toBe("Imported Opportunity");
    await app.close();
  });
});
