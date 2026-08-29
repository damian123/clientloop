import type { FastifyInstance } from "fastify";
import {
  appendNoteSchema,
  completeTaskSchema,
  createActivitySchema,
  createAccountSchema,
  createConferenceCompanySchema,
  createConferenceMeetingSchema,
  createConferencePersonSchema,
  createConferenceSchema,
  createContactSchema,
  createCustomFieldDefinitionSchema,
  createLeadSchema,
  createOpportunitySchema,
  createTaskSchema,
  createWebhookSubscriptionSchema,
  convertLeadSchema,
  accountImportRequestSchema,
  conferenceImportRequestSchema,
  conferenceMeetingImportRequestSchema,
  conferencePersonImportRequestSchema,
  contactImportRequestSchema,
  exportEntitySchema,
  listQuerySchema,
  opportunityImportRequestSchema,
  searchQuerySchema,
  scoreConferencePersonSchema,
  recordEntityTypeSchema,
  updateActivitySchema,
  updateConferenceCompanySchema,
  updateConferenceMeetingSchema,
  updateConferencePersonSchema,
  updateConferenceSchema,
  updateCustomFieldValuesSchema,
  updateNoteSchema,
  updateOpportunitySchema,
  updateTaskSchema,
  type ConferenceMeetingImportRow
} from "@clientloop/contracts";
import { openApiDocument } from "@clientloop/contracts";
import { assertCan, type ConferenceCompany, type ConferencePerson } from "@clientloop/domain";
import { principalFromRequest } from "../auth";
import {
  exportRecordsCsv,
  previewAccountImport,
  previewConferenceCompanyImport,
  previewConferenceMeetingImport,
  previewConferencePersonImport,
  previewContactImport,
  previewOpportunityImport
} from "../import-export";
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

  app.get("/v1/conferences", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.listConferences(principal.tenantId, listQuerySchema.parse(request.query));
  });

  app.post("/v1/conferences", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const conference = await repository.createConference(
      principal,
      createConferenceSchema.parse(request.body)
    );
    return reply.code(201).send(conference);
  });

  app.patch("/v1/conferences/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateConferenceSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateConference({ principal, id: params.id, body });
  });

  app.get("/v1/conferences/:id/companies", async (request) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    return repository.listConferenceCompanies(
      principal.tenantId,
      params.id,
      listQuerySchema.parse(request.query)
    );
  });

  app.post("/v1/conferences/:id/companies", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const company = await repository.createConferenceCompany(
      principal,
      params.id,
      createConferenceCompanySchema.parse(request.body)
    );
    return reply.code(201).send(company);
  });

  app.patch("/v1/conference-companies/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateConferenceCompanySchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateConferenceCompany({ principal, id: params.id, body });
  });

  app.get("/v1/conferences/:id/people", async (request) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    return repository.listConferencePeople(
      principal.tenantId,
      params.id,
      listQuerySchema.parse(request.query)
    );
  });

  app.post("/v1/conferences/:id/people", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const person = await repository.createConferencePerson(
      principal,
      params.id,
      createConferencePersonSchema.parse(request.body)
    );
    return reply.code(201).send(person);
  });

  app.patch("/v1/conference-people/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateConferencePersonSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateConferencePerson({ principal, id: params.id, body });
  });

  app.post("/v1/conference-people/:id/score", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = scoreConferencePersonSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.scoreConferencePerson({ principal, id: params.id, body });
  });

  app.get("/v1/conferences/:id/meetings", async (request) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    return repository.listConferenceMeetings(
      principal.tenantId,
      params.id,
      listQuerySchema.parse(request.query)
    );
  });

  app.post("/v1/conferences/:id/meetings", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const meeting = await repository.createConferenceMeeting(
      principal,
      params.id,
      createConferenceMeetingSchema.parse(request.body)
    );
    return reply.code(201).send(meeting);
  });

  app.patch("/v1/conference-meetings/:id", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    const body = updateConferenceMeetingSchema.parse(request.body);
    const ifMatch = request.headers["if-match"];

    if (ifMatch && String(body.expectedVersion) !== String(Array.isArray(ifMatch) ? ifMatch[0] : ifMatch)) {
      return reply.code(409).send({
        error: "If-Match header does not match expectedVersion",
        statusCode: 409
      });
    }

    return repository.updateConferenceMeeting({ principal, id: params.id, body });
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
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "contact", "create", { tenantId: principal.tenantId });
    return previewContactImport(contactImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/accounts/preview", async (request) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "account", "create", { tenantId: principal.tenantId });
    return previewAccountImport(accountImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/opportunities/preview", async (request) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "opportunity", "create", { tenantId: principal.tenantId });
    return previewOpportunityImport(opportunityImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/accounts", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "account", "create", { tenantId: principal.tenantId });
    const input = accountImportRequestSchema.parse(request.body);
    const preview = previewAccountImport(input);

    if (preview.errors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        accounts: [],
        errors: preview.errors
      });
    }

    const accounts = [];
    for (const row of preview.rows) {
      accounts.push(
        await repository.createAccount(principal, {
          name: row.name,
          domain: row.domain,
          ownerUserId: row.ownerUserId,
          status: row.status,
          customFields: {}
        })
      );
    }

    return reply.code(201).send({
      importedCount: accounts.length,
      accounts,
      errors: []
    });
  });

  app.post("/v1/imports/contacts", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "contact", "create", { tenantId: principal.tenantId });
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

  app.post("/v1/imports/opportunities", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "opportunity", "create", { tenantId: principal.tenantId });
    const input = opportunityImportRequestSchema.parse(request.body);
    const preview = previewOpportunityImport(input);

    if (preview.errors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        opportunities: [],
        errors: preview.errors
      });
    }

    const opportunities = [];
    for (const row of preview.rows) {
      opportunities.push(
        await repository.createOpportunity(principal, {
          name: row.name,
          stage: row.stage,
          amount: row.amount,
          currency: row.currency,
          expectedCloseDate: row.expectedCloseDate,
          accountId: row.accountId,
          ownerUserId: row.ownerUserId,
          probabilityPct: row.probabilityPct,
          customFields: {}
        })
      );
    }

    return reply.code(201).send({
      importedCount: opportunities.length,
      opportunities,
      errors: []
    });
  });

  app.post("/v1/imports/conferences/:id/companies/preview", async (request) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    return previewConferenceCompanyImport(conferenceImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/conferences/:id/companies", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    const input = conferenceImportRequestSchema.parse(request.body);
    const preview = previewConferenceCompanyImport(input);

    if (preview.errors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        companies: [],
        errors: preview.errors
      });
    }

    const companies = [];
    for (const row of preview.rows) {
      companies.push(
        await repository.createConferenceCompany(principal, params.id, {
          accountId: row.accountId,
          company: row.company,
          website: row.website,
          conferenceRole: row.conferenceRole,
          sector: row.sector,
          rwaRelevance: row.rwaRelevance,
          privateMarketsRelevance: row.privateMarketsRelevance,
          fundraisingRelevance: row.fundraisingRelevance,
          marketEntryRelevance: row.marketEntryRelevance,
          partnershipRelevance: row.partnershipRelevance,
          companyScore: row.companyScore,
          sourceUrl: row.sourceUrl,
          sourceNotes: row.sourceNotes
        })
      );
    }

    return reply.code(201).send({
      importedCount: companies.length,
      companies,
      errors: []
    });
  });

  app.post("/v1/imports/conferences/:id/people/preview", async (request) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    return previewConferencePersonImport(conferencePersonImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/conferences/:id/people", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    const input = conferencePersonImportRequestSchema.parse(request.body);
    const preview = previewConferencePersonImport(input);

    if (preview.errors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        people: [],
        errors: preview.errors
      });
    }

    const conferenceCompanies = (
      await repository.listConferenceCompanies(principal.tenantId, params.id, { limit: 100 })
    ).items;
    const companyErrors = [];
    const companyByName = new Map(
      conferenceCompanies.map((company) => [company.company.trim().toLowerCase(), company])
    );
    for (const row of preview.rows) {
      if (!row.conferenceCompanyId && row.company && !companyByName.has(row.company.trim().toLowerCase())) {
        companyErrors.push({
          row: row.row,
          field: "company",
          message: "Conference company was not found"
        });
      }
    }

    if (companyErrors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        people: [],
        errors: companyErrors
      });
    }

    const people = [];
    for (const row of preview.rows) {
      const conferenceCompanyId =
        row.conferenceCompanyId ?? companyByName.get(row.company?.trim().toLowerCase() ?? "")?.id;
      people.push(
        await repository.createConferencePerson(principal, params.id, {
          conferenceCompanyId,
          accountId: row.accountId,
          contactId: row.contactId,
          name: row.name,
          title: row.title,
          linkedIn: row.linkedIn,
          email: row.email,
          conferenceSignal: row.conferenceSignal,
          icpCategory: row.icpCategory,
          buyingSignal: row.buyingSignal,
          relationshipPath: row.relationshipPath,
          outreachStatus: row.outreachStatus,
          sourceType: row.sourceType,
          source: row.source,
          lawfulBasisNotes: row.lawfulBasisNotes,
          optOutStatus: row.optOutStatus,
          seniorityScore: row.seniorityScore,
          companyFitScore: row.companyFitScore,
          signalScore: row.signalScore,
          conferenceSignalScore: row.conferenceSignalScore,
          warmIntroScore: row.warmIntroScore,
          timingScore: row.timingScore
        })
      );
    }

    return reply.code(201).send({
      importedCount: people.length,
      people,
      errors: []
      });
  });

  app.post("/v1/imports/conferences/:id/meetings/preview", async (request) => {
    const principal = await principalFromRequest(request, repository);
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    return previewConferenceMeetingImport(conferenceMeetingImportRequestSchema.parse(request.body));
  });

  app.post("/v1/imports/conferences/:id/meetings", async (request, reply) => {
    const principal = await principalFromRequest(request, repository);
    const params = request.params as { id: string };
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    const input = conferenceMeetingImportRequestSchema.parse(request.body);
    const preview = previewConferenceMeetingImport(input);

    if (preview.errors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        meetings: [],
        errors: preview.errors
      });
    }

    const conferenceCompanies = (
      await repository.listConferenceCompanies(principal.tenantId, params.id, { limit: 100 })
    ).items;
    const companyById = new Map(conferenceCompanies.map((company) => [company.id, company]));
    const conferencePeople = (
      await repository.listConferencePeople(principal.tenantId, params.id, { limit: 100 })
    ).items;
    const personById = new Map(conferencePeople.map((person) => [person.id, person]));
    const resolutionErrors = [];

    for (const row of preview.rows) {
      if (row.conferencePersonId) {
        if (!personById.has(row.conferencePersonId)) {
          resolutionErrors.push({
            row: row.row,
            field: "conferencePersonId",
            message: "Conference person was not found"
          });
        }
        continue;
      }

      const name = row.name?.trim().toLowerCase() ?? "";
      let matches = conferencePeople.filter((person) => person.name.trim().toLowerCase() === name);
      if (row.company) {
        const companyName = row.company.trim().toLowerCase();
        matches = matches.filter((person) => {
          const company = person.conferenceCompanyId ? companyById.get(person.conferenceCompanyId) : null;
          return company?.company.trim().toLowerCase() === companyName;
        });
      }

      if (matches.length !== 1) {
        resolutionErrors.push({
          row: row.row,
          field: "name",
          message:
            matches.length === 0
              ? "Conference person was not found"
              : "Conference person match is ambiguous"
        });
      }
    }

    if (resolutionErrors.length > 0) {
      return reply.code(400).send({
        importedCount: 0,
        meetings: [],
        errors: resolutionErrors
      });
    }

    const meetings = [];
    for (const row of preview.rows) {
      const conferencePersonId =
        row.conferencePersonId ?? resolveConferencePersonId(row, conferencePeople, companyById);
      meetings.push(
        await repository.createConferenceMeeting(principal, params.id, {
          conferencePersonId,
          reasonToMeet: row.reasonToMeet,
          proposedAsk: row.proposedAsk,
          introPath: row.introPath,
          status: row.status,
          notes: row.notes,
          nextStep: row.nextStep
        })
      );
    }

    return reply.code(201).send({
      importedCount: meetings.length,
      meetings,
      errors: []
    });
  });

  app.get("/v1/search", async (request) => {
    const principal = await principalFromRequest(request, repository);
    return repository.search(principal.tenantId, searchQuerySchema.parse(request.query));
  });
}

function resolveConferencePersonId(
  row: ConferenceMeetingImportRow,
  conferencePeople: ConferencePerson[],
  companyById: Map<string, ConferenceCompany>
) {
  if (row.conferencePersonId) {
    return row.conferencePersonId;
  }

  const name = row.name?.trim().toLowerCase() ?? "";
  let matches = conferencePeople.filter((person) => person.name.trim().toLowerCase() === name);
  if (row.company) {
    const companyName = row.company.trim().toLowerCase();
    matches = matches.filter((person) => {
      const company = person.conferenceCompanyId ? companyById.get(person.conferenceCompanyId) : null;
      return company?.company.trim().toLowerCase() === companyName;
    });
  }

  return matches[0]!.id;
}
