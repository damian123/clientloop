import {
  apiSchemas,
  createAccountSchema,
  createContactSchema,
  createCustomFieldDefinitionSchema,
  createLeadSchema,
  createOpportunitySchema,
  createTaskSchema,
  createWebhookSubscriptionSchema,
  contactImportRequestSchema,
  convertLeadSchema,
  devLoginSchema,
  exportEntitySchema,
  updateCustomFieldValuesSchema,
  type AppendNoteInput,
  type CompleteTaskInput,
  type ContactImportPreview,
  type ContactImportRequest,
  type ContactImportResult,
  type ConvertLeadInput,
  type CreateAccountInput,
  type CreateContactInput,
  type CreateCustomFieldDefinitionInput,
  type CreateLeadInput,
  type CreateOpportunityInput,
  type CreateTaskInput,
  type CreateWebhookSubscriptionInput,
  type CreateWebhookSubscriptionResponse,
  type CustomFieldValueUpdateResult,
  type DashboardResponse,
  type DevLoginInput,
  type ExportEntity,
  type LeadConversionResult,
  type SearchResult,
  type SessionResponse,
  type UpdateCustomFieldValuesInput,
  type UpdateOpportunityInput
} from "@clientloop/contracts";
import type {
  Account,
  Contact,
  CustomFieldDefinition,
  Lead,
  Opportunity,
  Page,
  RecordEntityType,
  Task,
  WebhookSubscription
} from "@clientloop/domain";
import type { ZodType } from "zod";

export interface CRMClientOptions {
  baseUrl: string;
  tenantId?: string | undefined;
  userId?: string | undefined;
  csrfToken?: string | undefined;
  credentials?: RequestCredentials | undefined;
  fetchImpl?: typeof fetch | undefined;
}

export class CRMClientError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "CRMClientError";
    this.status = status;
    this.details = details;
  }
}

export class CRMClient {
  private readonly baseUrl: string;
  private readonly tenantId: string | undefined;
  private readonly userId: string | undefined;
  private readonly credentials: RequestCredentials;
  private readonly fetchImpl: typeof fetch;
  private csrfToken: string | undefined;

  constructor(options: CRMClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tenantId = options.tenantId;
    this.userId = options.userId;
    this.csrfToken = options.csrfToken;
    this.credentials = options.credentials ?? "include";
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  setCsrfToken(token: string | undefined): void {
    this.csrfToken = token;
  }

  async session(): Promise<SessionResponse> {
    const session = await this.request("/v1/session", { method: "GET" }, apiSchemas.session);
    this.csrfToken = session.csrfToken;
    return session;
  }

  async devLogin(input: DevLoginInput = {}): Promise<SessionResponse> {
    const session = await this.request(
      "/v1/session/dev-login",
      this.jsonRequest("POST", devLoginSchema.parse(input)),
      apiSchemas.session
    );
    this.csrfToken = session.csrfToken;
    return session;
  }

  async logout(): Promise<void> {
    await this.requestText("/v1/session/logout", this.jsonRequest("POST", {}));
    this.csrfToken = undefined;
  }

  async dashboard(): Promise<DashboardResponse> {
    return this.request("/v1/dashboard", { method: "GET" }, apiSchemas.dashboard);
  }

  async listAccounts(): Promise<Page<Account>> {
    return this.request("/v1/accounts", { method: "GET" }, apiSchemas.accountPage);
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    return this.request(
      "/v1/accounts",
      this.jsonRequest("POST", createAccountSchema.parse(input)),
      apiSchemas.account
    );
  }

  async listContacts(): Promise<Page<Contact>> {
    return this.request("/v1/contacts", { method: "GET" }, apiSchemas.contactPage);
  }

  async createContact(input: CreateContactInput): Promise<Contact> {
    return this.request(
      "/v1/contacts",
      this.jsonRequest("POST", createContactSchema.parse(input)),
      apiSchemas.contact
    );
  }

  async listLeads(): Promise<Page<Lead>> {
    return this.request("/v1/leads", { method: "GET" }, apiSchemas.leadPage);
  }

  async createLead(input: CreateLeadInput): Promise<Lead> {
    return this.request(
      "/v1/leads",
      this.jsonRequest("POST", createLeadSchema.parse(input)),
      apiSchemas.lead
    );
  }

  async convertLead(
    id: string,
    input: ConvertLeadInput,
    options: { idempotencyKey?: string | undefined } = {}
  ): Promise<LeadConversionResult> {
    return this.request(
      `/v1/leads/${id}/convert`,
      this.jsonRequest("POST", convertLeadSchema.parse(input), {
        "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID()
      }),
      apiSchemas.leadConversionResult
    );
  }

  async listOpportunities(): Promise<Page<Opportunity>> {
    return this.request("/v1/opportunities", { method: "GET" }, apiSchemas.opportunityPage);
  }

  async createOpportunity(input: CreateOpportunityInput): Promise<Opportunity> {
    return this.request(
      "/v1/opportunities",
      this.jsonRequest("POST", createOpportunitySchema.parse(input)),
      apiSchemas.opportunity
    );
  }

  async updateOpportunity(
    id: string,
    input: UpdateOpportunityInput,
    options: { idempotencyKey?: string } = {}
  ): Promise<Opportunity> {
    return this.request(
      `/v1/opportunities/${id}`,
      this.jsonRequest("PATCH", input, {
        "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID(),
        "If-Match": String(input.expectedVersion)
      }),
      apiSchemas.opportunity
    );
  }

  async listTasks(): Promise<Page<Task>> {
    return this.request("/v1/tasks", { method: "GET" }, apiSchemas.taskPage);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.request(
      "/v1/tasks",
      this.jsonRequest("POST", createTaskSchema.parse(input)),
      apiSchemas.task
    );
  }

  async completeTask(id: string, input: CompleteTaskInput): Promise<Task> {
    return this.request(
      `/v1/tasks/${id}/complete`,
      this.jsonRequest("POST", input),
      apiSchemas.task
    );
  }

  async appendNote(input: AppendNoteInput) {
    return this.request("/v1/notes", this.jsonRequest("POST", input), apiSchemas.note);
  }

  async listCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
    return this.request(
      "/v1/custom-fields",
      { method: "GET" },
      apiSchemas.customFieldDefinitions
    );
  }

  async createCustomFieldDefinition(
    input: CreateCustomFieldDefinitionInput
  ): Promise<CustomFieldDefinition> {
    return this.request(
      "/v1/custom-fields",
      this.jsonRequest("POST", createCustomFieldDefinitionSchema.parse(input)),
      apiSchemas.customFieldDefinition
    );
  }

  async updateCustomFieldValues(
    entityType: RecordEntityType,
    id: string,
    input: UpdateCustomFieldValuesInput,
    options: { idempotencyKey?: string } = {}
  ): Promise<CustomFieldValueUpdateResult> {
    return this.request(
      `/v1/custom-field-values/${entityType}/${id}`,
      this.jsonRequest("PATCH", updateCustomFieldValuesSchema.parse(input), {
        "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID(),
        "If-Match": String(input.expectedVersion)
      }),
      apiSchemas.customFieldValueUpdateResult
    );
  }

  async listWebhookSubscriptions(): Promise<WebhookSubscription[]> {
    return this.request(
      "/v1/webhooks/subscriptions",
      { method: "GET" },
      apiSchemas.webhookSubscriptions
    );
  }

  async createWebhookSubscription(
    input: CreateWebhookSubscriptionInput
  ): Promise<CreateWebhookSubscriptionResponse> {
    return this.request(
      "/v1/webhooks/subscriptions",
      this.jsonRequest("POST", createWebhookSubscriptionSchema.parse(input)),
      apiSchemas.createWebhookSubscriptionResponse
    );
  }

  async exportRecords(entity: ExportEntity): Promise<string> {
    return this.requestText(`/v1/exports/${exportEntitySchema.parse(entity)}`, {
      method: "GET"
    });
  }

  async previewContactImport(input: ContactImportRequest): Promise<ContactImportPreview> {
    return this.request(
      "/v1/imports/contacts/preview",
      this.jsonRequest("POST", contactImportRequestSchema.parse(input)),
      apiSchemas.contactImportPreview
    );
  }

  async importContacts(input: ContactImportRequest): Promise<ContactImportResult> {
    return this.request(
      "/v1/imports/contacts",
      this.jsonRequest("POST", contactImportRequestSchema.parse(input)),
      apiSchemas.contactImportResult
    );
  }

  async search(query: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    return this.request(`/v1/search?${params.toString()}`, { method: "GET" }, apiSchemas.searchResults);
  }

  private jsonRequest(
    method: "POST" | "PATCH",
    body: unknown,
    headers: Record<string, string> = {}
  ): RequestInit {
    return {
      method,
      headers: {
        "Content-Type": "application/json",
        ...this.csrfHeaders(),
        ...headers
      },
      body: JSON.stringify(body)
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    schema: ZodType<T>
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, this.fetchInit({
      ...init,
      headers: {
        ...this.authHeaders(),
        ...(init.headers ?? {})
      }
    }));

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new CRMClientError("CRM API request failed", response.status, data);
    }

    return schema.parse(data);
  }

  private async requestText(path: string, init: RequestInit): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, this.fetchInit({
      ...init,
      headers: {
        ...this.authHeaders(),
        ...(init.headers ?? {})
      }
    }));
    const text = await response.text();

    if (!response.ok) {
      throw new CRMClientError("CRM API request failed", response.status, text);
    }

    return text;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.tenantId) {
      headers["x-tenant-id"] = this.tenantId;
    }

    if (this.userId) {
      headers["x-user-id"] = this.userId;
    }

    return headers;
  }

  private csrfHeaders(): Record<string, string> {
    return this.csrfToken ? { "X-CSRF-Token": this.csrfToken } : {};
  }

  private fetchInit(init: RequestInit): RequestInit {
    return {
      ...init,
      credentials: this.credentials
    };
  }
}
