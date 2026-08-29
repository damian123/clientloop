import { z } from "zod";
import {
  accountSchema,
  activitySchema,
  contactSchema,
  attendeeAccessStatusSchema,
  conferenceCompanySchema,
  conferenceIcpCategorySchema,
  conferenceMeetingSchema,
  conferenceMeetingStatusSchema,
  conferenceOptOutStatusSchema,
  conferenceOutreachStatusSchema,
  conferencePersonSchema,
  conferenceRoleSchema,
  conferenceSchema,
  conferenceSourceTypeSchema,
  customFieldDefinitionSchema,
  customFieldsSchema,
  customFieldTypeSchema,
  entityTypeSchema,
  idSchema,
  leadSchema,
  noteSchema,
  opportunitySchema,
  opportunityStageSchema,
  pageSchema,
  permissionSchema,
  recordEntityTypeSchema,
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

const optionalUrlSchema = z.string().url().optional();
const nullableUrlSchema = z.string().url().nullable().optional();
const score0to4 = z.number().int().min(0).max(4);
const score0to5 = z.number().int().min(0).max(5);
const score0to3 = z.number().int().min(0).max(3);
const score0to2 = z.number().int().min(0).max(2);

export const createConferenceSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  location: z.string().optional(),
  website: optionalUrlSchema,
  audienceType: z.string().optional(),
  organizerContact: z.string().optional(),
  sponsorPackageLink: optionalUrlSchema,
  appName: z.string().optional(),
  attendeeAccessStatus: attendeeAccessStatusSchema.default("unknown"),
  sourceNotes: z.string().optional()
});

export const updateConferenceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  website: nullableUrlSchema,
  audienceType: z.string().nullable().optional(),
  organizerContact: z.string().nullable().optional(),
  sponsorPackageLink: nullableUrlSchema,
  appName: z.string().nullable().optional(),
  attendeeAccessStatus: attendeeAccessStatusSchema.optional(),
  sourceNotes: z.string().nullable().optional()
});

export const createConferenceCompanySchema = z.object({
  accountId: idSchema.optional(),
  company: z.string().min(1),
  website: optionalUrlSchema,
  conferenceRole: conferenceRoleSchema.default("other"),
  sector: z.string().optional(),
  rwaRelevance: z.boolean().default(false),
  privateMarketsRelevance: z.boolean().default(false),
  fundraisingRelevance: z.boolean().default(false),
  marketEntryRelevance: z.boolean().default(false),
  partnershipRelevance: z.boolean().default(false),
  companyScore: z.number().int().min(0).max(20).default(0),
  sourceUrl: optionalUrlSchema,
  sourceNotes: z.string().optional()
});

export const updateConferenceCompanySchema = z.object({
  expectedVersion: z.number().int().positive(),
  accountId: idSchema.nullable().optional(),
  company: z.string().min(1).optional(),
  website: nullableUrlSchema,
  conferenceRole: conferenceRoleSchema.optional(),
  sector: z.string().nullable().optional(),
  rwaRelevance: z.boolean().optional(),
  privateMarketsRelevance: z.boolean().optional(),
  fundraisingRelevance: z.boolean().optional(),
  marketEntryRelevance: z.boolean().optional(),
  partnershipRelevance: z.boolean().optional(),
  companyScore: z.number().int().min(0).max(20).optional(),
  sourceUrl: nullableUrlSchema,
  sourceNotes: z.string().nullable().optional()
});

export const conferencePersonScoreInputSchema = z.object({
  seniorityScore: score0to4,
  companyFitScore: score0to4,
  signalScore: score0to5,
  conferenceSignalScore: score0to3,
  warmIntroScore: score0to2,
  timingScore: score0to2
});

export const createConferencePersonSchema = z.object({
  conferenceCompanyId: idSchema.optional(),
  accountId: idSchema.optional(),
  contactId: idSchema.optional(),
  name: z.string().min(1),
  title: z.string().min(1),
  linkedIn: optionalUrlSchema,
  email: z.string().email().optional(),
  conferenceSignal: z.string().optional(),
  icpCategory: conferenceIcpCategorySchema.default("unknown"),
  buyingSignal: z.string().optional(),
  relationshipPath: z.string().optional(),
  outreachStatus: conferenceOutreachStatusSchema.default("not_started"),
  sourceType: conferenceSourceTypeSchema.default("manual_research"),
  source: z.string().optional(),
  lawfulBasisNotes: z.string().optional(),
  optOutStatus: conferenceOptOutStatusSchema.default("unknown"),
  seniorityScore: score0to4.default(0),
  companyFitScore: score0to4.default(0),
  signalScore: score0to5.default(0),
  conferenceSignalScore: score0to3.default(0),
  warmIntroScore: score0to2.default(0),
  timingScore: score0to2.default(0)
}).superRefine((input, ctx) => {
  if (input.email && !input.lawfulBasisNotes?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lawfulBasisNotes"],
      message: "Lawful basis notes are required when email is stored"
    });
  }
});

export const updateConferencePersonSchema = z.object({
  expectedVersion: z.number().int().positive(),
  conferenceCompanyId: idSchema.nullable().optional(),
  accountId: idSchema.nullable().optional(),
  contactId: idSchema.nullable().optional(),
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  linkedIn: nullableUrlSchema,
  email: z.string().email().nullable().optional(),
  conferenceSignal: z.string().nullable().optional(),
  icpCategory: conferenceIcpCategorySchema.optional(),
  buyingSignal: z.string().nullable().optional(),
  relationshipPath: z.string().nullable().optional(),
  outreachStatus: conferenceOutreachStatusSchema.optional(),
  sourceType: conferenceSourceTypeSchema.optional(),
  source: z.string().nullable().optional(),
  lawfulBasisNotes: z.string().nullable().optional(),
  optOutStatus: conferenceOptOutStatusSchema.optional(),
  seniorityScore: score0to4.optional(),
  companyFitScore: score0to4.optional(),
  signalScore: score0to5.optional(),
  conferenceSignalScore: score0to3.optional(),
  warmIntroScore: score0to2.optional(),
  timingScore: score0to2.optional()
});

export const scoreConferencePersonSchema = conferencePersonScoreInputSchema.extend({
  expectedVersion: z.number().int().positive(),
  scoreNotes: z.string().optional()
});

export const createConferenceMeetingSchema = z.object({
  conferencePersonId: idSchema,
  reasonToMeet: z.string().min(1),
  proposedAsk: z.string().optional(),
  introPath: z.string().optional(),
  status: conferenceMeetingStatusSchema.default("not_requested"),
  notes: z.string().optional(),
  nextStep: z.string().optional()
});

export const updateConferenceMeetingSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reasonToMeet: z.string().min(1).optional(),
  proposedAsk: z.string().nullable().optional(),
  introPath: z.string().nullable().optional(),
  status: conferenceMeetingStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  nextStep: z.string().nullable().optional()
});

export const updateOpportunitySchema = z.object({
  expectedVersion: z.number().int().positive(),
  stage: opportunityStageSchema.optional(),
  amount: z.number().nonnegative().nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
  probabilityPct: z.number().int().min(0).max(100).nullable().optional(),
  customFields: customFieldsSchema.optional()
});

export const convertLeadOpportunitySchema = z.object({
  name: z.string().min(1),
  stage: opportunityStageSchema.default("qualification"),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  expectedCloseDate: z.string().optional(),
  ownerUserId: idSchema.optional(),
  probabilityPct: z.number().int().min(0).max(100).optional(),
  customFields: customFieldsSchema.default({})
});

export const convertLeadSchema = z.object({
  expectedVersion: z.number().int().positive(),
  accountId: idSchema.optional(),
  accountName: z.string().min(1).optional(),
  contactFirstName: z.string().min(1).optional(),
  contactLastName: z.string().min(1).optional(),
  opportunity: convertLeadOpportunitySchema.optional()
}).refine((input) => input.accountId || input.accountName, {
  message: "accountId or accountName is required",
  path: ["accountName"]
});

export const leadConversionResultSchema = z.object({
  lead: leadSchema,
  account: accountSchema,
  contact: contactSchema,
  opportunity: opportunitySchema.nullish()
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

export const updateTaskSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueAt: z.string().nullable().optional()
});

export const appendNoteSchema = z.object({
  parent: z.object({ type: entityTypeSchema, id: idSchema }),
  body: z.string().min(1),
  bodyFormat: z.enum(["markdown", "html", "plain_text"]).default("plain_text")
});

export const updateNoteSchema = z.object({
  expectedVersion: z.number().int().positive(),
  body: z.string().min(1),
  bodyFormat: z.enum(["markdown", "html", "plain_text"]).optional()
});

export const createActivitySchema = z.object({
  parent: z.object({ type: entityTypeSchema, id: idSchema }),
  type: z.enum(["call", "email", "meeting", "event", "system"]),
  subject: z.string().min(1),
  occurredAt: z.string().optional(),
  payload: z.record(z.unknown()).default({})
});

export const updateActivitySchema = z.object({
  expectedVersion: z.number().int().positive(),
  subject: z.string().min(1).optional(),
  payload: z.record(z.unknown()).optional()
});

export const createCustomFieldDefinitionSchema = z.object({
  entityType: recordEntityTypeSchema,
  key: z.string().min(1).optional(),
  label: z.string().min(1),
  fieldType: customFieldTypeSchema,
  required: z.boolean().default(false),
  isIndexed: z.boolean().default(false),
  schema: z.record(z.unknown()).default({})
});

export const updateCustomFieldValuesSchema = z.object({
  expectedVersion: z.number().int().positive(),
  customFields: customFieldsSchema
});

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(webhookEventTypeSchema).min(1),
  signingSecret: z.string().min(16).optional()
});

export const createWebhookSubscriptionResponseSchema = webhookSubscriptionSchema.extend({
  signingSecret: z.string()
});

export const devLoginSchema = z.object({
  tenantId: idSchema.optional(),
  userId: idSchema.optional()
});

export const sessionUserSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  displayName: z.string(),
  permissions: z.array(permissionSchema)
});

export const sessionResponseSchema = z.object({
  authenticated: z.literal(true),
  tenantId: idSchema,
  user: sessionUserSchema,
  csrfToken: z.string().optional()
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

export const accountImportMappingSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  status: z.string().optional(),
  ownerUserId: z.string().optional()
});

export const accountImportRequestSchema = z.object({
  csv: z.string().min(1),
  mapping: accountImportMappingSchema.optional()
});

export const accountImportRowSchema = z.object({
  row: z.number().int().positive(),
  name: z.string(),
  domain: z.string().optional(),
  status: z.enum(["prospect", "customer", "partner", "inactive"]),
  ownerUserId: z.string().optional()
});

export const accountImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(contactImportErrorSchema),
  rows: z.array(accountImportRowSchema)
});

export const accountImportResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  accounts: z.array(accountSchema),
  errors: z.array(contactImportErrorSchema)
});

export const opportunityImportMappingSchema = z.object({
  name: z.string().optional(),
  stage: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  accountId: z.string().optional(),
  ownerUserId: z.string().optional(),
  probabilityPct: z.string().optional()
});

export const opportunityImportRequestSchema = z.object({
  csv: z.string().min(1),
  mapping: opportunityImportMappingSchema.optional()
});

export const opportunityImportRowSchema = z.object({
  row: z.number().int().positive(),
  name: z.string(),
  stage: opportunityStageSchema,
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3),
  expectedCloseDate: z.string().optional(),
  accountId: z.string(),
  ownerUserId: z.string(),
  probabilityPct: z.number().int().min(0).max(100).optional()
});

export const opportunityImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(contactImportErrorSchema),
  rows: z.array(opportunityImportRowSchema)
});

export const opportunityImportResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  opportunities: z.array(opportunitySchema),
  errors: z.array(contactImportErrorSchema)
});

export const conferenceCompanyImportMappingSchema = z.object({
  company: z.string().optional(),
  website: z.string().optional(),
  conferenceRole: z.string().optional(),
  sector: z.string().optional(),
  rwaRelevance: z.string().optional(),
  privateMarketsRelevance: z.string().optional(),
  fundraisingRelevance: z.string().optional(),
  marketEntryRelevance: z.string().optional(),
  partnershipRelevance: z.string().optional(),
  companyScore: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceNotes: z.string().optional(),
  accountId: z.string().optional()
});

export const conferenceImportRequestSchema = z.object({
  csv: z.string().min(1),
  mapping: conferenceCompanyImportMappingSchema.optional()
});

export const conferenceCompanyImportRowSchema = z.object({
  row: z.number().int().positive(),
  company: z.string(),
  website: z.string().optional(),
  conferenceRole: conferenceRoleSchema,
  sector: z.string().optional(),
  rwaRelevance: z.boolean(),
  privateMarketsRelevance: z.boolean(),
  fundraisingRelevance: z.boolean(),
  marketEntryRelevance: z.boolean(),
  partnershipRelevance: z.boolean(),
  companyScore: z.number().int().min(0).max(20),
  sourceUrl: z.string().optional(),
  sourceNotes: z.string().optional(),
  accountId: z.string().optional()
});

export const conferenceCompanyImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(contactImportErrorSchema),
  rows: z.array(conferenceCompanyImportRowSchema)
});

export const conferenceCompanyImportResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  companies: z.array(conferenceCompanySchema),
  errors: z.array(contactImportErrorSchema)
});

export const conferencePersonImportMappingSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  conferenceCompanyId: z.string().optional(),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  linkedIn: z.string().optional(),
  email: z.string().optional(),
  conferenceSignal: z.string().optional(),
  icpCategory: z.string().optional(),
  buyingSignal: z.string().optional(),
  relationshipPath: z.string().optional(),
  outreachStatus: z.string().optional(),
  sourceType: z.string().optional(),
  source: z.string().optional(),
  lawfulBasisNotes: z.string().optional(),
  optOutStatus: z.string().optional(),
  seniorityScore: z.string().optional(),
  companyFitScore: z.string().optional(),
  signalScore: z.string().optional(),
  conferenceSignalScore: z.string().optional(),
  warmIntroScore: z.string().optional(),
  timingScore: z.string().optional()
});

export const conferencePersonImportRequestSchema = z.object({
  csv: z.string().min(1),
  mapping: conferencePersonImportMappingSchema.optional()
});

export const conferencePersonImportRowSchema = z.object({
  row: z.number().int().positive(),
  name: z.string(),
  title: z.string(),
  company: z.string().optional(),
  conferenceCompanyId: z.string().optional(),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  linkedIn: z.string().optional(),
  email: z.string().optional(),
  conferenceSignal: z.string().optional(),
  icpCategory: conferenceIcpCategorySchema,
  buyingSignal: z.string().optional(),
  relationshipPath: z.string().optional(),
  outreachStatus: conferenceOutreachStatusSchema,
  sourceType: conferenceSourceTypeSchema,
  source: z.string().optional(),
  lawfulBasisNotes: z.string().optional(),
  optOutStatus: conferenceOptOutStatusSchema,
  seniorityScore: score0to4,
  companyFitScore: score0to4,
  signalScore: score0to5,
  conferenceSignalScore: score0to3,
  warmIntroScore: score0to2,
  timingScore: score0to2
});

export const conferencePersonImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(contactImportErrorSchema),
  rows: z.array(conferencePersonImportRowSchema)
});

export const conferencePersonImportResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  people: z.array(conferencePersonSchema),
  errors: z.array(contactImportErrorSchema)
});

export const conferenceMeetingImportMappingSchema = z.object({
  conferencePersonId: z.string().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  reasonToMeet: z.string().optional(),
  proposedAsk: z.string().optional(),
  introPath: z.string().optional(),
  status: z.string().optional(),
  meetingRequested: z.string().optional(),
  meetingBooked: z.string().optional(),
  notes: z.string().optional(),
  nextStep: z.string().optional()
});

export const conferenceMeetingImportRequestSchema = z.object({
  csv: z.string().min(1),
  mapping: conferenceMeetingImportMappingSchema.optional()
});

export const conferenceMeetingImportRowSchema = z.object({
  row: z.number().int().positive(),
  conferencePersonId: z.string().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  reasonToMeet: z.string(),
  proposedAsk: z.string().optional(),
  introPath: z.string().optional(),
  status: conferenceMeetingStatusSchema,
  meetingRequested: z.boolean().optional(),
  meetingBooked: z.boolean().optional(),
  notes: z.string().optional(),
  nextStep: z.string().optional()
}).superRefine((row, ctx) => {
  if (!row.conferencePersonId && !row.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Name or conference person ID is required"
    });
  }
});

export const conferenceMeetingImportPreviewSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(contactImportErrorSchema),
  rows: z.array(conferenceMeetingImportRowSchema)
});

export const conferenceMeetingImportResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  meetings: z.array(conferenceMeetingSchema),
  errors: z.array(contactImportErrorSchema)
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(25).default(10)
});

export const dashboardSchema = z.object({
  accounts: z.array(accountSchema),
  contacts: z.array(contactSchema),
  conferences: z.array(conferenceSchema),
  conferenceCompanies: z.array(conferenceCompanySchema),
  conferencePeople: z.array(conferencePersonSchema),
  conferenceMeetings: z.array(conferenceMeetingSchema),
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

export const customFieldValueUpdateResultSchema = z.union([
  accountSchema,
  contactSchema,
  leadSchema,
  opportunitySchema
]);

export const apiSchemas = {
  account: accountSchema,
  contact: contactSchema,
  lead: leadSchema,
  opportunity: opportunitySchema,
  conference: conferenceSchema,
  conferenceCompany: conferenceCompanySchema,
  conferencePerson: conferencePersonSchema,
  conferenceMeeting: conferenceMeetingSchema,
  task: taskSchema,
  note: noteSchema,
  activity: activitySchema,
  customFieldDefinition: customFieldDefinitionSchema,
  customFieldDefinitions: z.array(customFieldDefinitionSchema),
  accountPage: pageSchema(accountSchema),
  contactPage: pageSchema(contactSchema),
  leadPage: pageSchema(leadSchema),
  opportunityPage: pageSchema(opportunitySchema),
  conferencePage: pageSchema(conferenceSchema),
  conferenceCompanyPage: pageSchema(conferenceCompanySchema),
  conferencePersonPage: pageSchema(conferencePersonSchema),
  conferenceMeetingPage: pageSchema(conferenceMeetingSchema),
  leadConversionResult: leadConversionResultSchema,
  taskPage: pageSchema(taskSchema),
  activityPage: pageSchema(activitySchema),
  dashboard: dashboardSchema,
  searchResults: z.array(searchResultSchema),
  session: sessionResponseSchema,
  webhookSubscription: webhookSubscriptionSchema,
  webhookSubscriptions: z.array(webhookSubscriptionSchema),
  createWebhookSubscriptionResponse: createWebhookSubscriptionResponseSchema,
  accountImportPreview: accountImportPreviewSchema,
  accountImportResult: accountImportResultSchema,
  contactImportPreview: contactImportPreviewSchema,
  contactImportResult: contactImportResultSchema,
  opportunityImportPreview: opportunityImportPreviewSchema,
  opportunityImportResult: opportunityImportResultSchema,
  conferenceCompanyImportPreview: conferenceCompanyImportPreviewSchema,
  conferenceCompanyImportResult: conferenceCompanyImportResultSchema,
  conferencePersonImportPreview: conferencePersonImportPreviewSchema,
  conferencePersonImportResult: conferencePersonImportResultSchema,
  conferenceMeetingImportPreview: conferenceMeetingImportPreviewSchema,
  conferenceMeetingImportResult: conferenceMeetingImportResultSchema,
  customFieldValueUpdateResult: customFieldValueUpdateResultSchema
};

export type ListQuery = z.infer<typeof listQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type ConvertLeadOpportunityInput = z.infer<typeof convertLeadOpportunitySchema>;
export type LeadConversionResult = z.infer<typeof leadConversionResultSchema>;
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type CreateConferenceInput = z.infer<typeof createConferenceSchema>;
export type UpdateConferenceInput = z.infer<typeof updateConferenceSchema>;
export type CreateConferenceCompanyInput = z.infer<typeof createConferenceCompanySchema>;
export type UpdateConferenceCompanyInput = z.infer<typeof updateConferenceCompanySchema>;
export type CreateConferencePersonInput = z.infer<typeof createConferencePersonSchema>;
export type UpdateConferencePersonInput = z.infer<typeof updateConferencePersonSchema>;
export type ScoreConferencePersonInput = z.infer<typeof scoreConferencePersonSchema>;
export type CreateConferenceMeetingInput = z.infer<typeof createConferenceMeetingSchema>;
export type UpdateConferenceMeetingInput = z.infer<typeof updateConferenceMeetingSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AppendNoteInput = z.infer<typeof appendNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type CreateCustomFieldDefinitionInput = z.infer<typeof createCustomFieldDefinitionSchema>;
export type UpdateCustomFieldValuesInput = z.infer<typeof updateCustomFieldValuesSchema>;
export type CustomFieldValueUpdateResult = z.infer<typeof customFieldValueUpdateResultSchema>;
export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionSchema>;
export type CreateWebhookSubscriptionResponse = z.infer<typeof createWebhookSubscriptionResponseSchema>;
export type DevLoginInput = z.infer<typeof devLoginSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type ExportEntity = z.infer<typeof exportEntitySchema>;
export type ContactImportMapping = z.infer<typeof contactImportMappingSchema>;
export type ContactImportRequest = z.infer<typeof contactImportRequestSchema>;
export type ContactImportError = z.infer<typeof contactImportErrorSchema>;
export type ContactImportRow = z.infer<typeof contactImportRowSchema>;
export type ContactImportPreview = z.infer<typeof contactImportPreviewSchema>;
export type ContactImportResult = z.infer<typeof contactImportResultSchema>;
export type AccountImportMapping = z.infer<typeof accountImportMappingSchema>;
export type AccountImportRequest = z.infer<typeof accountImportRequestSchema>;
export type AccountImportRow = z.infer<typeof accountImportRowSchema>;
export type AccountImportPreview = z.infer<typeof accountImportPreviewSchema>;
export type AccountImportResult = z.infer<typeof accountImportResultSchema>;
export type OpportunityImportMapping = z.infer<typeof opportunityImportMappingSchema>;
export type OpportunityImportRequest = z.infer<typeof opportunityImportRequestSchema>;
export type OpportunityImportRow = z.infer<typeof opportunityImportRowSchema>;
export type OpportunityImportPreview = z.infer<typeof opportunityImportPreviewSchema>;
export type OpportunityImportResult = z.infer<typeof opportunityImportResultSchema>;
export type ConferenceCompanyImportMapping = z.infer<typeof conferenceCompanyImportMappingSchema>;
export type ConferenceImportRequest = z.infer<typeof conferenceImportRequestSchema>;
export type ConferenceCompanyImportRow = z.infer<typeof conferenceCompanyImportRowSchema>;
export type ConferenceCompanyImportPreview = z.infer<typeof conferenceCompanyImportPreviewSchema>;
export type ConferenceCompanyImportResult = z.infer<typeof conferenceCompanyImportResultSchema>;
export type ConferencePersonImportMapping = z.infer<typeof conferencePersonImportMappingSchema>;
export type ConferencePersonImportRequest = z.infer<typeof conferencePersonImportRequestSchema>;
export type ConferencePersonImportRow = z.infer<typeof conferencePersonImportRowSchema>;
export type ConferencePersonImportPreview = z.infer<typeof conferencePersonImportPreviewSchema>;
export type ConferencePersonImportResult = z.infer<typeof conferencePersonImportResultSchema>;
export type ConferenceMeetingImportMapping = z.infer<typeof conferenceMeetingImportMappingSchema>;
export type ConferenceMeetingImportRequest = z.infer<typeof conferenceMeetingImportRequestSchema>;
export type ConferenceMeetingImportRow = z.infer<typeof conferenceMeetingImportRowSchema>;
export type ConferenceMeetingImportPreview = z.infer<typeof conferenceMeetingImportPreviewSchema>;
export type ConferenceMeetingImportResult = z.infer<typeof conferenceMeetingImportResultSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DashboardResponse = z.infer<typeof dashboardSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
