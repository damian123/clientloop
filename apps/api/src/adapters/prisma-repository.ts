import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertCan,
  assertValidCustomFieldDefinition,
  changeOpportunityStage,
  completeTask as completeTaskRule,
  convertLead as convertLeadRule,
  createAuditFields,
  normalizeCustomFieldKey,
  targetFromRecord,
  validateCustomFieldPatch,
  type AccessPrincipal,
  type Account,
  type Activity,
  type Contact,
  type CRMEntityType,
  type CustomFieldDefinition,
  type CustomFieldPrimitive,
  type DomainEventType,
  type Lead,
  type Note,
  type Opportunity,
  type OutboxEvent,
  type Page,
  type Permission,
  type PermissionAction,
  type PermissionCondition,
  type PermissionResource,
  type RecordEntityType,
  type Role,
  type Task,
  type TenantId,
  type User,
  type WebhookSubscription
} from "@clientloop/domain";
import type {
  AppendNoteInput,
  ConvertLeadInput,
  CreateActivityInput,
  CreateAccountInput,
  CreateContactInput,
  CreateCustomFieldDefinitionInput,
  CreateLeadInput,
  CreateOpportunityInput,
  CreateTaskInput,
  CreateWebhookSubscriptionInput,
  CreateWebhookSubscriptionResponse,
  CustomFieldValueUpdateResult,
  DashboardResponse,
  LeadConversionResult,
  ListQuery,
  SearchQuery,
  SearchResult,
  UpdateCustomFieldValuesInput,
  UpdateOpportunityInput
} from "@clientloop/contracts";
import type { CRMRepository, WebhookDeliveryTarget } from "../repository";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: {
    permissions: {
      include: {
        permission: true;
      };
    };
  };
}>;

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

export class PrismaCRMRepository implements CRMRepository {
  constructor(private readonly prisma = new PrismaClient()) {}

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async getPrincipal(tenantId: TenantId, userId: string): Promise<AccessPrincipal> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
        archivedAt: null
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error("Authenticated user was not found");
    }

    return {
      tenantId,
      user: this.toUser(user),
      roles: user.roles.map((userRole) => this.toRole(userRole.role))
    };
  }

  async dashboard(tenantId: TenantId): Promise<DashboardResponse> {
    const [
      accounts,
      contacts,
      leads,
      opportunities,
      tasks,
      notes,
      activities,
      customFieldDefinitions
    ] = await Promise.all([
      this.prisma.account.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.contact.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      this.prisma.lead.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.opportunity.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.task.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }]
      }),
      this.prisma.note.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.activity.findMany({
        where: { tenantId },
        orderBy: { occurredAt: "desc" }
      }),
      this.prisma.customFieldDefinition.findMany({
        where: { tenantId },
        orderBy: [{ entityType: "asc" }, { key: "asc" }]
      })
    ]);

    return {
      accounts: accounts.map((account) => this.toAccount(account)),
      contacts: contacts.map((contact) => this.toContact(contact)),
      leads: leads.map((lead) => this.toLead(lead)),
      opportunities: opportunities.map((opportunity) => this.toOpportunity(opportunity)),
      tasks: tasks.map((task) => this.toTask(task)),
      notes: notes.map((note) => this.toNote(note)),
      activities: activities.map((activity) => this.toActivity(activity)),
      customFieldDefinitions: customFieldDefinitions.map((definition) =>
        this.toCustomFieldDefinition(definition)
      )
    };
  }

  async listAccounts(tenantId: TenantId, query: ListQuery): Promise<Page<Account>> {
    const items = await this.prisma.account.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" as const } },
                { domain: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: query.limit
    });

    return this.page(items.map((item) => this.toAccount(item)), query.limit);
  }

  async createAccount(principal: AccessPrincipal, input: CreateAccountInput): Promise<Account> {
    assertCan(principal, "account", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: {
          id,
          tenantId: audit.tenantId,
          name: input.name,
          domain: input.domain ?? null,
          ownerUserId: input.ownerUserId ?? principal.user.id,
          status: input.status,
          customFields: this.asJson(input.customFields),
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "account.created", "account", id, principal, now, {
        name: input.name
      });
      return created;
    });

    return this.toAccount(account);
  }

  async listContacts(tenantId: TenantId, query: ListQuery): Promise<Page<Contact>> {
    const items = await this.prisma.contact.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { firstName: { contains: query.q, mode: "insensitive" as const } },
                { lastName: { contains: query.q, mode: "insensitive" as const } },
                { email: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toContact(item)), query.limit);
  }

  async createContact(principal: AccessPrincipal, input: CreateContactInput): Promise<Contact> {
    assertCan(principal, "contact", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const contact = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          id,
          tenantId: audit.tenantId,
          accountId: input.accountId ?? null,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          ownerUserId: input.ownerUserId ?? principal.user.id,
          customFields: this.asJson(input.customFields),
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "contact.created", "contact", id, principal, now, {
        email: input.email ?? null
      });
      return created;
    });

    return this.toContact(contact);
  }

  async listLeads(tenantId: TenantId, query: ListQuery): Promise<Page<Lead>> {
    const items = await this.prisma.lead.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { source: { contains: query.q, mode: "insensitive" as const } },
                { companyName: { contains: query.q, mode: "insensitive" as const } },
                { contactName: { contains: query.q, mode: "insensitive" as const } },
                { email: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      take: query.limit
    });

    return this.page(items.map((item) => this.toLead(item)), query.limit);
  }

  async createLead(principal: AccessPrincipal, input: CreateLeadInput): Promise<Lead> {
    assertCan(principal, "lead", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          id,
          tenantId: audit.tenantId,
          source: input.source,
          companyName: input.companyName ?? null,
          contactName: input.contactName,
          email: input.email ?? null,
          status: input.status,
          customFields: this.asJson(input.customFields),
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "lead.created", "lead", id, principal, now, {
        source: input.source
      });
      return created;
    });

    return this.toLead(lead);
  }

  async convertLead(input: {
    principal: AccessPrincipal;
    id: string;
    body: ConvertLeadInput;
    idempotencyKey?: string | undefined;
  }): Promise<LeadConversionResult> {
    const route = `POST /v1/leads/${input.id}/convert`;
    const requestHash = this.hashRequest(input.body);

    if (input.idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          tenantId_route_key: {
            tenantId: input.principal.tenantId,
            route,
            key: input.idempotencyKey
          }
        }
      });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new Error("Idempotency key reused with a different request");
        }
        return existing.response as unknown as LeadConversionResult;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.lead.findFirst({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          archivedAt: null
        }
      });

      if (!currentRecord) {
        throw new Error("Lead not found");
      }

      const current = this.toLead(currentRecord);
      assertCan(input.principal, "lead", "update", { tenantId: input.principal.tenantId });
      assertCan(input.principal, "contact", "create", { tenantId: input.principal.tenantId });
      const now = new Date();
      const audit = createAuditFields({
        tenantId: input.principal.tenantId,
        actorUserId: input.principal.user.id,
        now: now.toISOString()
      });

      const account = input.body.accountId
        ? await tx.account.findFirst({
            where: {
              id: input.body.accountId,
              tenantId: input.principal.tenantId,
              archivedAt: null
            }
          })
        : await this.createAccountForLeadConversion(tx, input.principal, input.body.accountName!, now);

      if (!account) {
        throw new Error("Account not found");
      }

      const fallbackName = splitLeadName(current.contactName);
      const contact = await tx.contact.create({
        data: {
          id: randomUUID(),
          tenantId: audit.tenantId,
          accountId: account.id,
          firstName: input.body.contactFirstName ?? fallbackName.firstName,
          lastName: input.body.contactLastName ?? fallbackName.lastName,
          email: current.email ?? null,
          ownerUserId: input.principal.user.id,
          customFields: this.asJson({}),
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "contact.created", "contact", contact.id, input.principal, now, {
        email: contact.email ?? null,
        leadId: current.id
      });

      const opportunity = input.body.opportunity
        ? await this.createOpportunityForLeadConversion(
            tx,
            input.principal,
            account.id,
            contact.id,
            input.body.opportunity,
            now
          )
        : null;
      const updatedLead = convertLeadRule({
        lead: current,
        actorUserId: input.principal.user.id,
        expectedVersion: input.body.expectedVersion,
        now: now.toISOString(),
        convertedAccountId: account.id,
        convertedContactId: contact.id,
        convertedOpportunityId: opportunity?.id ?? null
      });

      const result = await tx.lead.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion,
          archivedAt: null
        },
        data: {
          status: updatedLead.status,
          convertedAt: now,
          convertedAccountId: account.id,
          convertedContactId: contact.id,
          convertedOpportunityId: opportunity?.id ?? null,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: updatedLead.version
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persistedLead = await tx.lead.findUniqueOrThrow({
        where: { id: input.id }
      });
      const response: LeadConversionResult = {
        lead: this.toLead(persistedLead),
        account: this.toAccount(account),
        contact: this.toContact(contact),
        opportunity: opportunity ? this.toOpportunity(opportunity) : null
      };

      await this.enqueueEvent(tx, "lead.converted", "lead", response.lead.id, input.principal, now, {
        accountId: account.id,
        contactId: contact.id,
        opportunityId: opportunity?.id ?? null
      });

      if (input.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            tenantId: input.principal.tenantId,
            route,
            key: input.idempotencyKey,
            requestHash,
            response: this.asJson(response),
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
      }

      return response;
    });
  }

  async listOpportunities(tenantId: TenantId, query: ListQuery): Promise<Page<Opportunity>> {
    const items = await this.prisma.opportunity.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" as const } },
                { currency: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ expectedCloseDate: "asc" }, { updatedAt: "desc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toOpportunity(item)), query.limit);
  }

  async createOpportunity(
    principal: AccessPrincipal,
    input: CreateOpportunityInput
  ): Promise<Opportunity> {
    assertCan(principal, "opportunity", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const opportunity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          id,
          tenantId: audit.tenantId,
          accountId: input.accountId,
          primaryContactId: input.primaryContactId ?? null,
          name: input.name,
          stage: input.stage,
          amount: input.amount ?? null,
          currency: input.currency,
          expectedCloseDate: input.expectedCloseDate ? this.dateFromDateOnly(input.expectedCloseDate) : null,
          ownerUserId: input.ownerUserId,
          probabilityPct: input.probabilityPct ?? null,
          customFields: this.asJson(input.customFields),
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "opportunity.created", "opportunity", id, principal, now, {
        stage: input.stage,
        amount: input.amount ?? null
      });
      return created;
    });

    return this.toOpportunity(opportunity);
  }

  async updateOpportunity(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateOpportunityInput;
    idempotencyKey?: string | undefined;
  }): Promise<Opportunity> {
    const route = `PATCH /v1/opportunities/${input.id}`;
    const requestHash = this.hashRequest(input.body);

    if (input.idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          tenantId_route_key: {
            tenantId: input.principal.tenantId,
            route,
            key: input.idempotencyKey
          }
        }
      });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new Error("Idempotency key reused with a different request");
        }
        return existing.response as unknown as Opportunity;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.opportunity.findFirst({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          archivedAt: null
        }
      });

      if (!currentRecord) {
        throw new Error("Opportunity not found");
      }

      const current = this.toOpportunity(currentRecord);
      assertCan(input.principal, "opportunity", "update", targetFromRecord(current));
      const now = new Date();

      let updated =
        input.body.stage && input.body.stage !== current.stage
          ? changeOpportunityStage({
              opportunity: current,
              nextStage: input.body.stage,
              actorUserId: input.principal.user.id,
              expectedVersion: input.body.expectedVersion,
              now: now.toISOString()
            })
          : {
              ...current,
              updatedAt: now.toISOString(),
              updatedBy: input.principal.user.id,
              version: this.assertExpectedVersion(current, input.body.expectedVersion) + 1
            };

      if ("amount" in input.body) {
        updated = { ...updated, amount: input.body.amount };
      }

      if ("expectedCloseDate" in input.body) {
        updated = { ...updated, expectedCloseDate: input.body.expectedCloseDate };
      }

      if ("probabilityPct" in input.body) {
        updated = { ...updated, probabilityPct: input.body.probabilityPct };
      }

      if (input.body.customFields) {
        updated = {
          ...updated,
          customFields: {
            ...updated.customFields,
            ...input.body.customFields
          }
        };
      }

      const result = await tx.opportunity.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion,
          archivedAt: null
        },
        data: {
          stage: updated.stage,
          amount: updated.amount ?? null,
          expectedCloseDate: updated.expectedCloseDate
            ? this.dateFromDateOnly(updated.expectedCloseDate)
            : null,
          probabilityPct: updated.probabilityPct ?? null,
          customFields: this.asJson(updated.customFields),
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: updated.version
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.opportunity.findUniqueOrThrow({
        where: { id: input.id }
      });
      const response = this.toOpportunity(persisted);

      await this.enqueueEvent(
        tx,
        "opportunity.stage_changed",
        "opportunity",
        response.id,
        input.principal,
        now,
        {
          fromStage: current.stage,
          toStage: response.stage,
          version: response.version
        }
      );

      if (input.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            tenantId: input.principal.tenantId,
            route,
            key: input.idempotencyKey,
            requestHash,
            response: this.asJson(response),
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
      }

      return response;
    });
  }

  async listTasks(tenantId: TenantId, query: ListQuery): Promise<Page<Task>> {
    const items = await this.prisma.task.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" as const } },
                { description: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toTask(item)), query.limit);
  }

  async createTask(principal: AccessPrincipal, input: CreateTaskInput): Promise<Task> {
    assertCan(principal, "task", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          id,
          tenantId: audit.tenantId,
          parentType: input.parent?.type ?? null,
          parentId: input.parent?.id ?? null,
          title: input.title,
          description: input.description ?? null,
          status: "open",
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          assignedUserId: input.assignedUserId,
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "task.created", "task", id, principal, now, {
        title: input.title
      });
      return created;
    });

    return this.toTask(task);
  }

  async completeTask(input: {
    principal: AccessPrincipal;
    id: string;
    expectedVersion: number;
  }): Promise<Task> {
    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.task.findFirst({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          archivedAt: null
        }
      });

      if (!currentRecord) {
        throw new Error("Task not found");
      }

      const current = this.toTask(currentRecord);
      assertCan(input.principal, "task", "update", targetFromRecord(current));
      const now = new Date();
      const updated = completeTaskRule({
        task: current,
        actorUserId: input.principal.user.id,
        expectedVersion: input.expectedVersion,
        now: now.toISOString()
      });

      const result = await tx.task.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.expectedVersion,
          archivedAt: null
        },
        data: {
          status: updated.status,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: updated.version
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.task.findUniqueOrThrow({
        where: { id: input.id }
      });
      const response = this.toTask(persisted);

      await this.enqueueEvent(tx, "task.completed", "task", response.id, input.principal, now, {
        version: response.version
      });

      return response;
    });
  }

  async appendNote(principal: AccessPrincipal, input: AppendNoteInput): Promise<Note> {
    assertCan(principal, "note", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          id,
          tenantId: audit.tenantId,
          parentType: input.parent.type,
          parentId: input.parent.id,
          body: input.body,
          bodyFormat: input.bodyFormat,
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "note.appended", "note", id, principal, now, {
        parent: input.parent
      });
      return created;
    });

    return this.toNote(note);
  }

  async listActivities(tenantId: TenantId, query: ListQuery): Promise<Page<Activity>> {
    const items = await this.prisma.activity.findMany({
      where: {
        tenantId,
        ...(query.q
          ? {
              OR: [
                { subject: { contains: query.q, mode: "insensitive" as const } },
                { kind: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: { occurredAt: "desc" },
      take: query.limit
    });

    return this.page(items.map((item) => this.toActivity(item)), query.limit);
  }

  async createActivity(principal: AccessPrincipal, input: CreateActivityInput): Promise<Activity> {
    assertCan(principal, "activity", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : now;
    const id = randomUUID();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.activity.create({
        data: {
          id,
          tenantId: audit.tenantId,
          parentType: input.parent.type,
          parentId: input.parent.id,
          kind: input.type,
          subject: input.subject,
          occurredAt,
          payload: input.payload as Prisma.InputJsonObject,
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "activity.logged", "activity", id, principal, now, {
        parent: input.parent,
        type: input.type
      });
      return created;
    });

    return this.toActivity(activity);
  }

  async listCustomFieldDefinitions(tenantId: TenantId): Promise<CustomFieldDefinition[]> {
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { tenantId },
      orderBy: [{ entityType: "asc" }, { key: "asc" }]
    });

    return definitions.map((definition) => this.toCustomFieldDefinition(definition));
  }

  async createCustomFieldDefinition(
    principal: AccessPrincipal,
    input: CreateCustomFieldDefinitionInput
  ): Promise<CustomFieldDefinition> {
    assertCan(principal, "custom_field", "create", { tenantId: principal.tenantId });
    const key = normalizeCustomFieldKey(input.key ?? input.label);
    const now = new Date();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });
    const candidate: CustomFieldDefinition = {
      id: randomUUID(),
      entityType: input.entityType,
      key,
      label: input.label.trim(),
      fieldType: input.fieldType,
      required: input.required,
      isIndexed: input.isIndexed,
      schema: input.schema,
      ...audit
    };
    assertValidCustomFieldDefinition(candidate);

    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: {
        tenantId_entityType_key: {
          tenantId: principal.tenantId,
          entityType: input.entityType,
          key
        }
      }
    });

    if (existing) {
      throw new Error("Custom field key already exists");
    }

    const definition = await this.prisma.customFieldDefinition.create({
      data: {
        id: candidate.id,
        tenantId: candidate.tenantId,
        entityType: candidate.entityType,
        key: candidate.key,
        label: candidate.label,
        fieldType: candidate.fieldType,
        required: candidate.required,
        isIndexed: candidate.isIndexed,
        schema: this.asJson(candidate.schema ?? {}),
        createdAt: now,
        updatedAt: now,
        createdBy: candidate.createdBy,
        updatedBy: candidate.updatedBy,
        version: candidate.version
      }
    });

    return this.toCustomFieldDefinition(definition);
  }

  async updateCustomFieldValues(input: {
    principal: AccessPrincipal;
    entityType: RecordEntityType;
    id: string;
    body: UpdateCustomFieldValuesInput;
    idempotencyKey?: string | undefined;
  }): Promise<CustomFieldValueUpdateResult> {
    const route = `PATCH /v1/custom-field-values/${input.entityType}/${input.id}`;
    const requestHash = this.hashRequest(input.body);

    if (input.idempotencyKey) {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          tenantId_route_key: {
            tenantId: input.principal.tenantId,
            route,
            key: input.idempotencyKey
          }
        }
      });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new Error("Idempotency key reused with a different request");
        }
        return existing.response as unknown as CustomFieldValueUpdateResult;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const definitions = await tx.customFieldDefinition.findMany({
        where: {
          tenantId: input.principal.tenantId,
          entityType: input.entityType
        }
      });
      validateCustomFieldPatch(
        definitions.map((definition) => this.toCustomFieldDefinition(definition)),
        input.body.customFields
      );

      const now = new Date();
      const response = await this.updateCustomFieldRecord(tx, input, now);

      if (input.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            tenantId: input.principal.tenantId,
            route,
            key: input.idempotencyKey,
            requestHash,
            response: this.asJson(response),
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
      }

      return response;
    });
  }

  async search(tenantId: TenantId, query: SearchQuery): Promise<SearchResult[]> {
    const [accounts, contacts, leads, opportunities] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          tenantId,
          archivedAt: null,
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { domain: { contains: query.q, mode: "insensitive" } }
          ]
        },
        take: query.limit
      }),
      this.prisma.contact.findMany({
        where: {
          tenantId,
          archivedAt: null,
          OR: [
            { firstName: { contains: query.q, mode: "insensitive" } },
            { lastName: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } }
          ]
        },
        take: query.limit
      }),
      this.prisma.lead.findMany({
        where: {
          tenantId,
          archivedAt: null,
          OR: [
            { companyName: { contains: query.q, mode: "insensitive" } },
            { contactName: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } }
          ]
        },
        take: query.limit
      }),
      this.prisma.opportunity.findMany({
        where: {
          tenantId,
          archivedAt: null,
          name: { contains: query.q, mode: "insensitive" }
        },
        take: query.limit
      })
    ]);

    return [
      ...accounts.map((account) => ({
        type: "account" as const,
        id: account.id,
        label: account.name,
        description: account.domain ?? account.status
      })),
      ...contacts.map((contact) => ({
        type: "contact" as const,
        id: contact.id,
        label: `${contact.firstName} ${contact.lastName}`,
        description: contact.email ?? undefined
      })),
      ...leads.map((lead) => ({
        type: "lead" as const,
        id: lead.id,
        label: lead.contactName,
        description: lead.companyName ?? lead.email ?? undefined
      })),
      ...opportunities.map((opportunity) => ({
        type: "opportunity" as const,
        id: opportunity.id,
        label: opportunity.name,
        description: opportunity.stage
      }))
    ].slice(0, query.limit);
  }

  async listWebhookSubscriptions(tenantId: TenantId): Promise<WebhookSubscription[]> {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });

    return subscriptions.map((subscription) => this.toWebhookSubscription(subscription));
  }

  async createWebhookSubscription(
    principal: AccessPrincipal,
    input: CreateWebhookSubscriptionInput
  ): Promise<CreateWebhookSubscriptionResponse> {
    assertCan(principal, "admin", "manage", { tenantId: principal.tenantId });
    const signingSecret = input.signingSecret ?? randomBytes(32).toString("hex");
    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        tenantId: principal.tenantId,
        url: input.url,
        eventTypes: input.eventTypes,
        isActive: true,
        secretHash: this.hashSecret(signingSecret),
        secretEncrypted: signingSecret
      }
    });

    return {
      ...this.toWebhookSubscription(subscription),
      eventTypes: input.eventTypes,
      signingSecret
    };
  }

  async activeWebhookSubscriptions(
    tenantId: TenantId,
    eventType: OutboxEvent["type"]
  ): Promise<WebhookDeliveryTarget[]> {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { eventTypes: { has: eventType } },
          { eventTypes: { has: "*" } }
        ]
      },
      orderBy: { createdAt: "asc" }
    });

    return subscriptions.map((subscription) => this.toWebhookDeliveryTarget(subscription));
  }

  async pendingOutbox(limit: number): Promise<OutboxEvent[]> {
    const now = new Date();
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: { in: ["pending", "failed"] },
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: now } }
        ]
      },
      orderBy: { occurredAt: "asc" },
      take: limit
    });

    return events.map((event) => this.toOutboxEvent(event));
  }

  async markOutboxDelivered(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
        lastError: null,
        nextAttemptAt: null
      }
    });
  }

  async markOutboxFailed(id: string, error: string, nextAttemptAt: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        nextAttemptAt: new Date(nextAttemptAt),
        lastError: error.slice(0, 1_000)
      }
    });
  }

  private async updateCustomFieldRecord(
    tx: PrismaTransaction,
    input: {
      principal: AccessPrincipal;
      entityType: RecordEntityType;
      id: string;
      body: UpdateCustomFieldValuesInput;
    },
    now: Date
  ): Promise<CustomFieldValueUpdateResult> {
    switch (input.entityType) {
      case "account": {
        const currentRecord = await tx.account.findFirst({
          where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
        });
        if (!currentRecord) {
          throw new Error("account not found");
        }
        const current = this.toAccount(currentRecord);
        assertCan(input.principal, "account", "update", targetFromRecord(current));
        const customFields = { ...current.customFields, ...input.body.customFields };
        const version = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
        const result = await tx.account.updateMany({
          where: {
            id: input.id,
            tenantId: input.principal.tenantId,
            version: input.body.expectedVersion,
            archivedAt: null
          },
          data: {
            customFields: this.asJson(customFields),
            updatedAt: now,
            updatedBy: input.principal.user.id,
            version
          }
        });
        if (result.count !== 1) {
          throw new Error("Version conflict");
        }
        return this.toAccount(await tx.account.findUniqueOrThrow({ where: { id: input.id } }));
      }
      case "contact": {
        const currentRecord = await tx.contact.findFirst({
          where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
        });
        if (!currentRecord) {
          throw new Error("contact not found");
        }
        const current = this.toContact(currentRecord);
        assertCan(input.principal, "contact", "update", targetFromRecord(current));
        const customFields = { ...current.customFields, ...input.body.customFields };
        const version = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
        const result = await tx.contact.updateMany({
          where: {
            id: input.id,
            tenantId: input.principal.tenantId,
            version: input.body.expectedVersion,
            archivedAt: null
          },
          data: {
            customFields: this.asJson(customFields),
            updatedAt: now,
            updatedBy: input.principal.user.id,
            version
          }
        });
        if (result.count !== 1) {
          throw new Error("Version conflict");
        }
        return this.toContact(await tx.contact.findUniqueOrThrow({ where: { id: input.id } }));
      }
      case "lead": {
        const currentRecord = await tx.lead.findFirst({
          where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
        });
        if (!currentRecord) {
          throw new Error("lead not found");
        }
        const current = this.toLead(currentRecord);
        assertCan(input.principal, "lead", "update", targetFromRecord(current));
        const customFields = { ...current.customFields, ...input.body.customFields };
        const version = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
        const result = await tx.lead.updateMany({
          where: {
            id: input.id,
            tenantId: input.principal.tenantId,
            version: input.body.expectedVersion,
            archivedAt: null
          },
          data: {
            customFields: this.asJson(customFields),
            updatedAt: now,
            updatedBy: input.principal.user.id,
            version
          }
        });
        if (result.count !== 1) {
          throw new Error("Version conflict");
        }
        return this.toLead(await tx.lead.findUniqueOrThrow({ where: { id: input.id } }));
      }
      case "opportunity": {
        const currentRecord = await tx.opportunity.findFirst({
          where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
        });
        if (!currentRecord) {
          throw new Error("opportunity not found");
        }
        const current = this.toOpportunity(currentRecord);
        assertCan(input.principal, "opportunity", "update", targetFromRecord(current));
        const customFields = { ...current.customFields, ...input.body.customFields };
        const version = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
        const result = await tx.opportunity.updateMany({
          where: {
            id: input.id,
            tenantId: input.principal.tenantId,
            version: input.body.expectedVersion,
            archivedAt: null
          },
          data: {
            customFields: this.asJson(customFields),
            updatedAt: now,
            updatedBy: input.principal.user.id,
            version
          }
        });
        if (result.count !== 1) {
          throw new Error("Version conflict");
        }
        return this.toOpportunity(
          await tx.opportunity.findUniqueOrThrow({ where: { id: input.id } })
        );
      }
    }
  }

  private toUser(user: UserWithRoles): User {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      roleIds: user.roles.map((userRole) => userRole.roleId),
      teamIds: [],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      createdBy: user.createdBy ?? user.id,
      updatedBy: user.updatedBy ?? user.id,
      version: user.version,
      archivedAt: user.archivedAt?.toISOString()
    };
  }

  private toRole(role: RoleWithPermissions): Role {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      permissions: role.permissions.map(({ permission }) => this.toPermission(permission)),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
      createdBy: role.createdBy ?? role.id,
      updatedBy: role.updatedBy ?? role.id,
      version: role.version
    };
  }

  private toPermission(permission: Prisma.PermissionGetPayload<object>): Permission {
    return {
      id: permission.id,
      resource: permission.resource as PermissionResource,
      action: permission.action as PermissionAction,
      condition:
        permission.conditionKey && permission.conditionKey !== "none"
          ? (permission.conditionKey as PermissionCondition)
          : undefined
    };
  }

  private toAccount(account: Prisma.AccountGetPayload<object>): Account {
    return {
      id: account.id,
      tenantId: account.tenantId,
      name: account.name,
      domain: account.domain,
      ownerUserId: account.ownerUserId,
      status: account.status,
      customFields: this.customFields(account.customFields),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      createdBy: account.createdBy,
      updatedBy: account.updatedBy,
      version: account.version,
      archivedAt: account.archivedAt?.toISOString()
    };
  }

  private toContact(contact: Prisma.ContactGetPayload<object>): Contact {
    return {
      id: contact.id,
      tenantId: contact.tenantId,
      accountId: contact.accountId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      ownerUserId: contact.ownerUserId,
      customFields: this.customFields(contact.customFields),
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      createdBy: contact.createdBy,
      updatedBy: contact.updatedBy,
      version: contact.version,
      archivedAt: contact.archivedAt?.toISOString()
    };
  }

  private toLead(lead: Prisma.LeadGetPayload<object>): Lead {
    return {
      id: lead.id,
      tenantId: lead.tenantId,
      source: lead.source,
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      status: lead.status,
      convertedAt: lead.convertedAt?.toISOString(),
      convertedAccountId: lead.convertedAccountId,
      convertedContactId: lead.convertedContactId,
      convertedOpportunityId: lead.convertedOpportunityId,
      customFields: this.customFields(lead.customFields),
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      createdBy: lead.createdBy,
      updatedBy: lead.updatedBy,
      version: lead.version,
      archivedAt: lead.archivedAt?.toISOString()
    };
  }

  private toOpportunity(opportunity: Prisma.OpportunityGetPayload<object>): Opportunity {
    return {
      id: opportunity.id,
      tenantId: opportunity.tenantId,
      accountId: opportunity.accountId,
      primaryContactId: opportunity.primaryContactId,
      name: opportunity.name,
      stage: opportunity.stage,
      amount: opportunity.amount?.toNumber() ?? null,
      currency: opportunity.currency,
      expectedCloseDate: this.dateOnly(opportunity.expectedCloseDate),
      ownerUserId: opportunity.ownerUserId,
      probabilityPct: opportunity.probabilityPct,
      customFields: this.customFields(opportunity.customFields),
      createdAt: opportunity.createdAt.toISOString(),
      updatedAt: opportunity.updatedAt.toISOString(),
      createdBy: opportunity.createdBy,
      updatedBy: opportunity.updatedBy,
      version: opportunity.version,
      archivedAt: opportunity.archivedAt?.toISOString()
    };
  }

  private toTask(task: Prisma.TaskGetPayload<object>): Task {
    return {
      id: task.id,
      tenantId: task.tenantId,
      parent:
        task.parentType && task.parentId
          ? { type: task.parentType as CRMEntityType, id: task.parentId }
          : undefined,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString(),
      assignedUserId: task.assignedUserId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdBy: task.createdBy,
      updatedBy: task.updatedBy,
      version: task.version,
      archivedAt: task.archivedAt?.toISOString()
    };
  }

  private toNote(note: Prisma.NoteGetPayload<object>): Note {
    return {
      id: note.id,
      tenantId: note.tenantId,
      parent: { type: note.parentType as CRMEntityType, id: note.parentId },
      body: note.body,
      bodyFormat: note.bodyFormat as Note["bodyFormat"],
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      createdBy: note.createdBy,
      updatedBy: note.updatedBy,
      version: note.version
    };
  }

  private toActivity(activity: Prisma.ActivityGetPayload<object>): Activity {
    return {
      id: activity.id,
      tenantId: activity.tenantId,
      parent: { type: activity.parentType as CRMEntityType, id: activity.parentId },
      type: activity.kind as Activity["type"],
      subject: activity.subject,
      occurredAt: activity.occurredAt.toISOString(),
      payload: activity.payload as Record<string, unknown>,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      createdBy: activity.createdBy,
      updatedBy: activity.updatedBy,
      version: activity.version
    };
  }

  private toCustomFieldDefinition(
    definition: Prisma.CustomFieldDefinitionGetPayload<object>
  ): CustomFieldDefinition {
    return {
      id: definition.id,
      tenantId: definition.tenantId,
      entityType: definition.entityType as RecordEntityType,
      key: definition.key,
      label: definition.label,
      fieldType: definition.fieldType as CustomFieldDefinition["fieldType"],
      required: definition.required,
      isIndexed: definition.isIndexed,
      schema: definition.schema as Record<string, unknown>,
      createdAt: definition.createdAt.toISOString(),
      updatedAt: definition.updatedAt.toISOString(),
      createdBy: definition.createdBy,
      updatedBy: definition.updatedBy,
      version: definition.version
    };
  }

  private toOutboxEvent(event: Prisma.OutboxEventGetPayload<object>): OutboxEvent {
    return {
      id: event.id,
      tenantId: event.tenantId,
      type: event.type as DomainEventType,
      entity: {
        type: event.entityType as CRMEntityType,
        id: event.entityId
      },
      actorUserId: event.actorUserId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload as Record<string, unknown>,
      status: event.status,
      attempts: event.attempts,
      nextAttemptAt: event.nextAttemptAt?.toISOString() ?? null,
      deliveredAt: event.deliveredAt?.toISOString() ?? null,
      lastError: event.lastError
    };
  }

  private toWebhookSubscription(
    subscription: Prisma.WebhookSubscriptionGetPayload<object>
  ): WebhookSubscription {
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      url: subscription.url,
      eventTypes: subscription.eventTypes,
      isActive: subscription.isActive,
      secretFingerprint: subscription.secretHash,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      lastErrorAt: subscription.lastErrorAt?.toISOString() ?? null,
      lastError: subscription.lastError
    };
  }

  private toWebhookDeliveryTarget(
    subscription: Prisma.WebhookSubscriptionGetPayload<object>
  ): WebhookDeliveryTarget {
    return {
      ...this.toWebhookSubscription(subscription),
      signingSecret: subscription.secretEncrypted
    };
  }

  private async createAccountForLeadConversion(
    tx: PrismaTransaction,
    principal: AccessPrincipal,
    name: string,
    now: Date
  ): Promise<Prisma.AccountGetPayload<object>> {
    assertCan(principal, "account", "create", { tenantId: principal.tenantId });
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });
    const account = await tx.account.create({
      data: {
        id: randomUUID(),
        tenantId: audit.tenantId,
        name,
        ownerUserId: principal.user.id,
        status: "prospect",
        customFields: this.asJson({}),
        createdAt: now,
        updatedAt: now,
        createdBy: audit.createdBy,
        updatedBy: audit.updatedBy,
        version: audit.version
      }
    });

    await this.enqueueEvent(tx, "account.created", "account", account.id, principal, now, {
      name
    });
    return account;
  }

  private async createOpportunityForLeadConversion(
    tx: PrismaTransaction,
    principal: AccessPrincipal,
    accountId: string,
    contactId: string,
    input: NonNullable<ConvertLeadInput["opportunity"]>,
    now: Date
  ): Promise<Prisma.OpportunityGetPayload<object>> {
    assertCan(principal, "opportunity", "create", { tenantId: principal.tenantId });
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });
    const opportunity = await tx.opportunity.create({
      data: {
        id: randomUUID(),
        tenantId: audit.tenantId,
        accountId,
        primaryContactId: contactId,
        name: input.name,
        stage: input.stage,
        amount: input.amount ?? null,
        currency: input.currency,
        expectedCloseDate: input.expectedCloseDate
          ? this.dateFromDateOnly(input.expectedCloseDate)
          : null,
        ownerUserId: input.ownerUserId ?? principal.user.id,
        probabilityPct: input.probabilityPct ?? null,
        customFields: this.asJson(input.customFields),
        createdAt: now,
        updatedAt: now,
        createdBy: audit.createdBy,
        updatedBy: audit.updatedBy,
        version: audit.version
      }
    });

    await this.enqueueEvent(tx, "opportunity.created", "opportunity", opportunity.id, principal, now, {
      stage: opportunity.stage,
      amount: input.amount ?? null
    });
    return opportunity;
  }

  private page<T extends { id: string }>(items: T[], limit = 50): Page<T> {
    const pageItems = items.slice(0, limit);
    const lastItem = pageItems.at(-1);
    return {
      items: pageItems,
      pageInfo: {
        endCursor: lastItem?.id,
        hasNextPage: items.length > pageItems.length
      }
    };
  }

  private customFields(value: Prisma.JsonValue): Record<string, CustomFieldPrimitive> {
    return value as Record<string, CustomFieldPrimitive>;
  }

  private asJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private dateOnly(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private dateFromDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private assertExpectedVersion(record: { version: number }, expectedVersion: number): number {
    if (record.version !== expectedVersion) {
      throw new Error("Version conflict");
    }

    return record.version;
  }

  private hashRequest(body: unknown): string {
    return createHash("sha256").update(JSON.stringify(body)).digest("hex");
  }

  private hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  private async enqueueEvent(
    tx: PrismaTransaction,
    type: DomainEventType,
    entityType: CRMEntityType,
    entityId: string,
    principal: AccessPrincipal,
    occurredAt: Date,
    payload: Record<string, unknown>
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        tenantId: principal.tenantId,
        type,
        entityType,
        entityId,
        actorUserId: principal.user.id,
        occurredAt,
        payload: this.asJson(payload),
        status: "pending",
        attempts: 0
      }
    });
  }
}

function splitLeadName(contactName: string): { firstName: string; lastName: string } {
  const parts = contactName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() ?? "Unknown";
  const lastName = parts.length > 0 ? parts.join(" ") : "Unknown";
  return { firstName, lastName };
}
