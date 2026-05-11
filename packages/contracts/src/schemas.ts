import { z } from "zod";

export const idSchema = z.string().min(1);
export const isoDateSchema = z.string().min(1);

export const entityTypeSchema = z.enum([
  "account",
  "contact",
  "lead",
  "opportunity",
  "activity",
  "task",
  "note",
  "user"
]);

export const recordEntityTypeSchema = z.enum([
  "account",
  "contact",
  "lead",
  "opportunity"
]);

export const opportunityStageSchema = z.enum([
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost"
]);

export const domainEventTypeSchema = z.enum([
  "account.created",
  "account.updated",
  "contact.created",
  "contact.updated",
  "lead.created",
  "lead.converted",
  "opportunity.created",
  "opportunity.stage_changed",
  "task.created",
  "task.completed",
  "note.appended",
  "activity.logged"
]);

export const webhookEventTypeSchema = z.union([
  domainEventTypeSchema,
  z.literal("*")
]);

export const customFieldPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.object({ id: z.string(), label: z.string() }),
  z.object({ amount: z.number(), currency: z.string().length(3) })
]);

export const customFieldsSchema = z.record(customFieldPrimitiveSchema);

export const pageInfoSchema = z.object({
  endCursor: z.string().optional(),
  hasNextPage: z.boolean()
});

export function pageSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pageInfo: pageInfoSchema
  });
}

const auditFields = {
  tenantId: idSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  createdBy: idSchema,
  updatedBy: idSchema,
  version: z.number().int().positive(),
  archivedAt: isoDateSchema.nullish()
};

export const accountSchema = z.object({
  id: idSchema,
  name: z.string(),
  domain: z.string().nullish(),
  ownerUserId: idSchema.nullish(),
  status: z.enum(["prospect", "customer", "partner", "inactive"]),
  customFields: customFieldsSchema,
  ...auditFields
});

export const contactSchema = z.object({
  id: idSchema,
  accountId: idSchema.nullish(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  ownerUserId: idSchema.nullish(),
  customFields: customFieldsSchema,
  ...auditFields
});

export const leadSchema = z.object({
  id: idSchema,
  source: z.string(),
  companyName: z.string().nullish(),
  contactName: z.string(),
  email: z.string().email().nullish(),
  status: z.enum(["new", "qualified", "disqualified", "converted"]),
  convertedAt: isoDateSchema.nullish(),
  convertedAccountId: idSchema.nullish(),
  convertedContactId: idSchema.nullish(),
  convertedOpportunityId: idSchema.nullish(),
  customFields: customFieldsSchema,
  ...auditFields
});

export const opportunitySchema = z.object({
  id: idSchema,
  accountId: idSchema,
  primaryContactId: idSchema.nullish(),
  name: z.string(),
  stage: opportunityStageSchema,
  amount: z.number().nullish(),
  currency: z.string().length(3),
  expectedCloseDate: z.string().nullish(),
  ownerUserId: idSchema,
  probabilityPct: z.number().int().min(0).max(100).nullish(),
  customFields: customFieldsSchema,
  ...auditFields
});

export const taskSchema = z.object({
  id: idSchema,
  parent: z.object({ type: entityTypeSchema, id: idSchema }).optional(),
  title: z.string(),
  description: z.string().nullish(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
  priority: z.enum(["low", "medium", "high"]),
  dueAt: isoDateSchema.nullish(),
  assignedUserId: idSchema,
  ...auditFields
});

export const noteSchema = z.object({
  id: idSchema,
  parent: z.object({ type: entityTypeSchema, id: idSchema }),
  body: z.string(),
  bodyFormat: z.enum(["markdown", "html", "plain_text"]),
  ...auditFields
});

export const activitySchema = z.object({
  id: idSchema,
  parent: z.object({ type: entityTypeSchema, id: idSchema }),
  type: z.enum(["call", "email", "meeting", "event", "system"]),
  subject: z.string(),
  occurredAt: isoDateSchema,
  payload: z.record(z.unknown()),
  ...auditFields
});

export const customFieldDefinitionSchema = z.object({
  id: idSchema,
  entityType: recordEntityTypeSchema,
  key: z.string(),
  label: z.string(),
  fieldType: z.enum([
    "text",
    "textarea",
    "number",
    "boolean",
    "date",
    "datetime",
    "single_select",
    "multi_select",
    "currency",
    "user_ref",
    "account_ref"
  ]),
  required: z.boolean(),
  isIndexed: z.boolean(),
  schema: z.record(z.unknown()).optional(),
  ...auditFields
});

export const webhookSubscriptionSchema = z.object({
  id: idSchema,
  tenantId: idSchema,
  url: z.string().url(),
  eventTypes: z.array(webhookEventTypeSchema),
  isActive: z.boolean(),
  secretFingerprint: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  lastErrorAt: isoDateSchema.nullish(),
  lastError: z.string().nullish()
});
