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
            displayName: "Morgan Manager",
            permissions: [
              {
                id: "perm-contact-create",
                resource: "contact",
                action: "create",
                condition: "tenant"
              }
            ]
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

  it("sends lead conversion requests with idempotency and CSRF headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse(leadConversionResponse());
    };
    const client = new CRMClient({
      baseUrl: "http://api.test",
      csrfToken: "csrf-token",
      fetchImpl
    });

    await client.convertLead(
      "00000000-0000-4000-8000-000000003001",
      {
        expectedVersion: 1,
        accountName: "Summit Retail",
        opportunity: {
          name: "Summit Retail opportunity",
          stage: "qualification",
          currency: "USD",
          ownerUserId: seedManagerId,
          customFields: {}
        }
      },
      { idempotencyKey: "convert-key" }
    );

    expect(calls[0]!.url).toBe(
      "http://api.test/v1/leads/00000000-0000-4000-8000-000000003001/convert"
    );
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
    expect(headers.get("idempotency-key")).toBe("convert-key");
  });

  it("creates custom field definitions with CSRF headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse(customFieldDefinitionResponse());
    };
    const client = new CRMClient({
      baseUrl: "http://api.test",
      csrfToken: "csrf-token",
      fetchImpl
    });

    const definition = await client.createCustomFieldDefinition({
      entityType: "account",
      label: "Renewal tier",
      fieldType: "single_select",
      required: false,
      isIndexed: true,
      schema: { options: ["gold", "silver"] }
    });

    expect(definition.key).toBe("renewal_tier");
    expect(calls[0]!.url).toBe("http://api.test/v1/custom-fields");
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
  });

  it("updates custom field values with idempotency and optimistic concurrency headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse({
        id: "00000000-0000-4000-8000-000000001001",
        tenantId: seedTenantId,
        name: "Northstar Robotics",
        domain: "northstar.example",
        ownerUserId: seedManagerId,
        status: "prospect",
        customFields: { health_score: 88 },
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 2
      });
    };
    const client = new CRMClient({
      baseUrl: "http://api.test",
      csrfToken: "csrf-token",
      fetchImpl
    });

    const account = await client.updateCustomFieldValues(
      "account",
      "00000000-0000-4000-8000-000000001001",
      {
        expectedVersion: 1,
        customFields: { health_score: 88 }
      },
      { idempotencyKey: "field-value-key" }
    );

    expect(account.customFields.health_score).toBe(88);
    expect(calls[0]!.url).toBe(
      "http://api.test/v1/custom-field-values/account/00000000-0000-4000-8000-000000001001"
    );
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
    expect(headers.get("if-match")).toBe("1");
    expect(headers.get("idempotency-key")).toBe("field-value-key");
  });

  it("updates activities with idempotency and optimistic concurrency headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse({
        id: "00000000-0000-4000-8000-000000007001",
        tenantId: seedTenantId,
        parent: { type: "opportunity", id: "00000000-0000-4000-8000-000000004001" },
        type: "call",
        subject: "Corrected activity",
        occurredAt: "2026-05-11T00:00:00.000Z",
        payload: { outcome: "qualified" },
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 2
      });
    };
    const client = new CRMClient({
      baseUrl: "http://api.test",
      csrfToken: "csrf-token",
      fetchImpl
    });

    const activity = await client.updateActivity(
      "00000000-0000-4000-8000-000000007001",
      {
        expectedVersion: 1,
        subject: "Corrected activity",
        payload: { outcome: "qualified" }
      },
      { idempotencyKey: "activity-update-key" }
    );

    expect(activity.subject).toBe("Corrected activity");
    expect(calls[0]!.url).toBe(
      "http://api.test/v1/activities/00000000-0000-4000-8000-000000007001"
    );
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
    expect(headers.get("if-match")).toBe("1");
    expect(headers.get("idempotency-key")).toBe("activity-update-key");
  });

  it("updates notes with idempotency and optimistic concurrency headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse({
        id: "00000000-0000-4000-8000-000000006001",
        tenantId: seedTenantId,
        parent: { type: "account", id: "00000000-0000-4000-8000-000000001001" },
        body: "Corrected note",
        bodyFormat: "plain_text",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 2
      });
    };
    const client = new CRMClient({
      baseUrl: "http://api.test",
      csrfToken: "csrf-token",
      fetchImpl
    });

    const note = await client.updateNote(
      "00000000-0000-4000-8000-000000006001",
      {
        expectedVersion: 1,
        body: "Corrected note"
      },
      { idempotencyKey: "note-update-key" }
    );

    expect(note.body).toBe("Corrected note");
    expect(calls[0]!.url).toBe(
      "http://api.test/v1/notes/00000000-0000-4000-8000-000000006001"
    );
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
    expect(headers.get("if-match")).toBe("1");
    expect(headers.get("idempotency-key")).toBe("note-update-key");
  });

  it("updates tasks with idempotency and optimistic concurrency headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return jsonResponse({
        id: "00000000-0000-4000-8000-000000005001",
        tenantId: seedTenantId,
        parent: { type: "account", id: "00000000-0000-4000-8000-000000001001" },
        title: "Corrected task",
        description: "Corrected task details",
        status: "open",
        priority: "high",
        dueAt: "2026-06-01T00:00:00.000Z",
        assignedUserId: seedManagerId,
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
        createdBy: seedManagerId,
        updatedBy: seedManagerId,
        version: 2
      });
    };
    const client = new CRMClient({
      baseUrl: "http://api.test",
      csrfToken: "csrf-token",
      fetchImpl
    });

    const task = await client.updateTask(
      "00000000-0000-4000-8000-000000005001",
      {
        expectedVersion: 1,
        title: "Corrected task",
        description: "Corrected task details",
        priority: "high",
        dueAt: "2026-06-01"
      },
      { idempotencyKey: "task-update-key" }
    );

    expect(task.title).toBe("Corrected task");
    expect(calls[0]!.url).toBe(
      "http://api.test/v1/tasks/00000000-0000-4000-8000-000000005001"
    );
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token");
    expect(headers.get("if-match")).toBe("1");
    expect(headers.get("idempotency-key")).toBe("task-update-key");
  });
});

function customFieldDefinitionResponse() {
  return {
    id: "00000000-0000-4000-8000-000000009201",
    tenantId: seedTenantId,
    entityType: "account",
    key: "renewal_tier",
    label: "Renewal tier",
    fieldType: "single_select",
    required: false,
    isIndexed: true,
    schema: { options: ["gold", "silver"] },
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
    createdBy: seedManagerId,
    updatedBy: seedManagerId,
    version: 1
  };
}

function leadConversionResponse() {
  const now = "2026-05-11T00:00:00.000Z";
  const account = {
    id: "00000000-0000-4000-8000-000000009101",
    tenantId: seedTenantId,
    name: "Summit Retail",
    domain: null,
    ownerUserId: seedManagerId,
    status: "prospect",
    customFields: {},
    createdAt: now,
    updatedAt: now,
    createdBy: seedManagerId,
    updatedBy: seedManagerId,
    version: 1
  };
  const contact = {
    id: "00000000-0000-4000-8000-000000009102",
    tenantId: seedTenantId,
    accountId: account.id,
    firstName: "Iris",
    lastName: "Novak",
    email: "iris@summit.example",
    phone: null,
    ownerUserId: seedManagerId,
    customFields: {},
    createdAt: now,
    updatedAt: now,
    createdBy: seedManagerId,
    updatedBy: seedManagerId,
    version: 1
  };
  const opportunity = {
    id: "00000000-0000-4000-8000-000000009103",
    tenantId: seedTenantId,
    accountId: account.id,
    primaryContactId: contact.id,
    name: "Summit Retail opportunity",
    stage: "qualification",
    amount: null,
    currency: "USD",
    expectedCloseDate: null,
    ownerUserId: seedManagerId,
    probabilityPct: null,
    customFields: {},
    createdAt: now,
    updatedAt: now,
    createdBy: seedManagerId,
    updatedBy: seedManagerId,
    version: 1
  };

  return {
    lead: {
      id: "00000000-0000-4000-8000-000000003001",
      tenantId: seedTenantId,
      source: "conference",
      companyName: "Summit Retail",
      contactName: "Iris Novak",
      email: "iris@summit.example",
      status: "converted",
      convertedAt: now,
      convertedAccountId: account.id,
      convertedContactId: contact.id,
      convertedOpportunityId: opportunity.id,
      customFields: {},
      createdAt: now,
      updatedAt: now,
      createdBy: seedManagerId,
      updatedBy: seedManagerId,
      version: 2
    },
    account,
    contact,
    opportunity
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
