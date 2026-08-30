import type {
  ConferenceCompanyImportPreview,
  ConferenceMeetingImportPreview,
  ConferencePersonImportPreview,
  CreateConferenceCompanyInput,
  CreateConferenceInput,
  CreateConferenceMeetingInput,
  CreateConferencePersonInput,
  UpdateConferenceCompanyInput,
  UpdateConferencePersonInput
} from "@clientloop/contracts";
import type {
  Account,
  Activity as CRMActivity,
  Conference,
  ConferenceCompany,
  ConferenceIcpCategory,
  ConferenceMeeting,
  ConferenceMeetingStatus,
  ConferenceOptOutStatus,
  ConferenceOutreachStatus,
  ConferencePerson,
  ConferencePriorityBand,
  ConferenceRole,
  ConferenceSourceType,
  Contact,
  CustomFieldType,
  Lead,
  Note,
  Opportunity,
  OpportunityStage,
  RecordEntityType,
  Task
} from "@clientloop/domain";

export type ViewMode = "pipeline" | "leads" | "network" | "accounts" | "contacts" | "conferences" | "data";
export type ConferenceTab = "companies" | "people" | "meetings" | "queries" | "templates" | "access";
export type ConferenceCompanyPatch = Omit<UpdateConferenceCompanyInput, "expectedVersion">;
export type ConferencePersonPatch = Omit<UpdateConferencePersonInput, "expectedVersion">;
export type ConferenceCompanyScoreFilter = "all" | "8" | "12" | "16";
export type ConferenceSignalFilter = "all" | "has_signal" | "strong_signal";
export type ConferenceCreateDraft = {
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  website: string;
  audienceType: string;
  organizerContact: string;
  sponsorPackageLink: string;
  appName: string;
  sourceNotes: string;
};
export type ConferenceCompanyDraft = {
  company: string;
  website: string;
  conferenceRole: ConferenceRole;
  sector: string;
  companyScore: string;
  sourceUrl: string;
  sourceNotes: string;
  productFit: boolean;
  expansionFit: boolean;
  budgetFit: boolean;
  marketEntryRelevance: boolean;
  partnershipRelevance: boolean;
};
export type ConferencePersonDraft = {
  name: string;
  title: string;
  conferenceCompanyId: string;
  linkedIn: string;
  email: string;
  conferenceSignal: string;
  icpCategory: ConferenceIcpCategory;
  buyingSignal: string;
  relationshipPath: string;
  sourceType: ConferenceSourceType;
  source: string;
  lawfulBasisNotes: string;
  optOutStatus: ConferenceOptOutStatus;
  seniorityScore: string;
  companyFitScore: string;
  signalScore: string;
  conferenceSignalScore: string;
  warmIntroScore: string;
  timingScore: string;
};
export type ConferenceMeetingDraft = {
  conferencePersonId: string;
  reasonToMeet: string;
  proposedAsk: string;
  introPath: string;
  status: ConferenceMeetingStatus;
  notes: string;
  nextStep: string;
};
export type CustomFieldDraft = {
  entityType: RecordEntityType;
  label: string;
  key: string;
  fieldType: CustomFieldType;
  required: boolean;
  isIndexed: boolean;
  options: string;
};
export type CustomFieldRecord = Account | Contact | Lead | Opportunity;
export type CustomFieldValueDrafts = Record<string, Record<string, string>>;
export type TimelineFilter = "all" | "activity" | "note" | "task";
export type ActivityPayloadDraft = {
  outcome: string;
  durationMinutes: string;
  attendees: string;
  emailDirection: "outbound" | "inbound";
  location: string;
};
export type ActivityEditDraft = {
  subject: string;
  payload: ActivityPayloadDraft;
};
export type TaskEditDraft = {
  title: string;
  description: string;
  dueAt: string;
  priority: Task["priority"];
};
export type TaskStatusFilter = Task["status"] | "all";
export type TaskOwnerFilter = "all" | "mine";
export type TaskDueFilter = "all" | "overdue" | "today" | "upcoming" | "none";
export type TimelineItem = {
  id: string;
  at: string;
  category: Exclude<TimelineFilter, "all">;
  kind: string;
  label: string;
  title: string;
  detail: string;
  activity?: CRMActivity;
  note?: Note;
  task?: Task;
};
export type SelectedRecordRef =
  | { entityType: "account"; id: string }
  | { entityType: "contact"; id: string }
  | { entityType: "lead"; id: string }
  | { entityType: "opportunity"; id: string };

export const stageLabels: Record<OpportunityStage, string> = {
  qualification: "Qualification",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed won",
  closed_lost: "Closed lost"
};

export const contactCsvPlaceholder = `firstName,lastName,email,phone
Jordan,Rivera,jordan@example.com,+1 415 555 0199`;
export const accountCsvPlaceholder = `name,domain,status
Acme Systems,acme.example,prospect`;
export const opportunityCsvPlaceholder = `name,accountId,ownerUserId,stage,amount,currency,probabilityPct
Expansion deal,00000000-0000-4000-8000-000000001001,00000000-0000-4000-8000-000000000101,qualification,25000,USD,20`;
export const conferenceCsvTemplate = `Conference name,Date,Location,Website,Audience type,Organizer contact,Sponsor package link,App name,Attendee access available,Source notes
Northwind Product Summit,2026-06-18,New York NY,https://example.com/northwind-product-summit,B2B software operators and partners,sponsors@example.com,https://example.com/sponsors,Summit Connect,opt_in_directory,Official conference page and sponsor package`;
export const conferenceCompanyCsvTemplate = `Company,Website,Conference role,Sector,Product fit,Expansion fit,Budget fit,Market entry relevance,Partnership relevance,Company score,Source URL
Harbor Analytics,https://harbor.example,sponsor,Enterprise data infrastructure,true,true,false,true,true,17,https://example.com/sponsors`;
export const conferencePersonCsvTemplate = `Name,Title,Company,LinkedIn,Email,Conference signal,ICP category,Buying signal,Relationship path,Outreach status,Source type,Source,Lawful basis notes,Opt out status,Seniority score,Company fit score,Signal score,Conference signal score,Warm intro score,Timing score
Avery Stone,Head of Partnerships,Harbor Analytics,https://linkedin.com/in/avery-stone-example,,Sponsor panel,partner,Partnership expansion,Ask Morgan,not_started,speaker_agenda,Agenda page,No email stored,not_opted_out,4,4,5,3,1,2`;
export const conferenceMeetingCsvTemplate = `Name,Company,Reason to meet,Proposed ask,Intro path,Meeting requested,Meeting booked,Notes,Next step
Avery Stone,Harbor Analytics,Compare notes on a possible product partnership,15-minute meeting during the summit,Morgan manager warm intro,yes,false,Prioritize before conference week,Request intro`;
export const conferenceCompanyCsvPlaceholder = conferenceCompanyCsvTemplate;
export const conferencePersonCsvPlaceholder = conferencePersonCsvTemplate;
export const conferenceMeetingCsvPlaceholder = conferenceMeetingCsvTemplate;

export const conferenceRoles: ConferenceRole[] = [
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
];
export const conferenceIcpCategories: ConferenceIcpCategory[] = [
  "executive",
  "economic_buyer",
  "operator",
  "technical_evaluator",
  "champion",
  "partner",
  "other",
  "unknown"
];
export const conferenceSourceTypes: ConferenceSourceType[] = [
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
];
export const conferenceMeetingStatuses: ConferenceMeetingStatus[] = [
  "not_requested",
  "requested",
  "booked",
  "declined",
  "completed",
  "cancelled"
];
export const conferenceOutreachStatuses: ConferenceOutreachStatus[] = [
  "not_started",
  "queued",
  "contacted",
  "replied",
  "meeting_requested",
  "meeting_booked",
  "nurturing",
  "disqualified"
];
export const conferencePriorityBands: ConferencePriorityBand[] = [
  "request_meeting",
  "personalized_outreach",
  "nurture",
  "do_not_prioritize"
];
export const conferenceOptOutStatuses: ConferenceOptOutStatus[] = [
  "unknown",
  "not_opted_out",
  "opted_out"
];


export type ImportPreviewSummary = {
  totalRows: number;
  validRows: number;
  errors: { row: number; field: string; message: string }[];
};
