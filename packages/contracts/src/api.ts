import { z } from "zod";
import {
  accountSchema,
  activitySchema,
  contactSchema,
  customFieldDefinitionSchema,
  customFieldsSchema,
  entityTypeSchema,
  idSchema,
  leadSchema,
  noteSchema,
  opportunitySchema,
  opportunityStageSchema,
  pageSchema,
  taskSchema,
  webhookEventTypeSchema,
  webhookSubscriptionSchema
} from "./schemas";

export const listQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const createAccountSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1).optional(),
  ownerUserId: idSchema.optional(),
  status: z.enum(["prospect", "customer", "partner", "inactive"]).default("prospect"),
  customFields: customFieldsSchema.default({})
});

export const createContactSchema = z.object({
  accountId: idSchema.optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  ownerUserId: idSchema.optional(),
  customFields: customFieldsSchema.default({})
});

export const createLeadSchema = z.object({
  source: z.string().min(1),
  companyName: z.string().optional(),
  contactName: z.string().min(1),
  email: z.string().email().optional(),
  status: z.enum(["new", "qualified", "disqualified"]).default("new"),
  customFields: customFieldsSchema.default({})
});

export const createOpportunitySchema = z.object({
  accountId: idSchema,
  primaryContactId: idSchema.optional(),
  name: z.string().min(1),
  stage: opportunityStageSchema.default("qualification"),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  expectedCloseDate: z.string().optional(),
  ownerUserId: idSchema,
  probabilityPct: z.number().int().min(0).max(100).optional(),
  customFields: customFieldsSchema.default({})
});

export const updateOpportunitySchema = z.object({
  expectedVersion: z.number().int().positive(),
  stage: opportunityStageSchema.optional(),
  amount: z.number().nonnegative().nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
  probabilityPct: z.number().int().min(0).max(100).nullable().optional(),
  customFields: customFieldsSchema.optional()
});

export const createTaskSchema = z.object({
  parent: z.object({ type: entityTypeSchema, id: idSchema }).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueAt: z.string().optional(),
  assignedUserId: idSchema
});

export const completeTaskSchema = z.object({
  expectedVersion: z.number().int().positive()
});

export const appendNoteSchema = z.object({
  parent: z.object({ type: entityTypeSchema, id: idSchema }),
  body: z.string().min(1),
  bodyFormat: z.enum(["markdown", "html", "plain_text"]).default("plain_text")
});

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(webhookEventTypeSchema).min(1),
  signingSecret: z.string().min(16).optional()
});

export const createWebhookSubscriptionResponseSchema = webhookSubscriptionSchema.extend({
  signingSecret: z.string()
});

export const exportEntitySchema = z.enum(["accounts", "contacts", "opportunities"]);

export const contactImportMappingSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  accountId: z.string().optional(),
  ownerUserId: z.string().optional()
});

export const contactImportRequestSchema = z.object({
  csv: z.string().min(1),
  mapping: contactImportMappingSchema.optional()
});

export const contactImportErrorSchema = z.object({
  row: z.number().int().positive(),
  field: z.string(),
  message: z.string()
});

export const contactImportRowSchema = z.object({
  row: z.number().int().positive(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  accountId: z.string().optional(),
  ownerUserId: z.string().optional()
});

export const contactImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(contactImportErrorSchema),
  rows: z.array(contactImportRowSchema)
});

export const contactImportResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  contacts: z.array(contactSchema),
  errors: z.array(contactImportErrorSchema)
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(25).default(10)
});

export const dashboardSchema = z.object({
  accounts: z.array(accountSchema),
  contacts: z.array(contactSchema),
  leads: z.array(leadSchema),
  opportunities: z.array(opportunitySchema),
  tasks: z.array(taskSchema),
  notes: z.array(noteSchema),
  activities: z.array(activitySchema),
  customFieldDefinitions: z.array(customFieldDefinitionSchema)
});

export const searchResultSchema = z.object({
  type: entityTypeSchema,
  id: idSchema,
  label: z.string(),
  description: z.string().optional()
});

export const apiSchemas = {
  account: accountSchema,
  contact: contactSchema,
  lead: leadSchema,
  opportunity: opportunitySchema,
  task: taskSchema,
  note: noteSchema,
  activity: activitySchema,
  customFieldDefinition: customFieldDefinitionSchema,
  accountPage: pageSchema(accountSchema),
  contactPage: pageSchema(contactSchema),
  leadPage: pageSchema(leadSchema),
  opportunityPage: pageSchema(opportunitySchema),
  taskPage: pageSchema(taskSchema),
  activityPage: pageSchema(activitySchema),
  dashboard: dashboardSchema,
  searchResults: z.array(searchResultSchema),
  webhookSubscription: webhookSubscriptionSchema,
  webhookSubscriptions: z.array(webhookSubscriptionSchema),
  createWebhookSubscriptionResponse: createWebhookSubscriptionResponseSchema,
  contactImportPreview: contactImportPreviewSchema,
  contactImportResult: contactImportResultSchema
};

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type AppendNoteInput = z.infer<typeof appendNoteSchema>;
export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionSchema>;
export type CreateWebhookSubscriptionResponse = z.infer<typeof createWebhookSubscriptionResponseSchema>;
export type ExportEntity = z.infer<typeof exportEntitySchema>;
export type ContactImportMapping = z.infer<typeof contactImportMappingSchema>;
export type ContactImportRequest = z.infer<typeof contactImportRequestSchema>;
export type ContactImportError = z.infer<typeof contactImportErrorSchema>;
export type ContactImportRow = z.infer<typeof contactImportRowSchema>;
export type ContactImportPreview = z.infer<typeof contactImportPreviewSchema>;
export type ContactImportResult = z.infer<typeof contactImportResultSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DashboardResponse = z.infer<typeof dashboardSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
