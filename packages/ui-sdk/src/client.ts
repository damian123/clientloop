import {
  apiSchemas,
  createAccountSchema,
  createContactSchema,
  createLeadSchema,
  createOpportunitySchema,
  createTaskSchema,
  createWebhookSubscriptionSchema,
  type AppendNoteInput,
  type CompleteTaskInput,
  type CreateAccountInput,
  type CreateContactInput,
  type CreateLeadInput,
  type CreateOpportunityInput,
  type CreateTaskInput,
  type CreateWebhookSubscriptionInput,
  type CreateWebhookSubscriptionResponse,
  type DashboardResponse,
  type SearchResult,
  type UpdateOpportunityInput
} from "@clientloop/contracts";
import type {
  Account,
  Contact,
  Lead,
  Opportunity,
  Page,
  Task,
  WebhookSubscription
} from "@clientloop/domain";
import type { ZodType } from "zod";

export interface CRMClientOptions {
  baseUrl: string;
  tenantId?: string;
  userId?: string;
  fetchImpl?: typeof fetch;
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
  private readonly fetchImpl: typeof fetch;

  constructor(options: CRMClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.tenantId = options.tenantId;
    this.userId = options.userId;
    this.fetchImpl = options.fetchImpl ?? fetch;
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
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.authHeaders(),
        ...(init.headers ?? {})
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new CRMClientError("CRM API request failed", response.status, data);
    }

    return schema.parse(data);
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
}
