import { z } from "zod";

export const idSchema = z.string().min(1);
export const isoDateSchema = z.string().min(1);

export const entityTypeSchema = z.enum([
  "account",
  "contact",
  "conference",
  "conference_company",
  "conference_person",
  "conference_meeting",
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
  "conference.created",
  "conference.updated",
  "conference_person.scored",
  "conference_meeting.updated",
  "lead.created",
  "lead.converted",
  "opportunity.created",
  "opportunity.stage_changed",
  "task.created",
  "task.completed",
  "task.updated",
  "note.appended",
  "note.updated",
  "activity.logged",
  "activity.updated"
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

export const customFieldTypeSchema = z.enum([
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
]);

export const permissionResourceSchema = z.enum([
  "account",
  "contact",
  "conference",
  "lead",
  "opportunity",
  "activity",
  "task",
  "note",
  "custom_field",
  "user",
  "admin"
]);

export const permissionActionSchema = z.enum([
  "read",
  "create",
  "update",
  "delete",
  "assign",
  "export",
  "manage"
]);

export const permissionConditionSchema = z.enum(["own", "team", "tenant", "all"]);

export const permissionSchema = z.object({
  id: idSchema,
  resource: permissionResourceSchema,
  action: permissionActionSchema,
  condition: permissionConditionSchema.optional()
});

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

export const attendeeAccessStatusSchema = z.enum([
  "unknown",
  "unavailable",
  "registered_only",
  "sponsor_directory",
  "opt_in_directory",
  "lead_retrieval",
  "post_event_opt_in"
]);

export const conferenceRoleSchema = z.enum([
  "speaker",
  "moderator",
  "sponsor",
  "exhibitor",
  "startup_showcase",
  "award_finalist",
  "side_event_host",
  "attendee",
  "organizer",
  "partner",
  "other"
]);

export const conferenceSourceTypeSchema = z.enum([
  "official_directory",
  "sponsor_access",
  "speaker_agenda",
  "sponsor_exhibitor_list",
  "startup_showcase",
  "linkedin_public",
  "side_event_rsvp",
  "warm_network",
  "press_release",
  "manual_research"
]);

export const conferenceIcpCategorySchema = z.enum([
  "founder_operator",
  "asset_owner",
  "private_markets",
  "fintech_digital_assets",
  "investor_allocator",
  "strategic_partner",
  "lower_priority",
  "unknown"
]);

export const conferenceOutreachStatusSchema = z.enum([
  "not_started",
  "queued",
  "contacted",
  "replied",
  "meeting_requested",
  "meeting_booked",
  "nurturing",
  "disqualified"
]);

export const conferenceOptOutStatusSchema = z.enum(["unknown", "not_opted_out", "opted_out"]);

export const conferencePriorityBandSchema = z.enum([
  "request_meeting",
  "personalized_outreach",
  "nurture",
  "do_not_prioritize"
]);

export const conferenceMeetingStatusSchema = z.enum([
  "not_requested",
  "requested",
  "booked",
  "declined",
  "completed",
  "cancelled"
]);

export const conferenceSchema = z.object({
  id: idSchema,
  name: z.string(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  location: z.string().nullish(),
  website: z.string().url().nullish(),
  audienceType: z.string().nullish(),
  organizerContact: z.string().nullish(),
  sponsorPackageLink: z.string().url().nullish(),
  appName: z.string().nullish(),
  attendeeAccessStatus: attendeeAccessStatusSchema,
  sourceNotes: z.string().nullish(),
  ...auditFields
});

export const conferenceCompanySchema = z.object({
  id: idSchema,
  conferenceId: idSchema,
  accountId: idSchema.nullish(),
  company: z.string(),
  website: z.string().url().nullish(),
  conferenceRole: conferenceRoleSchema,
  sector: z.string().nullish(),
  rwaRelevance: z.boolean(),
  privateMarketsRelevance: z.boolean(),
  fundraisingRelevance: z.boolean(),
  marketEntryRelevance: z.boolean(),
  partnershipRelevance: z.boolean(),
  companyScore: z.number().int().min(0).max(20),
  sourceUrl: z.string().url().nullish(),
  sourceNotes: z.string().nullish(),
  ...auditFields
});

export const conferencePersonSchema = z.object({
  id: idSchema,
  conferenceId: idSchema,
  conferenceCompanyId: idSchema.nullish(),
  accountId: idSchema.nullish(),
  contactId: idSchema.nullish(),
  name: z.string(),
  title: z.string(),
  linkedIn: z.string().url().nullish(),
  email: z.string().email().nullish(),
  conferenceSignal: z.string().nullish(),
  icpCategory: conferenceIcpCategorySchema,
  buyingSignal: z.string().nullish(),
  relationshipPath: z.string().nullish(),
  outreachStatus: conferenceOutreachStatusSchema,
  sourceType: conferenceSourceTypeSchema,
  source: z.string().nullish(),
  lawfulBasisNotes: z.string().nullish(),
  optOutStatus: conferenceOptOutStatusSchema,
  seniorityScore: z.number().int().min(0).max(4),
  companyFitScore: z.number().int().min(0).max(4),
  signalScore: z.number().int().min(0).max(5),
  conferenceSignalScore: z.number().int().min(0).max(3),
  warmIntroScore: z.number().int().min(0).max(2),
  timingScore: z.number().int().min(0).max(2),
  totalScore: z.number().int().min(0).max(20),
  priorityBand: conferencePriorityBandSchema,
  ...auditFields
});

export const conferenceMeetingSchema = z.object({
  id: idSchema,
  conferenceId: idSchema,
  conferencePersonId: idSchema,
  reasonToMeet: z.string(),
  proposedAsk: z.string().nullish(),
  introPath: z.string().nullish(),
  status: conferenceMeetingStatusSchema,
  notes: z.string().nullish(),
  nextStep: z.string().nullish(),
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
  fieldType: customFieldTypeSchema,
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
