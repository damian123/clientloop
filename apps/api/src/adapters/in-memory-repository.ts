import { randomUUID } from "node:crypto";
import {
  assertCan,
  changeOpportunityStage,
  completeTask as completeTaskRule,
  createAuditFields,
  createDomainEvent,
  createSeedData,
  targetFromRecord,
  type AccessPrincipal,
  type Account,
  type Activity,
  type Contact,
  type CustomFieldDefinition,
  type Lead,
  type Note,
  type Opportunity,
  type OutboxEvent,
  type Page,
  type Role,
  type Task,
  type TenantId,
  type User
} from "@clientloop/domain";
import type {
  AppendNoteInput,
  CreateAccountInput,
  CreateContactInput,
  CreateLeadInput,
  CreateOpportunityInput,
  CreateTaskInput,
  DashboardResponse,
  ListQuery,
  SearchQuery,
  SearchResult,
  UpdateOpportunityInput
} from "@clientloop/contracts";
import type { CRMRepository } from "../repository";

interface Store {
  users: User[];
  roles: Role[];
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
  opportunities: Opportunity[];
  tasks: Task[];
  notes: Note[];
  activities: Activity[];
  customFieldDefinitions: CustomFieldDefinition[];
}

export class InMemoryCRMRepository implements CRMRepository {
  private readonly store: Store;
  private readonly outbox: OutboxEvent[] = [];
  private readonly idempotencyResults = new Map<string, Opportunity>();

  constructor(seed: Store = createSeedData()) {
    this.store = seed;
  }

  async getPrincipal(tenantId: TenantId, userId: string): Promise<AccessPrincipal> {
    const user = this.store.users.find(
      (candidate) => candidate.tenantId === tenantId && candidate.id === userId
    );

    if (!user) {
      throw new Error("Authenticated user was not found");
    }

    return {
      tenantId,
      user,
      roles: this.store.roles.filter((role) => user.roleIds.includes(role.id))
    };
  }

  async dashboard(tenantId: TenantId): Promise<DashboardResponse> {
    return {
      accounts: this.byTenant(this.store.accounts, tenantId),
      contacts: this.byTenant(this.store.contacts, tenantId),
      leads: this.byTenant(this.store.leads, tenantId),
      opportunities: this.byTenant(this.store.opportunities, tenantId),
      tasks: this.byTenant(this.store.tasks, tenantId),
      notes: this.byTenant(this.store.notes, tenantId),
      activities: this.byTenant(this.store.activities, tenantId),
      customFieldDefinitions: this.byTenant(this.store.customFieldDefinitions, tenantId)
    };
  }

  async listAccounts(tenantId: TenantId, query: ListQuery): Promise<Page<Account>> {
    return this.page(this.filterByText(this.byTenant(this.store.accounts, tenantId), query.q, [
      "name",
      "domain",
      "status"
    ]), query.limit);
  }

  async createAccount(principal: AccessPrincipal, input: CreateAccountInput): Promise<Account> {
    assertCan(principal, "account", "create", { tenantId: principal.tenantId });
    const now = new Date().toISOString();
    const account: Account = {
      id: randomUUID(),
      name: input.name,
      domain: input.domain,
      ownerUserId: input.ownerUserId ?? principal.user.id,
      status: input.status,
      customFields: input.customFields,
      ...createAuditFields({ tenantId: principal.tenantId, actorUserId: principal.user.id, now })
    };

    this.store.accounts.unshift(account);
    this.enqueueEvent("account.created", "account", account.id, principal, now, { name: account.name });
    return account;
  }

  async listContacts(tenantId: TenantId, query: ListQuery): Promise<Page<Contact>> {
    return this.page(this.filterByText(this.byTenant(this.store.contacts, tenantId), query.q, [
      "firstName",
      "lastName",
      "email"
    ]), query.limit);
  }

  async createContact(principal: AccessPrincipal, input: CreateContactInput): Promise<Contact> {
    assertCan(principal, "contact", "create", { tenantId: principal.tenantId });
    const now = new Date().toISOString();
    const contact: Contact = {
      id: randomUUID(),
      accountId: input.accountId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      ownerUserId: input.ownerUserId ?? principal.user.id,
      customFields: input.customFields,
      ...createAuditFields({ tenantId: principal.tenantId, actorUserId: principal.user.id, now })
    };

    this.store.contacts.unshift(contact);
    this.enqueueEvent("contact.created", "contact", contact.id, principal, now, {
      email: contact.email ?? null
    });
    return contact;
  }

  async listLeads(tenantId: TenantId, query: ListQuery): Promise<Page<Lead>> {
    return this.page(this.filterByText(this.byTenant(this.store.leads, tenantId), query.q, [
      "source",
      "companyName",
      "contactName",
      "email",
      "status"
    ]), query.limit);
  }

  async createLead(principal: AccessPrincipal, input: CreateLeadInput): Promise<Lead> {
    assertCan(principal, "lead", "create", { tenantId: principal.tenantId });
    const now = new Date().toISOString();
    const lead: Lead = {
      id: randomUUID(),
      source: input.source,
      companyName: input.companyName,
      contactName: input.contactName,
      email: input.email,
      status: input.status,
      customFields: input.customFields,
      ...createAuditFields({ tenantId: principal.tenantId, actorUserId: principal.user.id, now })
    };

    this.store.leads.unshift(lead);
    this.enqueueEvent("lead.created", "lead", lead.id, principal, now, { source: lead.source });
    return lead;
  }

  async listOpportunities(tenantId: TenantId, query: ListQuery): Promise<Page<Opportunity>> {
    return this.page(this.filterByText(this.byTenant(this.store.opportunities, tenantId), query.q, [
      "name",
      "stage",
      "currency"
    ]), query.limit);
  }

  async createOpportunity(
    principal: AccessPrincipal,
    input: CreateOpportunityInput
  ): Promise<Opportunity> {
    assertCan(principal, "opportunity", "create", { tenantId: principal.tenantId });
    const now = new Date().toISOString();
    const opportunity: Opportunity = {
      id: randomUUID(),
      accountId: input.accountId,
      primaryContactId: input.primaryContactId,
      name: input.name,
      stage: input.stage,
      amount: input.amount,
      currency: input.currency,
      expectedCloseDate: input.expectedCloseDate,
      ownerUserId: input.ownerUserId,
      probabilityPct: input.probabilityPct,
      customFields: input.customFields,
      ...createAuditFields({ tenantId: principal.tenantId, actorUserId: principal.user.id, now })
    };

    this.store.opportunities.unshift(opportunity);
    this.enqueueEvent("opportunity.created", "opportunity", opportunity.id, principal, now, {
      stage: opportunity.stage,
      amount: opportunity.amount ?? null
    });
    return opportunity;
  }

  async updateOpportunity(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateOpportunityInput;
    idempotencyKey?: string | undefined;
  }): Promise<Opportunity> {
    const idempotencyScope = input.idempotencyKey
      ? `${input.principal.tenantId}:opportunity:${input.id}:${input.idempotencyKey}`
      : undefined;

    if (idempotencyScope && this.idempotencyResults.has(idempotencyScope)) {
      return this.idempotencyResults.get(idempotencyScope)!;
    }

    const index = this.store.opportunities.findIndex(
      (opportunity) =>
        opportunity.tenantId === input.principal.tenantId && opportunity.id === input.id
    );

    if (index < 0) {
      throw new Error("Opportunity not found");
    }

    const current = this.store.opportunities[index]!;
    assertCan(input.principal, "opportunity", "update", targetFromRecord(current));
    const now = new Date().toISOString();

    let updated =
      input.body.stage && input.body.stage !== current.stage
        ? changeOpportunityStage({
            opportunity: current,
            nextStage: input.body.stage,
            actorUserId: input.principal.user.id,
            expectedVersion: input.body.expectedVersion,
            now
          })
        : {
            ...current,
            updatedAt: now,
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

    this.store.opportunities[index] = updated;
    this.enqueueEvent("opportunity.stage_changed", "opportunity", updated.id, input.principal, now, {
      fromStage: current.stage,
      toStage: updated.stage,
      version: updated.version
    });

    if (idempotencyScope) {
      this.idempotencyResults.set(idempotencyScope, updated);
    }

    return updated;
  }

  async listTasks(tenantId: TenantId, query: ListQuery): Promise<Page<Task>> {
    return this.page(this.filterByText(this.byTenant(this.store.tasks, tenantId), query.q, [
      "title",
      "status",
      "priority"
    ]), query.limit);
  }

  async createTask(principal: AccessPrincipal, input: CreateTaskInput): Promise<Task> {
    assertCan(principal, "task", "create", { tenantId: principal.tenantId });
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      parent: input.parent,
      title: input.title,
      description: input.description,
      status: "open",
      priority: input.priority,
      dueAt: input.dueAt,
      assignedUserId: input.assignedUserId,
      ...createAuditFields({ tenantId: principal.tenantId, actorUserId: principal.user.id, now })
    };

    this.store.tasks.unshift(task);
    this.enqueueEvent("task.created", "task", task.id, principal, now, { title: task.title });
    return task;
  }

  async completeTask(input: {
    principal: AccessPrincipal;
    id: string;
    expectedVersion: number;
  }): Promise<Task> {
    const index = this.store.tasks.findIndex(
      (task) => task.tenantId === input.principal.tenantId && task.id === input.id
    );

    if (index < 0) {
      throw new Error("Task not found");
    }

    const current = this.store.tasks[index]!;
    assertCan(input.principal, "task", "update", targetFromRecord(current));
    const now = new Date().toISOString();
    const updated = completeTaskRule({
      task: current,
      actorUserId: input.principal.user.id,
      expectedVersion: input.expectedVersion,
      now
    });

    this.store.tasks[index] = updated;
    this.enqueueEvent("task.completed", "task", updated.id, input.principal, now, {
      version: updated.version
    });
    return updated;
  }

  async appendNote(principal: AccessPrincipal, input: AppendNoteInput): Promise<Note> {
    assertCan(principal, "note", "create", { tenantId: principal.tenantId });
    const now = new Date().toISOString();
    const note: Note = {
      id: randomUUID(),
      parent: input.parent,
      body: input.body,
      bodyFormat: input.bodyFormat,
      ...createAuditFields({ tenantId: principal.tenantId, actorUserId: principal.user.id, now })
    };

    this.store.notes.unshift(note);
    this.enqueueEvent("note.appended", "note", note.id, principal, now, {
      parent: note.parent
    });
    return note;
  }

  async listActivities(tenantId: TenantId, query: ListQuery): Promise<Page<Activity>> {
    return this.page(this.filterByText(this.byTenant(this.store.activities, tenantId), query.q, [
      "subject",
      "type"
    ]), query.limit);
  }

  async listCustomFieldDefinitions(tenantId: TenantId): Promise<CustomFieldDefinition[]> {
    return this.byTenant(this.store.customFieldDefinitions, tenantId);
  }

  async search(tenantId: TenantId, query: SearchQuery): Promise<SearchResult[]> {
    const haystack: SearchResult[] = [
      ...this.byTenant(this.store.accounts, tenantId).map((account) => ({
        type: "account" as const,
        id: account.id,
        label: account.name,
        description: account.domain ?? account.status
      })),
      ...this.byTenant(this.store.contacts, tenantId).map((contact) => ({
        type: "contact" as const,
        id: contact.id,
        label: `${contact.firstName} ${contact.lastName}`,
        description: contact.email ?? undefined
      })),
      ...this.byTenant(this.store.leads, tenantId).map((lead) => ({
        type: "lead" as const,
        id: lead.id,
        label: lead.contactName,
        description: lead.companyName ?? lead.email ?? undefined
      })),
      ...this.byTenant(this.store.opportunities, tenantId).map((opportunity) => ({
        type: "opportunity" as const,
        id: opportunity.id,
        label: opportunity.name,
        description: opportunity.stage
      }))
    ];

    const normalized = query.q.toLowerCase();
    return haystack
      .filter((item) =>
        `${item.label} ${item.description ?? ""}`.toLowerCase().includes(normalized)
      )
      .slice(0, query.limit);
  }

  async pendingOutbox(limit: number): Promise<OutboxEvent[]> {
    return this.outbox.filter((event) => event.status === "pending").slice(0, limit);
  }

  async markOutboxDelivered(id: string): Promise<void> {
    const event = this.outbox.find((candidate) => candidate.id === id);

    if (event) {
      event.status = "delivered";
      event.deliveredAt = new Date().toISOString();
    }
  }

  private byTenant<T extends { tenantId: TenantId; archivedAt?: string | null | undefined }>(
    records: T[],
    tenantId: TenantId
  ): T[] {
    return records.filter((record) => record.tenantId === tenantId && !record.archivedAt);
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

  private filterByText<T>(
    items: T[],
    query: string | undefined,
    keys: Array<keyof T>
  ): T[] {
    if (!query) {
      return items;
    }

    const normalized = query.toLowerCase();
    return items.filter((item) =>
      keys.some((key) => String(item[key] ?? "").toLowerCase().includes(normalized))
    );
  }

  private assertExpectedVersion(record: { version: number }, expectedVersion: number): number {
    if (record.version !== expectedVersion) {
      throw new Error("Version conflict");
    }

    return record.version;
  }

  private enqueueEvent(
    type: OutboxEvent["type"],
    entityType: OutboxEvent["entity"]["type"],
    entityId: string,
    principal: AccessPrincipal,
    occurredAt: string,
    payload: Record<string, unknown>
  ): void {
    this.outbox.push({
      ...createDomainEvent({
        id: randomUUID(),
        tenantId: principal.tenantId,
        type,
        entityType,
        entityId,
        actorUserId: principal.user.id,
        occurredAt,
        payload
      }),
      status: "pending",
      attempts: 0
    });
  }
}
