import type { FastifyInstance } from "fastify";
import {
  appendNoteSchema,
  completeTaskSchema,
  createActivitySchema,
  createAccountSchema,
  createContactSchema,
  createCustomFieldDefinitionSchema,
  createLeadSchema,
  createOpportunitySchema,
  createTaskSchema,
  createWebhookSubscriptionSchema,
  convertLeadSchema,
  contactImportRequestSchema,
  exportEntitySchema,
  listQuerySchema,
  searchQuerySchema,
  recordEntityTypeSchema,
  updateActivitySchema,
  updateCustomFieldValuesSchema,
  updateNoteSchema,
  updateOpportunitySchema,
  updateTaskSchema
} from "@clientloop/contracts";
import { openApiDocument } from "@clientloop/contracts";
import { principalFromRequest } from "../auth";
import { exportRecordsCsv, previewContactImport } from "../import-export";
import type { CRMRepository } from "../repository";

export async function registerCrmRoutes(app: FastifyInstance, repository: CRMRepository) {
  app.get("/health", async () => ({
    status: "ok",
    service: "clientloop-api",
    time: new Date().toISOString()
  }));

  app.get("/openapi.json", async () => openApiDocument);

  app.get("/v1/dashboard", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.dashboard(principal.tenantId);
  });

  app.get("/v1/accounts", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listAccounts(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/accounts", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const account = await repository.createAccount(
      principal,
      createAccountSchema.parse(request.body)
    );
    return reply.code(201).send(account);
  });

  app.get("/v1/contacts", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listContacts(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/contacts", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const contact = await repository.createContact(
      principal,
      createContactSchema.parse(request.body)
    );
    return reply.code(201).send(contact);
  });

  app.get("/v1/leads", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listLeads(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/leads", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const lead = await repository.createLead(principal, createLeadSchema.parse(request.body));
    return reply.code(201).send(lead);
  });

  app.post("/v1/leads/:id/convert", async (request) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    return repository.convertLead({
      principal,
      id: params.id,
      body: convertLeadSchema.parse(request.body),
      idempotencyKey: Array.isArray(request.headers["idempotency-key"])
        ? request.headers["idempotency-key"][0]
        : request.headers["idempotency-key"]
    });
  });

  app.get("/v1/opportunities", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listOpportunities(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/opportunities", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const opportunity = await repository.createOpportunity(
      principal,
      createOpportunitySchema.parse(request.body)
    );
    return reply.code(201).send(opportunity);
  });

  app.patch("/v1/opportunities/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateOpportunitySchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateOpportunity({
      principal,
      id: params.id,
      body,
      idempotencyKey: Array.isArray(request.headers["idempotency-key"])
        ? request.headers["idempotency-key"][0]
        : request.headers["idempotency-key"]
    });
  });

  app.get("/v1/tasks", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listTasks(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/tasks", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const task = await repository.createTask(principal, createTaskSchema.parse(request.body));
    return reply.code(201).send(task);
  });

  app.patch("/v1/tasks/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateTaskSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateTask({
      principal,
      id: params.id,
      body,
      idempotencyKey: Array.isArray(request.headers["idempotency-key"])
        ? request.headers["idempotency-key"][0]
        : request.headers["idempotency-key"]
    });
  });

  app.post("/v1/tasks/:id/complete", async (request) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = completeTaskSchema.parse(request.body);
    return repository.completeTask({
      principal,
      id: params.id,
      expectedVersion: body.expectedVersion
    });
  });

  app.post("/v1/notes", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const note = await repository.appendNote(principal, appendNoteSchema.parse(request.body));
    return reply.code(201).send(note);
  });

  app.patch("/v1/notes/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateNoteSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateNote({
      principal,
      id: params.id,
      body,
      idempotencyKey: Array.isArray(request.headers["idempotency-key"])
        ? request.headers["idempotency-key"][0]
        : request.headers["idempotency-key"]
    });
  });

  app.get("/v1/activities", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listActivities(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/activities", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const activity = await repository.createActivity(
      principal,
      createActivitySchema.parse(request.body)
    );
    return reply.code(201).send(activity);
  });

  app.patch("/v1/activities/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateActivitySchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateActivity({
      principal,
      id: params.id,
      body,
      idempotencyKey: Array.isArray(request.headers["idempotency-key"])
        ? request.headers["idempotency-key"][0]
        : request.headers["idempotency-key"]
    });
  });

  app.get("/v1/custom-fields", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listCustomFieldDefinitions(principal.tenantId);
  });

  app.post("/v1/custom-fields", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const definition = await repository.createCustomFieldDefinition(
      principal,
      createCustomFieldDefinitionSchema.parse(request.body)
    );
    return reply.code(201).send(definition);
  });

  app.patch("/v1/custom-field-values/:entityType/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { entityType: string; id: string };
    const body = updateCustomFieldValuesSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateCustomFieldValues({
      principal,
      entityType: recordEntityTypeSchema.parse(params.entityType),
      id: params.id,
      body,
      idempotencyKey: Array.isArray(request.headers["idempotency-key"])
        ? request.headers["idempotency-key"][0]
        : request.headers["idempotency-key"]
    });
  });

  app.get("/v1/webhooks/subscriptions", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listWebhookSubscriptions(principal.tenantId);
  });

  app.post("/v1/webhooks/subscriptions", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const subscription = await repository.createWebhookSubscription(
      principal,
      createWebhookSubscriptionSchema.parse(request.body)
    );
    return reply.code(201).send(subscription);
  });

  app.get("/v1/exports/:entity", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { entity: string };
    const entity = exportEntitySchema.parse(params.entity);
    const csv = await exportRecordsCsv({ principal, repository, entity });

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="clientloop-${entity}.csv"`)
      .send(csv);
  });

  app.post("/v1/imports/contacts/preview", async (request) => {
    await principalFromRequest(request, repository);
    return previewContactImport(contactImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/contacts", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const input = contactImportRequestSchema.parse(request.body);
    const preview = previewContactImport(input);

    if (preview.errors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        contacts: [],
        errors: preview.errors
      });
    }

    const contacts = [];
    for (const row of preview.rows) {
      contacts.push(
        await repository.createContact(principal, {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          accountId: row.accountId,
          ownerUserId: row.ownerUserId,
          customFields: {}
        })
      );
    }

    return reply.code(201).send({
      importedCount: contacts.length,
      contacts,
      errors: []
    });
  });

  app.get("/v1/search", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.search(principal.tenantId, searchQuerySchema.parse(request.query));
  });
}
