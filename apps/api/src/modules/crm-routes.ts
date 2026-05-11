import type { FastifyInstance } from "fastify";
import {
  appendNoteSchema,
  completeTaskSchema,
  createAccountSchema,
  createContactSchema,
  createLeadSchema,
  createOpportunitySchema,
  createTaskSchema,
  createWebhookSubscriptionSchema,
  listQuerySchema,
  searchQuerySchema,
  updateOpportunitySchema
} from "@clientloop/contracts";
import { openApiDocument } from "@clientloop/contracts";
import { principalFromRequest } from "../auth";
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

  app.get("/v1/activities", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listActivities(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.get("/v1/custom-fields", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listCustomFieldDefinitions(principal.tenantId);
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

  app.get("/v1/search", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.search(principal.tenantId, searchQuerySchema.parse(request.query));
  });
}
