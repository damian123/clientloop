export type EntityId = string;
export type TenantId = string;
export type ISODate = string;

export type CRMEntityType =
  | "account"
  | "contact"
  | "conference"
  | "conference_company"
  | "conference_person"
  | "conference_meeting"
  | "lead"
  | "opportunity"
  | "activity"
  | "task"
  | "note"
  | "user";

export type RecordEntityType = Extract<
  CRMEntityType,
  "account" | "contact" | "lead" | "opportunity"
>;

export interface AuditFields {
  tenantId: TenantId;
  createdAt: ISODate;
  updatedAt: ISODate;
  createdBy: EntityId;
  updatedBy: EntityId;
  version: number;
  archivedAt?: ISODate | null | undefined;
}

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "single_select"
  | "multi_select"
  | "currency"
  | "user_ref"
  | "account_ref";

export type CustomFieldPrimitive =
  | string
  | number
  | boolean
  | null
  | string[]
  | { id: string; label: string }
  | { amount: number; currency: string };

export interface CustomFieldDefinition extends AuditFields {
  id: EntityId;
  entityType: RecordEntityType;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  isIndexed: boolean;
  schema?: Record<string, unknown> | undefined;
}

export interface Account extends AuditFields {
  id: EntityId;
  name: string;
  domain?: string | null | undefined;
  ownerUserId?: EntityId | null | undefined;
  status: "prospect" | "customer" | "partner" | "inactive";
  customFields: Record<string, CustomFieldPrimitive>;
}

export interface Contact extends AuditFields {
  id: EntityId;
  accountId?: EntityId | null | undefined;
  firstName: string;
  lastName: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  ownerUserId?: EntityId | null | undefined;
  customFields: Record<string, CustomFieldPrimitive>;
}

export interface Lead extends AuditFields {
  id: EntityId;
  source: string;
  companyName?: string | null | undefined;
  contactName: string;
  email?: string | null | undefined;
  status: "new" | "qualified" | "disqualified" | "converted";
  convertedAt?: ISODate | null | undefined;
  convertedAccountId?: EntityId | null | undefined;
  convertedContactId?: EntityId | null | undefined;
  convertedOpportunityId?: EntityId | null | undefined;
  customFields: Record<string, CustomFieldPrimitive>;
}

export type OpportunityStage =
  | "qualification"
  | "discovery"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Opportunity extends AuditFields {
  id: EntityId;
  accountId: EntityId;
  primaryContactId?: EntityId | null | undefined;
  name: string;
  stage: OpportunityStage;
  amount?: number | null | undefined;
  currency: string;
  expectedCloseDate?: ISODate | null | undefined;
  ownerUserId: EntityId;
  probabilityPct?: number | null | undefined;
  customFields: Record<string, CustomFieldPrimitive>;
}

export type AttendeeAccessStatus =
  | "unknown"
  | "unavailable"
  | "registered_only"
  | "sponsor_directory"
  | "opt_in_directory"
  | "lead_retrieval"
  | "post_event_opt_in";

export type ConferenceRole =
  | "speaker"
  | "moderator"
  | "sponsor"
  | "exhibitor"
  | "startup_showcase"
  | "award_finalist"
  | "side_event_host"
  | "attendee"
  | "organizer"
  | "partner"
  | "other";

export type ConferenceSourceType =
  | "official_directory"
  | "sponsor_access"
  | "speaker_agenda"
  | "sponsor_exhibitor_list"
  | "startup_showcase"
  | "linkedin_public"
  | "side_event_rsvp"
  | "warm_network"
  | "press_release"
  | "manual_research";

export type ConferenceIcpCategory =
  | "executive"
  | "economic_buyer"
  | "operator"
  | "technical_evaluator"
  | "champion"
  | "partner"
  | "other"
  | "unknown";

export type ConferenceOutreachStatus =
  | "not_started"
  | "queued"
  | "contacted"
  | "replied"
  | "meeting_requested"
  | "meeting_booked"
  | "nurturing"
  | "disqualified";

export type ConferenceOptOutStatus = "unknown" | "not_opted_out" | "opted_out";

export type ConferencePriorityBand =
  | "request_meeting"
  | "personalized_outreach"
  | "nurture"
  | "do_not_prioritize";

export type ConferenceMeetingStatus =
  | "not_requested"
  | "requested"
  | "booked"
  | "declined"
  | "completed"
  | "cancelled";

export interface Conference extends AuditFields {
  id: EntityId;
  name: string;
  startDate: ISODate;
  endDate?: ISODate | null | undefined;
  location?: string | null | undefined;
  website?: string | null | undefined;
  audienceType?: string | null | undefined;
  organizerContact?: string | null | undefined;
  sponsorPackageLink?: string | null | undefined;
  appName?: string | null | undefined;
  attendeeAccessStatus: AttendeeAccessStatus;
  sourceNotes?: string | null | undefined;
}

export interface ConferenceCompany extends AuditFields {
  id: EntityId;
  conferenceId: EntityId;
  accountId?: EntityId | null | undefined;
  company: string;
  website?: string | null | undefined;
  conferenceRole: ConferenceRole;
  sector?: string | null | undefined;
  productFit: boolean;
  expansionFit: boolean;
  budgetFit: boolean;
  marketEntryRelevance: boolean;
  partnershipRelevance: boolean;
  companyScore: number;
  sourceUrl?: string | null | undefined;
  sourceNotes?: string | null | undefined;
}

export interface ConferencePerson extends AuditFields {
  id: EntityId;
  conferenceId: EntityId;
  conferenceCompanyId?: EntityId | null | undefined;
  accountId?: EntityId | null | undefined;
  contactId?: EntityId | null | undefined;
  name: string;
  title: string;
  linkedIn?: string | null | undefined;
  email?: string | null | undefined;
  conferenceSignal?: string | null | undefined;
  icpCategory: ConferenceIcpCategory;
  buyingSignal?: string | null | undefined;
  relationshipPath?: string | null | undefined;
  outreachStatus: ConferenceOutreachStatus;
  sourceType: ConferenceSourceType;
  source?: string | null | undefined;
  lawfulBasisNotes?: string | null | undefined;
  optOutStatus: ConferenceOptOutStatus;
  seniorityScore: number;
  companyFitScore: number;
  signalScore: number;
  conferenceSignalScore: number;
  warmIntroScore: number;
  timingScore: number;
  totalScore: number;
  priorityBand: ConferencePriorityBand;
}

export interface ConferenceMeeting extends AuditFields {
  id: EntityId;
  conferenceId: EntityId;
  conferencePersonId: EntityId;
  reasonToMeet: string;
  proposedAsk?: string | null | undefined;
  introPath?: string | null | undefined;
  status: ConferenceMeetingStatus;
  notes?: string | null | undefined;
  nextStep?: string | null | undefined;
}

export interface EntityRef {
  type: CRMEntityType;
  id: EntityId;
}

export interface Activity extends AuditFields {
  id: EntityId;
  parent: EntityRef;
  type: "call" | "email" | "meeting" | "event" | "system";
  subject: string;
  occurredAt: ISODate;
  payload: Record<string, unknown>;
}

export interface Task extends AuditFields {
  id: EntityId;
  parent?: EntityRef | undefined;
  title: string;
  description?: string | null | undefined;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  dueAt?: ISODate | null | undefined;
  assignedUserId: EntityId;
}

export interface Note extends AuditFields {
  id: EntityId;
  parent: EntityRef;
  body: string;
  bodyFormat: "markdown" | "html" | "plain_text";
}

export type PermissionResource =
  | "account"
  | "contact"
  | "conference"
  | "lead"
  | "opportunity"
  | "activity"
  | "task"
  | "note"
  | "custom_field"
  | "user"
  | "admin";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "assign"
  | "export"
  | "manage";

export type PermissionCondition = "own" | "team" | "tenant" | "all";

export interface Permission {
  id: EntityId;
  resource: PermissionResource;
  action: PermissionAction;
  condition?: PermissionCondition | undefined;
}

export interface Role extends AuditFields {
  id: EntityId;
  name: string;
  permissions: Permission[];
}

export interface User extends AuditFields {
  id: EntityId;
  email: string;
  displayName: string;
  status: "invited" | "active" | "suspended";
  roleIds: EntityId[];
  teamIds: EntityId[];
}

export interface WebhookSubscription {
  id: EntityId;
  tenantId: TenantId;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  secretFingerprint: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  lastErrorAt?: ISODate | null | undefined;
  lastError?: string | null | undefined;
}

export interface PageInfo {
  endCursor?: string | undefined;
  hasNextPage: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface AccessPrincipal {
  tenantId: TenantId;
  user: User;
  roles: Role[];
}

export type CRMRecord =
  | Account
  | Contact
  | Conference
  | ConferenceCompany
  | ConferencePerson
  | ConferenceMeeting
  | Lead
  | Opportunity
  | Activity
  | Task
  | Note
  | User;
