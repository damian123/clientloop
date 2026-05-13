import type {
  AccessPrincipal,
  Account,
  Activity,
  Contact,
  CustomFieldDefinition,
  Lead,
  Note,
  Opportunity,
  Page,
  RecordEntityType,
  Task,
  TenantId,
  WebhookSubscription
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
  UpdateActivityInput,
  UpdateNoteInput,
  UpdateOpportunityInput,
  UpdateTaskInput
} from "@clientloop/contracts";
import type { OutboxEvent } from "@clientloop/domain";

export interface WebhookDeliveryTarget extends WebhookSubscription {
  signingSecret: string;
}

export interface CRMRepository {
  getPrincipal(tenantId: TenantId, userId: string): Promise<AccessPrincipal>;
  dashboard(tenantId: TenantId): Promise<DashboardResponse>;
  listAccounts(tenantId: TenantId, query: ListQuery): Promise<Page<Account>>;
  createAccount(principal: AccessPrincipal, input: CreateAccountInput): Promise<Account>;
  listContacts(tenantId: TenantId, query: ListQuery): Promise<Page<Contact>>;
  createContact(principal: AccessPrincipal, input: CreateContactInput): Promise<Contact>;
  listLeads(tenantId: TenantId, query: ListQuery): Promise<Page<Lead>>;
  createLead(principal: AccessPrincipal, input: CreateLeadInput): Promise<Lead>;
  convertLead(input: {
    principal: AccessPrincipal;
    id: string;
    body: ConvertLeadInput;
    idempotencyKey?: string | undefined;
  }): Promise<LeadConversionResult>;
  listOpportunities(tenantId: TenantId, query: ListQuery): Promise<Page<Opportunity>>;
  createOpportunity(
    principal: AccessPrincipal,
    input: CreateOpportunityInput
  ): Promise<Opportunity>;
  updateOpportunity(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateOpportunityInput;
    idempotencyKey?: string | undefined;
  }): Promise<Opportunity>;
  listTasks(tenantId: TenantId, query: ListQuery): Promise<Page<Task>>;
  createTask(principal: AccessPrincipal, input: CreateTaskInput): Promise<Task>;
  updateTask(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateTaskInput;
    idempotencyKey?: string | undefined;
  }): Promise<Task>;
  completeTask(input: {
    principal: AccessPrincipal;
    id: string;
    expectedVersion: number;
  }): Promise<Task>;
  appendNote(principal: AccessPrincipal, input: AppendNoteInput): Promise<Note>;
  updateNote(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateNoteInput;
    idempotencyKey?: string | undefined;
  }): Promise<Note>;
  listActivities(tenantId: TenantId, query: ListQuery): Promise<Page<Activity>>;
  createActivity(principal: AccessPrincipal, input: CreateActivityInput): Promise<Activity>;
  updateActivity(input: {
    principal: AccessPrincipal;
    id: string;
    body: UpdateActivityInput;
    idempotencyKey?: string | undefined;
  }): Promise<Activity>;
  listCustomFieldDefinitions(tenantId: TenantId): Promise<CustomFieldDefinition[]>;
  createCustomFieldDefinition(
    principal: AccessPrincipal,
    input: CreateCustomFieldDefinitionInput
  ): Promise<CustomFieldDefinition>;
  updateCustomFieldValues(input: {
    principal: AccessPrincipal;
    entityType: RecordEntityType;
    id: string;
    body: UpdateCustomFieldValuesInput;
    idempotencyKey?: string | undefined;
  }): Promise<CustomFieldValueUpdateResult>;
  search(tenantId: TenantId, query: SearchQuery): Promise<SearchResult[]>;
  listWebhookSubscriptions(tenantId: TenantId): Promise<WebhookSubscription[]>;
  createWebhookSubscription(
    principal: AccessPrincipal,
    input: CreateWebhookSubscriptionInput
  ): Promise<CreateWebhookSubscriptionResponse>;
  activeWebhookSubscriptions(
    tenantId: TenantId,
    eventType: OutboxEvent["type"]
  ): Promise<WebhookDeliveryTarget[]>;
  pendingOutbox(limit: number): Promise<OutboxEvent[]>;
  markOutboxDelivered(id: string): Promise<void>;
  markOutboxFailed(id: string, error: string, nextAttemptAt: string): Promise<void>;
}
