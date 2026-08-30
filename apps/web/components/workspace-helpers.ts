import type {
  CreateConferenceCompanyInput,
  CreateConferenceInput,
  CreateConferenceMeetingInput,
  CreateConferencePersonInput,
  CreateCustomFieldDefinitionInput,
  SearchResult,
  UpdateActivityInput
} from "@clientloop/contracts";
import type {
  Account,
  Activity as CRMActivity,
  ConferenceCompany,
  ConferenceIcpCategory,
  ConferenceOutreachStatus,
  ConferencePerson,
  ConferencePriorityBand,
  Contact,
  CustomFieldDefinition,
  CustomFieldPrimitive,
  CustomFieldType,
  Lead,
  Opportunity,
  RecordEntityType,
  Task
} from "@clientloop/domain";
import { CRMClientError } from "@clientloop/ui-sdk";
import type {
  ActivityPayloadDraft,
  ConferenceCompanyDraft,
  ConferenceCreateDraft,
  ConferenceMeetingDraft,
  ConferencePersonDraft,
  ConferenceTab,
  CustomFieldDraft,
  CustomFieldRecord,
  CustomFieldValueDrafts,
  SelectedRecordRef,
  TaskEditDraft,
  TaskDueFilter,
  TaskOwnerFilter,
  TaskStatusFilter,
  TimelineFilter,
  ViewMode
} from "./workspace-model";
import { conferenceCompanyCsvTemplate, conferenceCsvTemplate, conferenceMeetingCsvTemplate, conferencePersonCsvTemplate } from "./workspace-model";

export function emptyConferenceCreateDraft(): ConferenceCreateDraft {
  return {
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    location: "",
    website: "",
    audienceType: "",
    organizerContact: "",
    sponsorPackageLink: "",
    appName: "",
    sourceNotes: ""
  };
}

export function emptyConferenceCompanyDraft(): ConferenceCompanyDraft {
  return {
    company: "",
    website: "",
    conferenceRole: "other",
    sector: "",
    companyScore: "0",
    sourceUrl: "",
    sourceNotes: "",
    productFit: false,
    expansionFit: false,
    budgetFit: false,
    marketEntryRelevance: false,
    partnershipRelevance: false
  };
}

export function emptyConferencePersonDraft(): ConferencePersonDraft {
  return {
    name: "",
    title: "",
    conferenceCompanyId: "",
    linkedIn: "",
    email: "",
    conferenceSignal: "",
    icpCategory: "unknown",
    buyingSignal: "",
    relationshipPath: "",
    sourceType: "manual_research",
    source: "",
    lawfulBasisNotes: "",
    optOutStatus: "unknown",
    seniorityScore: "0",
    companyFitScore: "0",
    signalScore: "0",
    conferenceSignalScore: "0",
    warmIntroScore: "0",
    timingScore: "0"
  };
}

export function emptyConferenceMeetingDraft(): ConferenceMeetingDraft {
  return {
    conferencePersonId: "",
    reasonToMeet: "",
    proposedAsk: "",
    introPath: "",
    status: "not_requested",
    notes: "",
    nextStep: ""
  };
}

export function conferenceCreateInput(draft: ConferenceCreateDraft): CreateConferenceInput | null {
  const name = draft.name.trim();
  const startDate = draft.startDate.trim();
  if (!name || !startDate) {
    return null;
  }

  return {
    name,
    startDate,
    endDate: draft.endDate.trim() || undefined,
    location: draft.location.trim() || undefined,
    website: draft.website.trim() || undefined,
    audienceType: draft.audienceType.trim() || undefined,
    organizerContact: draft.organizerContact.trim() || undefined,
    sponsorPackageLink: draft.sponsorPackageLink.trim() || undefined,
    appName: draft.appName.trim() || undefined,
    attendeeAccessStatus: "unknown",
    sourceNotes: draft.sourceNotes.trim() || undefined
  };
}

export function conferenceCompanyInput(
  draft: ConferenceCompanyDraft
): CreateConferenceCompanyInput | null {
  const company = draft.company.trim();
  if (!company) {
    return null;
  }

  return {
    company,
    website: draft.website.trim() || undefined,
    conferenceRole: draft.conferenceRole,
    sector: draft.sector.trim() || undefined,
    companyScore: numberOrDefault(draft.companyScore, 0),
    sourceUrl: draft.sourceUrl.trim() || undefined,
    sourceNotes: draft.sourceNotes.trim() || undefined,
    productFit: draft.productFit,
    expansionFit: draft.expansionFit,
    budgetFit: draft.budgetFit,
    marketEntryRelevance: draft.marketEntryRelevance,
    partnershipRelevance: draft.partnershipRelevance
  };
}

export function conferencePersonInput(draft: ConferencePersonDraft): CreateConferencePersonInput | null {
  const name = draft.name.trim();
  const title = draft.title.trim();
  const email = draft.email.trim();
  const lawfulBasisNotes = draft.lawfulBasisNotes.trim();
  if (!name || !title || (email && !lawfulBasisNotes)) {
    return null;
  }

  return {
    conferenceCompanyId: draft.conferenceCompanyId || undefined,
    name,
    title,
    linkedIn: draft.linkedIn.trim() || undefined,
    email: email || undefined,
    conferenceSignal: draft.conferenceSignal.trim() || undefined,
    icpCategory: draft.icpCategory,
    buyingSignal: draft.buyingSignal.trim() || undefined,
    relationshipPath: draft.relationshipPath.trim() || undefined,
    outreachStatus: "not_started",
    sourceType: draft.sourceType,
    source: draft.source.trim() || undefined,
    lawfulBasisNotes: lawfulBasisNotes || undefined,
    optOutStatus: draft.optOutStatus,
    seniorityScore: numberOrDefault(draft.seniorityScore, 0),
    companyFitScore: numberOrDefault(draft.companyFitScore, 0),
    signalScore: numberOrDefault(draft.signalScore, 0),
    conferenceSignalScore: numberOrDefault(draft.conferenceSignalScore, 0),
    warmIntroScore: numberOrDefault(draft.warmIntroScore, 0),
    timingScore: numberOrDefault(draft.timingScore, 0)
  };
}

export function conferenceMeetingInput(draft: ConferenceMeetingDraft): CreateConferenceMeetingInput | null {
  const conferencePersonId = draft.conferencePersonId.trim();
  const reasonToMeet = draft.reasonToMeet.trim();
  if (!conferencePersonId || !reasonToMeet) {
    return null;
  }

  return {
    conferencePersonId,
    reasonToMeet,
    proposedAsk: draft.proposedAsk.trim() || undefined,
    introPath: draft.introPath.trim() || undefined,
    status: draft.status,
    notes: draft.notes.trim() || undefined,
    nextStep: draft.nextStep.trim() || undefined
  };
}

export function numberOrDefault(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function conferenceTotalScore(score: {
  seniorityScore: number;
  companyFitScore: number;
  signalScore: number;
  conferenceSignalScore: number;
  warmIntroScore: number;
  timingScore: number;
}) {
  return (
    score.seniorityScore +
    score.companyFitScore +
    score.signalScore +
    score.conferenceSignalScore +
    score.warmIntroScore +
    score.timingScore
  );
}

export function conferencePriorityBand(totalScore: number): ConferencePriorityBand {
  if (totalScore >= 16) {
    return "request_meeting";
  }
  if (totalScore >= 12) {
    return "personalized_outreach";
  }
  if (totalScore >= 8) {
    return "nurture";
  }
  return "do_not_prioritize";
}

export function outreachStatusRequiresPermission(status: ConferenceOutreachStatus) {
  return (
    status === "queued" ||
    status === "contacted" ||
    status === "meeting_requested" ||
    status === "meeting_booked"
  );
}

export function domainFromUrl(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

export function splitPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Unknown",
    lastName: parts.slice(1).join(" ") || "Unknown"
  };
}

export function companyFitLabels(company: ConferenceCompany) {
  return [
    company.productFit ? "Product" : "",
    company.expansionFit ? "Expansion" : "",
    company.budgetFit ? "Budget" : "",
    company.marketEntryRelevance ? "Market entry" : "",
    company.partnershipRelevance ? "Partnerships" : ""
  ].filter(Boolean);
}

export function tabLabel(tab: ConferenceTab) {
  switch (tab) {
    case "companies":
      return "Companies";
    case "people":
      return "People";
    case "meetings":
      return "Meetings";
    case "queries":
      return "Search queries";
    case "templates":
      return "Templates";
    case "access":
      return "Organizer access";
  }
}

export function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function conferenceSearchQueries(conferenceName: string) {
  return [
    `"${conferenceName}" "enterprise software"`,
    `"${conferenceName}" "operations"`,
    `"${conferenceName}" "partnerships"`,
    `"${conferenceName}" "buyer"`,
    `"${conferenceName}" "platform"`,
    `"${conferenceName}" "integration"`,
    `"${conferenceName}" "speaker"`,
    `"${conferenceName}" "sponsor"`,
    `"${conferenceName}" "exhibitor"`,
    `"${conferenceName}" "attending" "founder"`,
    `"${conferenceName}" "see you at"`,
    `site:linkedin.com/in "${conferenceName}" "attending"`,
    `site:linkedin.com/posts "${conferenceName}" "attending"`
  ];
}

export function viewModeTitle(viewMode: ViewMode) {
  switch (viewMode) {
    case "pipeline":
      return "Pipeline";
    case "leads":
      return "Leads";
    case "network":
      return "Network";
    case "accounts":
      return "Accounts";
    case "contacts":
      return "Contacts";
    case "conferences":
      return "Conferences";
    case "data":
      return "Data";
  }
}

export function parseViewMode(value: string | null): ViewMode | null {
  if (
    value === "pipeline" ||
    value === "leads" ||
    value === "network" ||
    value === "accounts" ||
    value === "contacts" ||
    value === "conferences" ||
    value === "data"
  ) {
    return value;
  }

  return null;
}

export function parseTaskStatusFilter(value: string | null): TaskStatusFilter {
  if (
    value === "open" ||
    value === "in_progress" ||
    value === "done" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

export function parseTaskOwnerFilter(value: string | null): TaskOwnerFilter {
  return value === "mine" ? "mine" : "all";
}

export function parseTaskDueFilter(value: string | null): TaskDueFilter {
  if (value === "overdue" || value === "today" || value === "upcoming" || value === "none") {
    return value;
  }

  return "all";
}

export function setDefaultableParam(params: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (value === defaultValue) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}

export function parseSelectedRecord(value: string | null): SelectedRecordRef | null {
  if (!value) {
    return null;
  }

  const [entityType, id] = value.split(":");
  if (!id) {
    return null;
  }

  if (
    entityType === "account" ||
    entityType === "contact" ||
    entityType === "lead" ||
    entityType === "opportunity"
  ) {
    return { entityType, id };
  }

  return null;
}

export function serializeSelectedRecord(record: SelectedRecordRef) {
  return `${record.entityType}:${record.id}`;
}

export function sameSelectedRecord(
  left: SelectedRecordRef | null,
  right: SelectedRecordRef | null
) {
  return left?.entityType === right?.entityType && left?.id === right?.id;
}

export function customFieldDefinitionInput(
  draft: CustomFieldDraft
): CreateCustomFieldDefinitionInput | null {
  const label = draft.label.trim();
  if (!label) {
    return null;
  }

  return {
    entityType: draft.entityType,
    key: draft.key.trim() || undefined,
    label,
    fieldType: draft.fieldType,
    required: draft.required,
    isIndexed: draft.isIndexed,
    schema: isSelectField(draft.fieldType)
      ? {
          options: draft.options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        }
      : {}
  };
}

export function isSelectField(fieldType: CustomFieldType) {
  return fieldType === "single_select" || fieldType === "multi_select";
}

export function recordDraftKey(entityType: RecordEntityType, recordId: string) {
  return `${entityType}:${recordId}`;
}

export function hasCustomFieldDraft(drafts: CustomFieldValueDrafts, draftKey: string) {
  return Object.keys(drafts[draftKey] ?? {}).length > 0;
}

export function draftCustomFieldValue(
  drafts: CustomFieldValueDrafts,
  record: CustomFieldRecord,
  definition: CustomFieldDefinition,
  entityType: RecordEntityType
) {
  return (
    drafts[recordDraftKey(entityType, record.id)]?.[definition.key] ??
    formatCustomFieldValue(record.customFields[definition.key])
  );
}

export function customFieldPatchFromDraft(
  draft: Record<string, string>,
  definitions: CustomFieldDefinition[]
) {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const customFields: Record<string, CustomFieldPrimitive> = {};

  for (const [key, value] of Object.entries(draft)) {
    const definition = definitionByKey.get(key);
    if (!definition) {
      continue;
    }
    customFields[key] = parseCustomFieldValue(definition, value);
  }

  return customFields;
}

export function parseCustomFieldValue(
  definition: CustomFieldDefinition,
  value: string
): CustomFieldPrimitive {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  switch (definition.fieldType) {
    case "number":
      return Number(trimmed);
    case "boolean":
      return trimmed === "true";
    case "multi_select":
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    case "currency":
      return { amount: Number(trimmed), currency: "USD" };
    case "user_ref":
    case "account_ref":
      return { id: trimmed, label: trimmed };
    default:
      return trimmed;
  }
}

export function customFieldOptions(definition: CustomFieldDefinition) {
  const options = definition.schema?.options;
  return Array.isArray(options) && options.every((option) => typeof option === "string")
    ? options
    : [];
}

export function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function searchableCustomFields(
  values: Record<string, CustomFieldPrimitive>,
  definitions: CustomFieldDefinition[]
) {
  return definitions
    .map((definition) => `${definition.label} ${formatCustomFieldValue(values[definition.key])}`)
    .join(" ");
}

export function formatCustomFieldValue(value: CustomFieldPrimitive | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    if ("amount" in value && "currency" in value) {
      return `${value.currency} ${value.amount}`;
    }

    return value.label;
  }

  return String(value);
}

export function leadCustomFieldString(lead: Lead, key: string): string {
  return formatCustomFieldValue(lead.customFields[key]);
}

export function isNetworkProspectLead(lead: Lead | undefined | null): boolean {
  return Boolean(
    lead &&
      (lead.source === "network_prospect_queue" ||
        leadCustomFieldString(lead, "network_profile_url") ||
        leadCustomFieldString(lead, "network_review_status"))
  );
}

export function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );
}

export function recordLabel(record: CustomFieldRecord) {
  if ("name" in record) {
    return record.name;
  }

  if ("contactName" in record) {
    return record.contactName;
  }

  return `${record.firstName} ${record.lastName}`;
}

export function isRecordSearchResult(
  result: SearchResult
): result is SearchResult & { type: RecordEntityType } {
  return ["account", "contact", "lead", "opportunity"].includes(result.type);
}

export function viewForEntityType(entityType: RecordEntityType): ViewMode {
  switch (entityType) {
    case "account":
      return "accounts";
    case "contact":
      return "contacts";
    case "lead":
      return "leads";
    case "opportunity":
      return "pipeline";
  }
}

export function entityTypeLabel(entityType: string) {
  return entityType.replace("_", " ");
}

export function searchResultId(result: SearchResult) {
  return `search-result-${result.type}-${result.id}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function timelineFilterLabel(filter: TimelineFilter) {
  switch (filter) {
    case "activity":
      return "Activities";
    case "note":
      return "Notes";
    case "task":
      return "Tasks";
    default:
      return "All";
  }
}

export function timelineEmptyMessage(filter: TimelineFilter) {
  return filter === "all" ? "No timeline entries yet" : `No ${timelineFilterLabel(filter).toLowerCase()} yet`;
}

export function emptyTaskEditDraft(): TaskEditDraft {
  return {
    title: "",
    description: "",
    dueAt: "",
    priority: "medium"
  };
}

export function taskEditDraftFromTask(task: Task): TaskEditDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    dueAt: dateInputValue(task.dueAt),
    priority: task.priority
  };
}

export function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function taskTimelineDetail(task: Task) {
  return [
    task.status.replace("_", " "),
    task.priority,
    task.dueAt ? `due ${formatDate(task.dueAt)}` : ""
  ].filter(Boolean).join(" / ");
}

export function taskMatchesDueFilter(task: Task, filter: TaskDueFilter) {
  if (filter === "all") {
    return true;
  }

  if (!task.dueAt) {
    return filter === "none";
  }

  if (filter === "none") {
    return false;
  }

  const dueDate = new Date(task.dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (filter === "overdue") {
    return dueDate < today;
  }

  if (filter === "today") {
    return dueDate >= today && dueDate < tomorrow;
  }

  return dueDate >= tomorrow;
}

export function emptyActivityPayloadDraft(): ActivityPayloadDraft {
  return {
    outcome: "",
    durationMinutes: "",
    attendees: "",
    emailDirection: "outbound",
    location: ""
  };
}

export function activityPayloadDraftFromActivity(activity: CRMActivity): ActivityPayloadDraft {
  const { payload } = activity;
  const attendees = Array.isArray(payload.attendees)
    ? payload.attendees.filter((attendee): attendee is string => typeof attendee === "string")
    : [];
  const direction =
    payload.direction === "inbound" || payload.direction === "outbound"
      ? payload.direction
      : "outbound";

  return {
    outcome:
      typeof payload.outcome === "string"
        ? payload.outcome
        : typeof payload.disposition === "string"
          ? payload.disposition
          : "",
    durationMinutes:
      typeof payload.durationMinutes === "number" ? String(payload.durationMinutes) : "",
    attendees: attendees.join(", "),
    emailDirection: direction,
    location: typeof payload.location === "string" ? payload.location : ""
  };
}

export function buildActivityPayload(
  type: CRMActivity["type"],
  draft: ActivityPayloadDraft
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const outcome = draft.outcome.trim();
  const durationMinutes = Number.parseInt(draft.durationMinutes, 10);
  const attendees = draft.attendees
    .split(",")
    .map((attendee) => attendee.trim())
    .filter(Boolean);
  const location = draft.location.trim();

  if (outcome) {
    payload.outcome = outcome;
  }

  if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
    payload.durationMinutes = durationMinutes;
  }

  if (type === "email") {
    payload.direction = draft.emailDirection;
  }

  if ((type === "meeting" || type === "event") && attendees.length > 0) {
    payload.attendees = attendees;
  }

  if (type === "event" && location) {
    payload.location = location;
  }

  return payload;
}

export function activityPayloadSummary(activity: CRMActivity) {
  const details: string[] = [activity.type];
  const { payload } = activity;

  if (typeof payload.direction === "string") {
    details.push(payload.direction);
  }

  if (typeof payload.outcome === "string") {
    details.push(payload.outcome);
  }

  if (typeof payload.disposition === "string") {
    details.push(payload.disposition);
  }

  if (typeof payload.durationMinutes === "number") {
    details.push(`${payload.durationMinutes} min`);
  }

  if (Array.isArray(payload.attendees) && payload.attendees.length > 0) {
    details.push(`${payload.attendees.length} attendees`);
  }

  if (typeof payload.location === "string") {
    details.push(payload.location);
  }

  return details.join(" / ");
}

export function errorSummary(error: unknown) {
  if (error instanceof CRMClientError) {
    return `Request failed (${error.status})`;
  }

  return error instanceof Error ? error.message : "Action failed";
}
