import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  assertCan,
  assertConferenceEmailLawfulBasis,
  assertConferenceOutreachAllowed,
  assertValidCustomFieldDefinition,
  changeOpportunityStage,
  completeTask as completeTaskRule,
  convertLead as convertLeadRule,
  createAuditFields,
  normalizeCustomFieldKey,
  scoreConferenceProspect,
  targetFromRecord,
  validateCustomFieldPatch,
  type AccessPrincipal,
  type Account,
  type Activity,
  type Conference,
  type ConferenceCompany,
  type ConferenceMeeting,
  type ConferencePerson,
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
  CreateConferenceCompanyInput,
  CreateConferenceInput,
  CreateConferenceMeetingInput,
  CreateConferencePersonInput,
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
  ScoreConferencePersonInput,
  UpdateActivityInput,
  UpdateConferenceCompanyInput,
  UpdateConferenceInput,
  UpdateConferenceMeetingInput,
  UpdateConferencePersonInput,
  UpdateCustomFieldValuesInput,
  UpdateNoteInput,
  UpdateOpportunityInput,
  UpdateTaskInput
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
      conferences,
      conferenceCompanies,
      conferencePeople,
      conferenceMeetings,
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
      this.prisma.conference.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }]
      }),
      this.prisma.conferenceCompany.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ company: "asc" }]
      }),
      this.prisma.conferencePerson.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ totalScore: "desc" }, { updatedAt: "desc" }]
      }),
      this.prisma.conferenceMeeting.findMany({
        where: { tenantId, archivedAt: null },
        orderBy: [{ updatedAt: "desc" }]
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
      conferences: conferences.map((conference) => this.toConference(conference)),
      conferenceCompanies: conferenceCompanies.map((company) =>
        this.toConferenceCompany(company)
      ),
      conferencePeople: conferencePeople.map((person) => this.toConferencePerson(person)),
      conferenceMeetings: conferenceMeetings.map((meeting) =>
        this.toConferenceMeeting(meeting)
      ),
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
          tenantId: input.principal.tenantId
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
          version: input.body.expectedVersion
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
          tenantId: input.principal.tenantId
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
          version: input.body.expectedVersion
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

  async listConferences(tenantId: TenantId, query: ListQuery): Promise<Page<Conference>> {
    const items = await this.prisma.conference.findMany({
      where: {
        tenantId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" as const } },
                { location: { contains: query.q, mode: "insensitive" as const } },
                { audienceType: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toConference(item)), query.limit);
  }

  async createConference(
    principal: AccessPrincipal,
    input: CreateConferenceInput
  ): Promise<Conference> {
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const conference = await this.prisma.$transaction(async (tx) => {
      const created = await tx.conference.create({
        data: {
          id: randomUUID(),
          tenantId: audit.tenantId,
          name: input.name,
          startDate: this.dateFromDateOnly(input.startDate),
          endDate: input.endDate ? this.dateFromDateOnly(input.endDate) : null,
          location: input.location ?? null,
          website: input.website ?? null,
          audienceType: input.audienceType ?? null,
          organizerContact: input.organizerContact ?? null,
          sponsorPackageLink: input.sponsorPackageLink ?? null,
          appName: input.appName ?? null,
          attendeeAccessStatus: input.attendeeAccessStatus,
          sourceNotes: input.sourceNotes ?? null,
          createdAt: now,
          updatedAt: now,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
          version: audit.version
        }
      });
      await this.enqueueEvent(tx, "conference.created", "conference", created.id, principal, now, {
        name: created.name
      });
      return created;
    });

    return this.toConference(conference);
  }

  async updateConference(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateConferenceInput;
  }): Promise<Conference> {
    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.conference.findFirst({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          archivedAt: null
        }
      });

      if (!currentRecord) {
        throw new Error("Conference not found");
      }

      const current = this.toConference(currentRecord);
      assertCan(input.principal, "conference", "update", targetFromRecord(current));
      const now = new Date();
      const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
      const result = await tx.conference.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion,
          archivedAt: null
        },
        data: {
          name: input.body.name ?? current.name,
          startDate: input.body.startDate
            ? this.dateFromDateOnly(input.body.startDate)
            : this.dateFromDateOnly(current.startDate),
          endDate:
            input.body.endDate === undefined
              ? current.endDate
                ? this.dateFromDateOnly(current.endDate)
                : null
              : input.body.endDate
                ? this.dateFromDateOnly(input.body.endDate)
                : null,
          location: input.body.location === undefined ? current.location ?? null : input.body.location,
          website: input.body.website === undefined ? current.website ?? null : input.body.website,
          audienceType:
            input.body.audienceType === undefined
              ? current.audienceType ?? null
              : input.body.audienceType,
          organizerContact:
            input.body.organizerContact === undefined
              ? current.organizerContact ?? null
              : input.body.organizerContact,
          sponsorPackageLink:
            input.body.sponsorPackageLink === undefined
              ? current.sponsorPackageLink ?? null
              : input.body.sponsorPackageLink,
          appName: input.body.appName === undefined ? current.appName ?? null : input.body.appName,
          attendeeAccessStatus: input.body.attendeeAccessStatus ?? current.attendeeAccessStatus,
          sourceNotes:
            input.body.sourceNotes === undefined ? current.sourceNotes ?? null : input.body.sourceNotes,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: nextVersion
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.conference.findUniqueOrThrow({ where: { id: input.id } });
      const response = this.toConference(persisted);
      await this.enqueueEvent(tx, "conference.updated", "conference", response.id, input.principal, now, {
        version: response.version
      });
      return response;
    });
  }

  async listConferenceCompanies(
    tenantId: TenantId,
    conferenceId: string,
    query: ListQuery
  ): Promise<Page<ConferenceCompany>> {
    const items = await this.prisma.conferenceCompany.findMany({
      where: {
        tenantId,
        conferenceId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { company: { contains: query.q, mode: "insensitive" as const } },
                { website: { contains: query.q, mode: "insensitive" as const } },
                { sector: { contains: query.q, mode: "insensitive" as const } },
                { sourceUrl: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ companyScore: "desc" }, { company: "asc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toConferenceCompany(item)), query.limit);
  }

  async createConferenceCompany(
    principal: AccessPrincipal,
    conferenceId: string,
    input: CreateConferenceCompanyInput
  ): Promise<ConferenceCompany> {
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    const now = new Date();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    await this.assertConferenceExists(principal.tenantId, conferenceId);
    const company = await this.prisma.conferenceCompany.create({
      data: {
        id: randomUUID(),
        tenantId: audit.tenantId,
        conferenceId,
        accountId: input.accountId ?? null,
        company: input.company,
        website: input.website ?? null,
        conferenceRole: input.conferenceRole,
        sector: input.sector ?? null,
        rwaRelevance: input.rwaRelevance,
        privateMarketsRelevance: input.privateMarketsRelevance,
        fundraisingRelevance: input.fundraisingRelevance,
        marketEntryRelevance: input.marketEntryRelevance,
        partnershipRelevance: input.partnershipRelevance,
        companyScore: input.companyScore,
        sourceUrl: input.sourceUrl ?? null,
        sourceNotes: input.sourceNotes ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: audit.createdBy,
        updatedBy: audit.updatedBy,
        version: audit.version
      }
    });

    return this.toConferenceCompany(company);
  }

  async updateConferenceCompany(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateConferenceCompanyInput;
  }): Promise<ConferenceCompany> {
    const currentRecord = await this.prisma.conferenceCompany.findFirst({
      where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
    });

    if (!currentRecord) {
      throw new Error("Conference company not found");
    }

    const current = this.toConferenceCompany(currentRecord);
    assertCan(input.principal, "conference", "update", targetFromRecord(current));
    const now = new Date();
    const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
    const result = await this.prisma.conferenceCompany.updateMany({
      where: {
        id: input.id,
        tenantId: input.principal.tenantId,
        version: input.body.expectedVersion,
        archivedAt: null
      },
      data: {
        accountId: input.body.accountId === undefined ? current.accountId ?? null : input.body.accountId,
        company: input.body.company ?? current.company,
        website: input.body.website === undefined ? current.website ?? null : input.body.website,
        conferenceRole: input.body.conferenceRole ?? current.conferenceRole,
        sector: input.body.sector === undefined ? current.sector ?? null : input.body.sector,
        rwaRelevance: input.body.rwaRelevance ?? current.rwaRelevance,
        privateMarketsRelevance:
          input.body.privateMarketsRelevance ?? current.privateMarketsRelevance,
        fundraisingRelevance: input.body.fundraisingRelevance ?? current.fundraisingRelevance,
        marketEntryRelevance: input.body.marketEntryRelevance ?? current.marketEntryRelevance,
        partnershipRelevance: input.body.partnershipRelevance ?? current.partnershipRelevance,
        companyScore: input.body.companyScore ?? current.companyScore,
        sourceUrl: input.body.sourceUrl === undefined ? current.sourceUrl ?? null : input.body.sourceUrl,
        sourceNotes:
          input.body.sourceNotes === undefined ? current.sourceNotes ?? null : input.body.sourceNotes,
        updatedAt: now,
        updatedBy: input.principal.user.id,
        version: nextVersion
      }
    });

    if (result.count !== 1) {
      throw new Error("Version conflict");
    }

    return this.toConferenceCompany(
      await this.prisma.conferenceCompany.findUniqueOrThrow({ where: { id: input.id } })
    );
  }

  async listConferencePeople(
    tenantId: TenantId,
    conferenceId: string,
    query: ListQuery
  ): Promise<Page<ConferencePerson>> {
    const items = await this.prisma.conferencePerson.findMany({
      where: {
        tenantId,
        conferenceId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" as const } },
                { title: { contains: query.q, mode: "insensitive" as const } },
                { conferenceSignal: { contains: query.q, mode: "insensitive" as const } },
                { buyingSignal: { contains: query.q, mode: "insensitive" as const } },
                { relationshipPath: { contains: query.q, mode: "insensitive" as const } },
                { source: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ totalScore: "desc" }, { updatedAt: "desc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toConferencePerson(item)), query.limit);
  }

  async createConferencePerson(
    principal: AccessPrincipal,
    conferenceId: string,
    input: CreateConferencePersonInput
  ): Promise<ConferencePerson> {
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    await this.assertConferenceExists(principal.tenantId, conferenceId);
    assertConferenceEmailLawfulBasis(input);
    assertConferenceOutreachAllowed(input);
    const score = scoreConferenceProspect(input);
    const now = new Date();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const person = await this.prisma.conferencePerson.create({
      data: {
        id: randomUUID(),
        tenantId: audit.tenantId,
        conferenceId,
        conferenceCompanyId: input.conferenceCompanyId ?? null,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        name: input.name,
        title: input.title,
        linkedIn: input.linkedIn ?? null,
        email: input.email ?? null,
        conferenceSignal: input.conferenceSignal ?? null,
        icpCategory: input.icpCategory,
        buyingSignal: input.buyingSignal ?? null,
        relationshipPath: input.relationshipPath ?? null,
        outreachStatus: input.outreachStatus,
        sourceType: input.sourceType,
        source: input.source ?? null,
        lawfulBasisNotes: input.lawfulBasisNotes ?? null,
        optOutStatus: input.optOutStatus,
        seniorityScore: score.seniorityScore,
        companyFitScore: score.companyFitScore,
        signalScore: score.signalScore,
        conferenceSignalScore: score.conferenceSignalScore,
        warmIntroScore: score.warmIntroScore,
        timingScore: score.timingScore,
        totalScore: score.totalScore,
        priorityBand: score.priorityBand,
        createdAt: now,
        updatedAt: now,
        createdBy: audit.createdBy,
        updatedBy: audit.updatedBy,
        version: audit.version
      }
    });

    return this.toConferencePerson(person);
  }

  async updateConferencePerson(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateConferencePersonInput;
  }): Promise<ConferencePerson> {
    const currentRecord = await this.prisma.conferencePerson.findFirst({
      where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
    });

    if (!currentRecord) {
      throw new Error("Conference person not found");
    }

    const current = this.toConferencePerson(currentRecord);
    assertCan(input.principal, "conference", "update", targetFromRecord(current));
    const score = scoreConferenceProspect({
      seniorityScore: input.body.seniorityScore ?? current.seniorityScore,
      companyFitScore: input.body.companyFitScore ?? current.companyFitScore,
      signalScore: input.body.signalScore ?? current.signalScore,
      conferenceSignalScore:
        input.body.conferenceSignalScore ?? current.conferenceSignalScore,
      warmIntroScore: input.body.warmIntroScore ?? current.warmIntroScore,
      timingScore: input.body.timingScore ?? current.timingScore
    });
    const updatedCandidate: ConferencePerson = {
      ...current,
      conferenceCompanyId:
        input.body.conferenceCompanyId === undefined
          ? current.conferenceCompanyId
          : input.body.conferenceCompanyId,
      accountId: input.body.accountId === undefined ? current.accountId : input.body.accountId,
      contactId: input.body.contactId === undefined ? current.contactId : input.body.contactId,
      name: input.body.name ?? current.name,
      title: input.body.title ?? current.title,
      linkedIn: input.body.linkedIn === undefined ? current.linkedIn : input.body.linkedIn,
      email: input.body.email === undefined ? current.email : input.body.email,
      conferenceSignal:
        input.body.conferenceSignal === undefined
          ? current.conferenceSignal
          : input.body.conferenceSignal,
      icpCategory: input.body.icpCategory ?? current.icpCategory,
      buyingSignal:
        input.body.buyingSignal === undefined ? current.buyingSignal : input.body.buyingSignal,
      relationshipPath:
        input.body.relationshipPath === undefined
          ? current.relationshipPath
          : input.body.relationshipPath,
      outreachStatus: input.body.outreachStatus ?? current.outreachStatus,
      sourceType: input.body.sourceType ?? current.sourceType,
      source: input.body.source === undefined ? current.source : input.body.source,
      lawfulBasisNotes:
        input.body.lawfulBasisNotes === undefined
          ? current.lawfulBasisNotes
          : input.body.lawfulBasisNotes,
      optOutStatus: input.body.optOutStatus ?? current.optOutStatus,
      ...score
    };
    assertConferenceEmailLawfulBasis(updatedCandidate);
    assertConferenceOutreachAllowed(updatedCandidate);

    const now = new Date();
    const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
    const result = await this.prisma.conferencePerson.updateMany({
      where: {
        id: input.id,
        tenantId: input.principal.tenantId,
        version: input.body.expectedVersion,
        archivedAt: null
      },
      data: {
        conferenceCompanyId: updatedCandidate.conferenceCompanyId ?? null,
        accountId: updatedCandidate.accountId ?? null,
        contactId: updatedCandidate.contactId ?? null,
        name: updatedCandidate.name,
        title: updatedCandidate.title,
        linkedIn: updatedCandidate.linkedIn ?? null,
        email: updatedCandidate.email ?? null,
        conferenceSignal: updatedCandidate.conferenceSignal ?? null,
        icpCategory: updatedCandidate.icpCategory,
        buyingSignal: updatedCandidate.buyingSignal ?? null,
        relationshipPath: updatedCandidate.relationshipPath ?? null,
        outreachStatus: updatedCandidate.outreachStatus,
        sourceType: updatedCandidate.sourceType,
        source: updatedCandidate.source ?? null,
        lawfulBasisNotes: updatedCandidate.lawfulBasisNotes ?? null,
        optOutStatus: updatedCandidate.optOutStatus,
        seniorityScore: updatedCandidate.seniorityScore,
        companyFitScore: updatedCandidate.companyFitScore,
        signalScore: updatedCandidate.signalScore,
        conferenceSignalScore: updatedCandidate.conferenceSignalScore,
        warmIntroScore: updatedCandidate.warmIntroScore,
        timingScore: updatedCandidate.timingScore,
        totalScore: updatedCandidate.totalScore,
        priorityBand: updatedCandidate.priorityBand,
        updatedAt: now,
        updatedBy: input.principal.user.id,
        version: nextVersion
      }
    });

    if (result.count !== 1) {
      throw new Error("Version conflict");
    }

    return this.toConferencePerson(
      await this.prisma.conferencePerson.findUniqueOrThrow({ where: { id: input.id } })
    );
  }

  async scoreConferencePerson(input: {
    principal: AccessPrincipal;
    id: string;
    body: ScoreConferencePersonInput;
  }): Promise<ConferencePerson> {
    const person = await this.updateConferencePerson({
      principal: input.principal,
      id: input.id,
      body: {
        expectedVersion: input.body.expectedVersion,
        seniorityScore: input.body.seniorityScore,
        companyFitScore: input.body.companyFitScore,
        signalScore: input.body.signalScore,
        conferenceSignalScore: input.body.conferenceSignalScore,
        warmIntroScore: input.body.warmIntroScore,
        timingScore: input.body.timingScore
      }
    });
    await this.enqueueEvent(
      this.prisma,
      "conference_person.scored",
      "conference_person",
      person.id,
      input.principal,
      new Date(person.updatedAt),
      {
        totalScore: person.totalScore,
        priorityBand: person.priorityBand,
        scoreNotes: input.body.scoreNotes ?? null
      }
    );
    return person;
  }

  async listConferenceMeetings(
    tenantId: TenantId,
    conferenceId: string,
    query: ListQuery
  ): Promise<Page<ConferenceMeeting>> {
    const items = await this.prisma.conferenceMeeting.findMany({
      where: {
        tenantId,
        conferenceId,
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { reasonToMeet: { contains: query.q, mode: "insensitive" as const } },
                { proposedAsk: { contains: query.q, mode: "insensitive" as const } },
                { introPath: { contains: query.q, mode: "insensitive" as const } },
                { notes: { contains: query.q, mode: "insensitive" as const } },
                { nextStep: { contains: query.q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: [{ updatedAt: "desc" }],
      take: query.limit
    });

    return this.page(items.map((item) => this.toConferenceMeeting(item)), query.limit);
  }

  async createConferenceMeeting(
    principal: AccessPrincipal,
    conferenceId: string,
    input: CreateConferenceMeetingInput
  ): Promise<ConferenceMeeting> {
    assertCan(principal, "conference", "create", { tenantId: principal.tenantId });
    const person = await this.findConferencePerson(principal.tenantId, input.conferencePersonId);
    if (person.conferenceId !== conferenceId) {
      throw new Error("Conference person not found");
    }
    this.assertMeetingAllowed(person, input.status);
    const now = new Date();
    const audit = createAuditFields({
      tenantId: principal.tenantId,
      actorUserId: principal.user.id,
      now: now.toISOString()
    });

    const meeting = await this.prisma.conferenceMeeting.create({
      data: {
        id: randomUUID(),
        tenantId: audit.tenantId,
        conferenceId,
        conferencePersonId: input.conferencePersonId,
        reasonToMeet: input.reasonToMeet,
        proposedAsk: input.proposedAsk ?? null,
        introPath: input.introPath ?? null,
        status: input.status,
        notes: input.notes ?? null,
        nextStep: input.nextStep ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: audit.createdBy,
        updatedBy: audit.updatedBy,
        version: audit.version
      }
    });

    return this.toConferenceMeeting(meeting);
  }

  async updateConferenceMeeting(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateConferenceMeetingInput;
  }): Promise<ConferenceMeeting> {
    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.conferenceMeeting.findFirst({
        where: { id: input.id, tenantId: input.principal.tenantId, archivedAt: null }
      });

      if (!currentRecord) {
        throw new Error("Conference meeting not found");
      }

      const current = this.toConferenceMeeting(currentRecord);
      const person = await this.findConferencePerson(input.principal.tenantId, current.conferencePersonId);
      assertCan(input.principal, "conference", "update", targetFromRecord(current));
      this.assertMeetingAllowed(person, input.body.status ?? current.status);
      const now = new Date();
      const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;
      const result = await tx.conferenceMeeting.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion,
          archivedAt: null
        },
        data: {
          reasonToMeet: input.body.reasonToMeet ?? current.reasonToMeet,
          proposedAsk:
            input.body.proposedAsk === undefined ? current.proposedAsk ?? null : input.body.proposedAsk,
          introPath:
            input.body.introPath === undefined ? current.introPath ?? null : input.body.introPath,
          status: input.body.status ?? current.status,
          notes: input.body.notes === undefined ? current.notes ?? null : input.body.notes,
          nextStep: input.body.nextStep === undefined ? current.nextStep ?? null : input.body.nextStep,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: nextVersion
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.conferenceMeeting.findUniqueOrThrow({ where: { id: input.id } });
      const response = this.toConferenceMeeting(persisted);
      await this.enqueueEvent(
        tx,
        "conference_meeting.updated",
        "conference_meeting",
        response.id,
        input.principal,
        now,
        { status: response.status, version: response.version }
      );
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

  async updateTask(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateTaskInput;
    idempotencyKey?: string | undefined;
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
      const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;

      const result = await tx.task.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion,
          archivedAt: null
        },
        data: {
          title: input.body.title ?? current.title,
          description:
            input.body.description === undefined ? current.description ?? null : input.body.description,
          priority: input.body.priority ?? current.priority,
          dueAt:
            input.body.dueAt === undefined
              ? current.dueAt
                ? new Date(current.dueAt)
                : null
              : input.body.dueAt
                ? new Date(input.body.dueAt)
                : null,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: nextVersion
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.task.findUniqueOrThrow({
        where: { id: input.id }
      });
      const response = this.toTask(persisted);

      await this.enqueueEvent(tx, "task.updated", "task", response.id, input.principal, now, {
        version: response.version
      });

      return response;
    });
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

  async updateNote(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateNoteInput;
    idempotencyKey?: string | undefined;
  }): Promise<Note> {
    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.note.findFirst({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId
        }
      });

      if (!currentRecord) {
        throw new Error("Note not found");
      }

      const current = this.toNote(currentRecord);
      assertCan(input.principal, "note", "update", targetFromRecord(current));
      const now = new Date();
      const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;

      const result = await tx.note.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion
        },
        data: {
          body: input.body.body,
          bodyFormat: input.body.bodyFormat ?? current.bodyFormat,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: nextVersion
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.note.findUniqueOrThrow({
        where: { id: input.id }
      });
      const response = this.toNote(persisted);

      await this.enqueueEvent(tx, "note.updated", "note", response.id, input.principal, now, {
        version: response.version
      });

      return response;
    });
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

  async updateActivity(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateActivityInput;
    idempotencyKey?: string | undefined;
  }): Promise<Activity> {
    return this.prisma.$transaction(async (tx) => {
      const currentRecord = await tx.activity.findFirst({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId
        }
      });

      if (!currentRecord) {
        throw new Error("Activity not found");
      }

      const current = this.toActivity(currentRecord);
      assertCan(input.principal, "activity", "update", targetFromRecord(current));
      const now = new Date();
      const nextVersion = this.assertExpectedVersion(current, input.body.expectedVersion) + 1;

      const result = await tx.activity.updateMany({
        where: {
          id: input.id,
          tenantId: input.principal.tenantId,
          version: input.body.expectedVersion
        },
        data: {
          subject: input.body.subject ?? current.subject,
          payload: (input.body.payload ?? current.payload) as Prisma.InputJsonObject,
          updatedAt: now,
          updatedBy: input.principal.user.id,
          version: nextVersion
        }
      });

      if (result.count !== 1) {
        throw new Error("Version conflict");
      }

      const persisted = await tx.activity.findUniqueOrThrow({
        where: { id: input.id }
      });
      const response = this.toActivity(persisted);

      await this.enqueueEvent(tx, "activity.updated", "activity", response.id, input.principal, now, {
        version: response.version
      });

      return response;
    });
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
    const [accounts, contacts, leads, opportunities, conferences, conferenceCompanies, conferencePeople] =
      await Promise.all([
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
      }),
      this.prisma.conference.findMany({
        where: {
          tenantId,
          archivedAt: null,
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { location: { contains: query.q, mode: "insensitive" } },
            { audienceType: { contains: query.q, mode: "insensitive" } }
          ]
        },
        take: query.limit
      }),
      this.prisma.conferenceCompany.findMany({
        where: {
          tenantId,
          archivedAt: null,
          OR: [
            { company: { contains: query.q, mode: "insensitive" } },
            { sector: { contains: query.q, mode: "insensitive" } },
            { sourceUrl: { contains: query.q, mode: "insensitive" } }
          ]
        },
        take: query.limit
      }),
      this.prisma.conferencePerson.findMany({
        where: {
          tenantId,
          archivedAt: null,
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { title: { contains: query.q, mode: "insensitive" } },
            { buyingSignal: { contains: query.q, mode: "insensitive" } },
            { conferenceSignal: { contains: query.q, mode: "insensitive" } }
          ]
        },
        orderBy: [{ totalScore: "desc" }],
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
      })),
      ...conferences.map((conference) => ({
        type: "conference" as const,
        id: conference.id,
        label: conference.name,
        description: conference.location ?? conference.audienceType ?? conference.attendeeAccessStatus
      })),
      ...conferenceCompanies.map((company) => ({
        type: "conference_company" as const,
        id: company.id,
        label: company.company,
        description: company.sector ?? company.conferenceRole
      })),
      ...conferencePeople.map((person) => ({
        type: "conference_person" as const,
        id: person.id,
        label: person.name,
        description: `${person.title} / ${person.priorityBand}`
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

  private toConference(conference: Prisma.ConferenceGetPayload<object>): Conference {
    return {
      id: conference.id,
      tenantId: conference.tenantId,
      name: conference.name,
      startDate: this.dateOnly(conference.startDate) ?? conference.startDate.toISOString(),
      endDate: this.dateOnly(conference.endDate),
      location: conference.location,
      website: conference.website,
      audienceType: conference.audienceType,
      organizerContact: conference.organizerContact,
      sponsorPackageLink: conference.sponsorPackageLink,
      appName: conference.appName,
      attendeeAccessStatus: conference.attendeeAccessStatus,
      sourceNotes: conference.sourceNotes,
      createdAt: conference.createdAt.toISOString(),
      updatedAt: conference.updatedAt.toISOString(),
      createdBy: conference.createdBy,
      updatedBy: conference.updatedBy,
      version: conference.version,
      archivedAt: conference.archivedAt?.toISOString()
    };
  }

  private toConferenceCompany(
    company: Prisma.ConferenceCompanyGetPayload<object>
  ): ConferenceCompany {
    return {
      id: company.id,
      tenantId: company.tenantId,
      conferenceId: company.conferenceId,
      accountId: company.accountId,
      company: company.company,
      website: company.website,
      conferenceRole: company.conferenceRole,
      sector: company.sector,
      rwaRelevance: company.rwaRelevance,
      privateMarketsRelevance: company.privateMarketsRelevance,
      fundraisingRelevance: company.fundraisingRelevance,
      marketEntryRelevance: company.marketEntryRelevance,
      partnershipRelevance: company.partnershipRelevance,
      companyScore: company.companyScore,
      sourceUrl: company.sourceUrl,
      sourceNotes: company.sourceNotes,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
      createdBy: company.createdBy,
      updatedBy: company.updatedBy,
      version: company.version,
      archivedAt: company.archivedAt?.toISOString()
    };
  }

  private toConferencePerson(person: Prisma.ConferencePersonGetPayload<object>): ConferencePerson {
    return {
      id: person.id,
      tenantId: person.tenantId,
      conferenceId: person.conferenceId,
      conferenceCompanyId: person.conferenceCompanyId,
      accountId: person.accountId,
      contactId: person.contactId,
      name: person.name,
      title: person.title,
      linkedIn: person.linkedIn,
      email: person.email,
      conferenceSignal: person.conferenceSignal,
      icpCategory: person.icpCategory,
      buyingSignal: person.buyingSignal,
      relationshipPath: person.relationshipPath,
      outreachStatus: person.outreachStatus,
      sourceType: person.sourceType,
      source: person.source,
      lawfulBasisNotes: person.lawfulBasisNotes,
      optOutStatus: person.optOutStatus,
      seniorityScore: person.seniorityScore,
      companyFitScore: person.companyFitScore,
      signalScore: person.signalScore,
      conferenceSignalScore: person.conferenceSignalScore,
      warmIntroScore: person.warmIntroScore,
      timingScore: person.timingScore,
      totalScore: person.totalScore,
      priorityBand: person.priorityBand,
      createdAt: person.createdAt.toISOString(),
      updatedAt: person.updatedAt.toISOString(),
      createdBy: person.createdBy,
      updatedBy: person.updatedBy,
      version: person.version,
      archivedAt: person.archivedAt?.toISOString()
    };
  }

  private toConferenceMeeting(
    meeting: Prisma.ConferenceMeetingGetPayload<object>
  ): ConferenceMeeting {
    return {
      id: meeting.id,
      tenantId: meeting.tenantId,
      conferenceId: meeting.conferenceId,
      conferencePersonId: meeting.conferencePersonId,
      reasonToMeet: meeting.reasonToMeet,
      proposedAsk: meeting.proposedAsk,
      introPath: meeting.introPath,
      status: meeting.status,
      notes: meeting.notes,
      nextStep: meeting.nextStep,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
      createdBy: meeting.createdBy,
      updatedBy: meeting.updatedBy,
      version: meeting.version,
      archivedAt: meeting.archivedAt?.toISOString()
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

  private async assertConferenceExists(
    tenantId: TenantId,
    conferenceId: string
  ): Promise<Conference> {
    const conference = await this.prisma.conference.findFirst({
      where: {
        id: conferenceId,
        tenantId,
        archivedAt: null
      }
    });

    if (!conference) {
      throw new Error("Conference not found");
    }

    return this.toConference(conference);
  }

  private async findConferencePerson(
    tenantId: TenantId,
    personId: string
  ): Promise<ConferencePerson> {
    const person = await this.prisma.conferencePerson.findFirst({
      where: {
        id: personId,
        tenantId,
        archivedAt: null
      }
    });

    if (!person) {
      throw new Error("Conference person not found");
    }

    return this.toConferencePerson(person);
  }

  private assertMeetingAllowed(
    person: ConferencePerson,
    status: ConferenceMeeting["status"]
  ): void {
    assertConferenceOutreachAllowed({
      optOutStatus: person.optOutStatus,
      outreachStatus:
        status === "requested"
          ? "meeting_requested"
          : status === "booked"
            ? "meeting_booked"
            : person.outreachStatus
    });
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
