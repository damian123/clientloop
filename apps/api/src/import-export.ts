import { z } from "zod";
import {
  accountImportRequestSchema,
  conferenceImportRequestSchema,
  conferenceMeetingImportRequestSchema,
  conferencePersonImportRequestSchema,
  contactImportRequestSchema,
  exportEntitySchema,
  opportunityImportRequestSchema,
  type AccountImportPreview,
  type AccountImportRequest,
  type AccountImportRow,
  type ConferenceCompanyImportPreview,
  type ConferenceImportRequest,
  type ConferenceCompanyImportRow,
  type ConferenceMeetingImportPreview,
  type ConferenceMeetingImportRequest,
  type ConferenceMeetingImportRow,
  type ConferencePersonImportPreview,
  type ConferencePersonImportRequest,
  type ConferencePersonImportRow,
  type ContactImportPreview,
  type ContactImportRequest,
  type ContactImportRow,
  type ExportEntity,
  type OpportunityImportPreview,
  type OpportunityImportRequest,
  type OpportunityImportRow
} from "@clientloop/contracts";
import {
  assertCan,
  type AccessPrincipal,
  type Account,
  type Contact,
  type Opportunity
} from "@clientloop/domain";
import { parseCsv, toCsv, type CsvRow } from "./csv";
import type { CRMRepository } from "./repository";

const emailSchema = z.string().email();
const accountStatusSchema = z.enum(["prospect", "customer", "partner", "inactive"]);
const conferenceRoleSchema = z.enum([
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
const conferenceIcpCategorySchema = z.enum([
  "founder_operator",
  "asset_owner",
  "private_markets",
  "fintech_digital_assets",
  "investor_allocator",
  "strategic_partner",
  "lower_priority",
  "unknown"
]);
const conferenceOutreachStatusSchema = z.enum([
  "not_started",
  "queued",
  "contacted",
  "replied",
  "meeting_requested",
  "meeting_booked",
  "nurturing",
  "disqualified"
]);
const conferenceSourceTypeSchema = z.enum([
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
const conferenceOptOutStatusSchema = z.enum(["unknown", "not_opted_out", "opted_out"]);
const conferenceMeetingStatusSchema = z.enum([
  "not_requested",
  "requested",
  "booked",
  "declined",
  "completed",
  "cancelled"
]);
const opportunityStageSchema = z.enum([
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost"
]);

type AccountImportField = "name" | "domain" | "status" | "ownerUserId";
type ConferenceCompanyImportField =
  | "company"
  | "website"
  | "conferenceRole"
  | "sector"
  | "rwaRelevance"
  | "privateMarketsRelevance"
  | "fundraisingRelevance"
  | "marketEntryRelevance"
  | "partnershipRelevance"
  | "companyScore"
  | "sourceUrl"
  | "sourceNotes"
  | "accountId";
type ConferencePersonImportField =
  | "name"
  | "title"
  | "company"
  | "conferenceCompanyId"
  | "accountId"
  | "contactId"
  | "linkedIn"
  | "email"
  | "conferenceSignal"
  | "icpCategory"
  | "buyingSignal"
  | "relationshipPath"
  | "outreachStatus"
  | "sourceType"
  | "source"
  | "lawfulBasisNotes"
  | "optOutStatus"
  | "seniorityScore"
  | "companyFitScore"
  | "signalScore"
  | "conferenceSignalScore"
  | "warmIntroScore"
  | "timingScore";
type ConferenceMeetingImportField =
  | "conferencePersonId"
  | "name"
  | "company"
  | "reasonToMeet"
  | "proposedAsk"
  | "introPath"
  | "status"
  | "meetingRequested"
  | "meetingBooked"
  | "notes"
  | "nextStep";
type ContactImportField = "firstName" | "lastName" | "email" | "phone" | "accountId" | "ownerUserId";
type OpportunityImportField =
  | "name"
  | "stage"
  | "amount"
  | "currency"
  | "expectedCloseDate"
  | "accountId"
  | "ownerUserId"
  | "probabilityPct";

const accountAliases: Record<AccountImportField, string[]> = {
  name: ["name", "Name", "Account Name", "accountName", "account_name"],
  domain: ["domain", "Domain"],
  status: ["status", "Status"],
  ownerUserId: ["ownerUserId", "owner_user_id", "Owner User ID"]
};

const contactAliases: Record<ContactImportField, string[]> = {
  firstName: ["firstName", "first_name", "First Name", "First name"],
  lastName: ["lastName", "last_name", "Last Name", "Last name"],
  email: ["email", "Email"],
  phone: ["phone", "Phone"],
  accountId: ["accountId", "account_id", "Account ID"],
  ownerUserId: ["ownerUserId", "owner_user_id", "Owner User ID"]
};

const conferenceCompanyAliases: Record<ConferenceCompanyImportField, string[]> = {
  company: ["Company", "company", "Account", "account"],
  website: ["Website", "website", "Company website", "companyWebsite"],
  conferenceRole: ["Conference role", "conferenceRole", "conference_role", "Role"],
  sector: ["Sector", "sector"],
  rwaRelevance: ["RWA relevance", "rwaRelevance", "rwa_relevance"],
  privateMarketsRelevance: [
    "Private markets relevance",
    "privateMarketsRelevance",
    "private_markets_relevance"
  ],
  fundraisingRelevance: ["Fundraising relevance", "fundraisingRelevance", "fundraising_relevance"],
  marketEntryRelevance: ["Market entry relevance", "marketEntryRelevance", "market_entry_relevance"],
  partnershipRelevance: ["Partnership relevance", "partnershipRelevance", "partnership_relevance"],
  companyScore: ["Company score", "companyScore", "company_score"],
  sourceUrl: ["Source URL", "sourceUrl", "source_url"],
  sourceNotes: ["Source notes", "sourceNotes", "source_notes"],
  accountId: ["Account ID", "accountId", "account_id"]
};

const conferencePersonAliases: Record<ConferencePersonImportField, string[]> = {
  name: ["Name", "name"],
  title: ["Title", "title"],
  company: ["Company", "company"],
  conferenceCompanyId: ["Conference company ID", "conferenceCompanyId", "conference_company_id"],
  accountId: ["Account ID", "accountId", "account_id"],
  contactId: ["Contact ID", "contactId", "contact_id"],
  linkedIn: ["LinkedIn", "linkedin", "LinkedIn URL", "linkedIn"],
  email: ["Email", "email"],
  conferenceSignal: ["Conference signal", "conferenceSignal", "conference_signal"],
  icpCategory: ["ICP category", "icpCategory", "icp_category"],
  buyingSignal: ["Buying signal", "buyingSignal", "buying_signal"],
  relationshipPath: ["Relationship path", "relationshipPath", "relationship_path"],
  outreachStatus: ["Outreach status", "outreachStatus", "outreach_status"],
  sourceType: ["Source type", "sourceType", "source_type"],
  source: ["Source", "source"],
  lawfulBasisNotes: [
    "Consent or lawful basis notes",
    "Lawful basis notes",
    "lawfulBasisNotes",
    "lawful_basis_notes"
  ],
  optOutStatus: ["Opt out status", "optOutStatus", "opt_out_status"],
  seniorityScore: ["Seniority score", "seniorityScore", "seniority_score"],
  companyFitScore: ["Fit score", "Company fit score", "companyFitScore", "company_fit_score"],
  signalScore: ["Signal score", "signalScore", "signal_score"],
  conferenceSignalScore: ["Conference signal score", "conferenceSignalScore", "conference_signal_score"],
  warmIntroScore: ["Warm intro score", "warmIntroScore", "warm_intro_score"],
  timingScore: ["Timing score", "timingScore", "timing_score"]
};

const conferenceMeetingAliases: Record<ConferenceMeetingImportField, string[]> = {
  conferencePersonId: ["Conference person ID", "conferencePersonId", "conference_person_id"],
  name: ["Name", "name", "Person", "person"],
  company: ["Company", "company"],
  reasonToMeet: ["Reason to meet", "reasonToMeet", "reason_to_meet", "Reason"],
  proposedAsk: ["Proposed ask", "proposedAsk", "proposed_ask", "Ask"],
  introPath: ["Intro path", "introPath", "intro_path"],
  status: ["Status", "status", "Meeting status", "meetingStatus"],
  meetingRequested: ["Meeting requested", "meetingRequested", "meeting_requested"],
  meetingBooked: ["Meeting booked", "meetingBooked", "meeting_booked"],
  notes: ["Notes", "notes"],
  nextStep: ["Next step", "nextStep", "next_step"]
};

const opportunityAliases: Record<OpportunityImportField, string[]> = {
  name: ["name", "Name", "Opportunity Name", "opportunityName", "opportunity_name"],
  stage: ["stage", "Stage"],
  amount: ["amount", "Amount"],
  currency: ["currency", "Currency"],
  expectedCloseDate: ["expectedCloseDate", "expected_close_date", "Expected Close Date"],
  accountId: ["accountId", "account_id", "Account ID"],
  ownerUserId: ["ownerUserId", "owner_user_id", "Owner User ID"],
  probabilityPct: ["probabilityPct", "probability_pct", "Probability", "Probability %"]
};

export async function exportRecordsCsv(input: {
  principal: AccessPrincipal;
  repository: CRMRepository;
  entity: ExportEntity;
}): Promise<string> {
  const entity = exportEntitySchema.parse(input.entity);

  switch (entity) {
    case "accounts":
      assertCan(input.principal, "account", "export", { tenantId: input.principal.tenantId });
      return exportAccounts((await input.repository.listAccounts(input.principal.tenantId, { limit: 100 })).items);
    case "contacts":
      assertCan(input.principal, "contact", "export", { tenantId: input.principal.tenantId });
      return exportContacts((await input.repository.listContacts(input.principal.tenantId, { limit: 100 })).items);
    case "opportunities":
      assertCan(input.principal, "opportunity", "export", { tenantId: input.principal.tenantId });
      return exportOpportunities(
        (await input.repository.listOpportunities(input.principal.tenantId, { limit: 100 })).items
      );
  }
}

export function previewAccountImport(input: AccountImportRequest): AccountImportPreview {
  const parsed = accountImportRequestSchema.parse(input);
  const rawRows = parseCsv(parsed.csv);
  const errors: AccountImportPreview["errors"] = [];
  const rows: AccountImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = toAccountImportRow(rawRow, rowNumber, parsed.mapping);
    const rowErrors = validateAccountRow(row);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push(row as AccountImportRow);
  });

  return {
    totalRows: rawRows.length,
    validRows: rows.length,
    errors,
    rows
  };
}

export function previewContactImport(input: ContactImportRequest): ContactImportPreview {
  const parsed = contactImportRequestSchema.parse(input);
  const rawRows = parseCsv(parsed.csv);
  const errors: ContactImportPreview["errors"] = [];
  const rows: ContactImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = toContactImportRow(rawRow, rowNumber, parsed.mapping);
    const rowErrors = validateContactRow(row);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push(row);
  });

  return {
    totalRows: rawRows.length,
    validRows: rows.length,
    errors,
    rows
  };
}

export function previewOpportunityImport(input: OpportunityImportRequest): OpportunityImportPreview {
  const parsed = opportunityImportRequestSchema.parse(input);
  const rawRows = parseCsv(parsed.csv);
  const errors: OpportunityImportPreview["errors"] = [];
  const rows: OpportunityImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = toOpportunityImportRow(rawRow, rowNumber, parsed.mapping);
    const rowErrors = validateOpportunityRow(row);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push(row as OpportunityImportRow);
  });

  return {
    totalRows: rawRows.length,
    validRows: rows.length,
    errors,
    rows
  };
}

export function previewConferenceCompanyImport(
  input: ConferenceImportRequest
): ConferenceCompanyImportPreview {
  const parsed = conferenceImportRequestSchema.parse(input);
  const rawRows = parseCsv(parsed.csv);
  const errors: ConferenceCompanyImportPreview["errors"] = [];
  const rows: ConferenceCompanyImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = toConferenceCompanyImportRow(rawRow, rowNumber, parsed.mapping);
    const rowErrors = validateConferenceCompanyRow(row);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push(row as ConferenceCompanyImportRow);
  });

  return {
    totalRows: rawRows.length,
    validRows: rows.length,
    errors,
    rows
  };
}

export function previewConferencePersonImport(
  input: ConferencePersonImportRequest
): ConferencePersonImportPreview {
  const parsed = conferencePersonImportRequestSchema.parse(input);
  const rawRows = parseCsv(parsed.csv);
  const errors: ConferencePersonImportPreview["errors"] = [];
  const rows: ConferencePersonImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = toConferencePersonImportRow(rawRow, rowNumber, parsed.mapping);
    const rowErrors = validateConferencePersonRow(row);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push(row as ConferencePersonImportRow);
  });

  return {
    totalRows: rawRows.length,
    validRows: rows.length,
    errors,
    rows
  };
}

export function previewConferenceMeetingImport(
  input: ConferenceMeetingImportRequest
): ConferenceMeetingImportPreview {
  const parsed = conferenceMeetingImportRequestSchema.parse(input);
  const rawRows = parseCsv(parsed.csv);
  const errors: ConferenceMeetingImportPreview["errors"] = [];
  const rows: ConferenceMeetingImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const row = toConferenceMeetingImportRow(rawRow, rowNumber, parsed.mapping);
    const rowErrors = validateConferenceMeetingRow(row);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push(row as ConferenceMeetingImportRow);
  });

  return {
    totalRows: rawRows.length,
    validRows: rows.length,
    errors,
    rows
  };
}

function exportAccounts(accounts: Account[]): string {
  return toCsv(
    ["id", "name", "status", "domain", "ownerUserId", "healthScore", "updatedAt"],
    accounts.map((account) => [
      account.id,
      account.name,
      account.status,
      account.domain ?? "",
      account.ownerUserId ?? "",
      String(account.customFields.health_score ?? ""),
      account.updatedAt
    ])
  );
}

function exportContacts(contacts: Contact[]): string {
  return toCsv(
    ["id", "firstName", "lastName", "email", "phone", "accountId", "ownerUserId", "updatedAt"],
    contacts.map((contact) => [
      contact.id,
      contact.firstName,
      contact.lastName,
      contact.email ?? "",
      contact.phone ?? "",
      contact.accountId ?? "",
      contact.ownerUserId ?? "",
      contact.updatedAt
    ])
  );
}

function exportOpportunities(opportunities: Opportunity[]): string {
  return toCsv(
    [
      "id",
      "name",
      "stage",
      "amount",
      "currency",
      "expectedCloseDate",
      "accountId",
      "ownerUserId",
      "probabilityPct",
      "updatedAt"
    ],
    opportunities.map((opportunity) => [
      opportunity.id,
      opportunity.name,
      opportunity.stage,
      String(opportunity.amount ?? ""),
      opportunity.currency,
      opportunity.expectedCloseDate ?? "",
      opportunity.accountId,
      opportunity.ownerUserId,
      String(opportunity.probabilityPct ?? ""),
      opportunity.updatedAt
    ])
  );
}

function toContactImportRow(
  rawRow: CsvRow,
  rowNumber: number,
  mapping: ContactImportRequest["mapping"] | undefined
): ContactImportRow {
  return {
    row: rowNumber,
    firstName: readMappedValue(rawRow, "firstName", mapping),
    lastName: readMappedValue(rawRow, "lastName", mapping),
    email: readMappedValue(rawRow, "email", mapping) || undefined,
    phone: readMappedValue(rawRow, "phone", mapping) || undefined,
    accountId: readMappedValue(rawRow, "accountId", mapping) || undefined,
    ownerUserId: readMappedValue(rawRow, "ownerUserId", mapping) || undefined
  };
}

function toAccountImportRow(
  rawRow: CsvRow,
  rowNumber: number,
  mapping: AccountImportRequest["mapping"] | undefined
): AccountImportRow {
  const status = readMappedValue(rawRow, "status", mapping, accountAliases) || "prospect";

  return {
    row: rowNumber,
    name: readMappedValue(rawRow, "name", mapping, accountAliases),
    domain: readMappedValue(rawRow, "domain", mapping, accountAliases) || undefined,
    status: accountStatusSchema.safeParse(status).success ? accountStatusSchema.parse(status) : status,
    ownerUserId: readMappedValue(rawRow, "ownerUserId", mapping, accountAliases) || undefined
  } as AccountImportRow;
}

function toOpportunityImportRow(
  rawRow: CsvRow,
  rowNumber: number,
  mapping: OpportunityImportRequest["mapping"] | undefined
): OpportunityImportRow {
  const amount = readOptionalNumber(rawRow, "amount", mapping, opportunityAliases);
  const probabilityPct = readOptionalNumber(rawRow, "probabilityPct", mapping, opportunityAliases);
  const stage = readMappedValue(rawRow, "stage", mapping, opportunityAliases) || "qualification";
  const currency = readMappedValue(rawRow, "currency", mapping, opportunityAliases) || "USD";

  return {
    row: rowNumber,
    name: readMappedValue(rawRow, "name", mapping, opportunityAliases),
    stage: opportunityStageSchema.safeParse(stage).success ? opportunityStageSchema.parse(stage) : stage,
    amount,
    currency,
    expectedCloseDate: readMappedValue(rawRow, "expectedCloseDate", mapping, opportunityAliases) || undefined,
    accountId: readMappedValue(rawRow, "accountId", mapping, opportunityAliases),
    ownerUserId: readMappedValue(rawRow, "ownerUserId", mapping, opportunityAliases),
    probabilityPct
  } as OpportunityImportRow;
}

function toConferenceCompanyImportRow(
  rawRow: CsvRow,
  rowNumber: number,
  mapping: ConferenceImportRequest["mapping"] | undefined
): ConferenceCompanyImportRow {
  const conferenceRole =
    readMappedValue(rawRow, "conferenceRole", mapping, conferenceCompanyAliases) || "other";

  return {
    row: rowNumber,
    company: readMappedValue(rawRow, "company", mapping, conferenceCompanyAliases),
    website: readMappedValue(rawRow, "website", mapping, conferenceCompanyAliases) || undefined,
    conferenceRole: conferenceRoleSchema.safeParse(conferenceRole).success
      ? conferenceRoleSchema.parse(conferenceRole)
      : conferenceRole,
    sector: readMappedValue(rawRow, "sector", mapping, conferenceCompanyAliases) || undefined,
    rwaRelevance: readBoolean(rawRow, "rwaRelevance", mapping, conferenceCompanyAliases),
    privateMarketsRelevance: readBoolean(
      rawRow,
      "privateMarketsRelevance",
      mapping,
      conferenceCompanyAliases
    ),
    fundraisingRelevance: readBoolean(rawRow, "fundraisingRelevance", mapping, conferenceCompanyAliases),
    marketEntryRelevance: readBoolean(rawRow, "marketEntryRelevance", mapping, conferenceCompanyAliases),
    partnershipRelevance: readBoolean(rawRow, "partnershipRelevance", mapping, conferenceCompanyAliases),
    companyScore: readOptionalNumber(rawRow, "companyScore", mapping, conferenceCompanyAliases) ?? 0,
    sourceUrl: readMappedValue(rawRow, "sourceUrl", mapping, conferenceCompanyAliases) || undefined,
    sourceNotes: readMappedValue(rawRow, "sourceNotes", mapping, conferenceCompanyAliases) || undefined,
    accountId: readMappedValue(rawRow, "accountId", mapping, conferenceCompanyAliases) || undefined
  } as ConferenceCompanyImportRow;
}

function toConferencePersonImportRow(
  rawRow: CsvRow,
  rowNumber: number,
  mapping: ConferencePersonImportRequest["mapping"] | undefined
): ConferencePersonImportRow {
  const icpCategory =
    readMappedValue(rawRow, "icpCategory", mapping, conferencePersonAliases) || "unknown";
  const outreachStatus =
    readMappedValue(rawRow, "outreachStatus", mapping, conferencePersonAliases) || "not_started";
  const sourceType =
    readMappedValue(rawRow, "sourceType", mapping, conferencePersonAliases) || "manual_research";
  const optOutStatus =
    readMappedValue(rawRow, "optOutStatus", mapping, conferencePersonAliases) || "unknown";

  return {
    row: rowNumber,
    name: readMappedValue(rawRow, "name", mapping, conferencePersonAliases),
    title: readMappedValue(rawRow, "title", mapping, conferencePersonAliases),
    company: readMappedValue(rawRow, "company", mapping, conferencePersonAliases) || undefined,
    conferenceCompanyId:
      readMappedValue(rawRow, "conferenceCompanyId", mapping, conferencePersonAliases) || undefined,
    accountId: readMappedValue(rawRow, "accountId", mapping, conferencePersonAliases) || undefined,
    contactId: readMappedValue(rawRow, "contactId", mapping, conferencePersonAliases) || undefined,
    linkedIn: readMappedValue(rawRow, "linkedIn", mapping, conferencePersonAliases) || undefined,
    email: readMappedValue(rawRow, "email", mapping, conferencePersonAliases) || undefined,
    conferenceSignal:
      readMappedValue(rawRow, "conferenceSignal", mapping, conferencePersonAliases) || undefined,
    icpCategory: conferenceIcpCategorySchema.safeParse(icpCategory).success
      ? conferenceIcpCategorySchema.parse(icpCategory)
      : icpCategory,
    buyingSignal: readMappedValue(rawRow, "buyingSignal", mapping, conferencePersonAliases) || undefined,
    relationshipPath:
      readMappedValue(rawRow, "relationshipPath", mapping, conferencePersonAliases) || undefined,
    outreachStatus: conferenceOutreachStatusSchema.safeParse(outreachStatus).success
      ? conferenceOutreachStatusSchema.parse(outreachStatus)
      : outreachStatus,
    sourceType: conferenceSourceTypeSchema.safeParse(sourceType).success
      ? conferenceSourceTypeSchema.parse(sourceType)
      : sourceType,
    source: readMappedValue(rawRow, "source", mapping, conferencePersonAliases) || undefined,
    lawfulBasisNotes:
      readMappedValue(rawRow, "lawfulBasisNotes", mapping, conferencePersonAliases) || undefined,
    optOutStatus: conferenceOptOutStatusSchema.safeParse(optOutStatus).success
      ? conferenceOptOutStatusSchema.parse(optOutStatus)
      : optOutStatus,
    seniorityScore: readOptionalNumber(rawRow, "seniorityScore", mapping, conferencePersonAliases) ?? 0,
    companyFitScore: readOptionalNumber(rawRow, "companyFitScore", mapping, conferencePersonAliases) ?? 0,
    signalScore: readOptionalNumber(rawRow, "signalScore", mapping, conferencePersonAliases) ?? 0,
    conferenceSignalScore:
      readOptionalNumber(rawRow, "conferenceSignalScore", mapping, conferencePersonAliases) ?? 0,
    warmIntroScore: readOptionalNumber(rawRow, "warmIntroScore", mapping, conferencePersonAliases) ?? 0,
    timingScore: readOptionalNumber(rawRow, "timingScore", mapping, conferencePersonAliases) ?? 0
  } as ConferencePersonImportRow;
}

function toConferenceMeetingImportRow(
  rawRow: CsvRow,
  rowNumber: number,
  mapping: ConferenceMeetingImportRequest["mapping"] | undefined
): ConferenceMeetingImportRow {
  const explicitStatus = readMappedValue(rawRow, "status", mapping, conferenceMeetingAliases);
  const meetingRequested = readBoolean(rawRow, "meetingRequested", mapping, conferenceMeetingAliases);
  const meetingBooked = readBoolean(rawRow, "meetingBooked", mapping, conferenceMeetingAliases);
  const status = explicitStatus || (meetingBooked ? "booked" : meetingRequested ? "requested" : "not_requested");

  return {
    row: rowNumber,
    conferencePersonId:
      readMappedValue(rawRow, "conferencePersonId", mapping, conferenceMeetingAliases) || undefined,
    name: readMappedValue(rawRow, "name", mapping, conferenceMeetingAliases) || undefined,
    company: readMappedValue(rawRow, "company", mapping, conferenceMeetingAliases) || undefined,
    reasonToMeet: readMappedValue(rawRow, "reasonToMeet", mapping, conferenceMeetingAliases),
    proposedAsk: readMappedValue(rawRow, "proposedAsk", mapping, conferenceMeetingAliases) || undefined,
    introPath: readMappedValue(rawRow, "introPath", mapping, conferenceMeetingAliases) || undefined,
    status: conferenceMeetingStatusSchema.safeParse(status).success
      ? conferenceMeetingStatusSchema.parse(status)
      : status,
    meetingRequested,
    meetingBooked,
    notes: readMappedValue(rawRow, "notes", mapping, conferenceMeetingAliases) || undefined,
    nextStep: readMappedValue(rawRow, "nextStep", mapping, conferenceMeetingAliases) || undefined
  } as ConferenceMeetingImportRow;
}

function readMappedValue(
  row: CsvRow,
  field: string,
  mapping: Record<string, string | undefined> | undefined,
  aliases: Record<string, string[]> = contactAliases as Record<string, string[]>
): string {
  const explicitHeader = mapping?.[field];

  if (explicitHeader) {
    return row[explicitHeader]?.trim() ?? "";
  }

  for (const alias of aliases[field] ?? []) {
    const value = row[alias]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function readOptionalNumber(
  row: CsvRow,
  field: string,
  mapping: Record<string, string | undefined> | undefined,
  aliases: Record<string, string[]>
): number | undefined {
  const value = readMappedValue(row, field, mapping, aliases);
  if (!value) {
    return undefined;
  }
  return Number(value);
}

function readBoolean(
  row: CsvRow,
  field: string,
  mapping: Record<string, string | undefined> | undefined,
  aliases: Record<string, string[]>
): boolean {
  const value = readMappedValue(row, field, mapping, aliases).trim().toLowerCase();
  return ["true", "yes", "y", "1"].includes(value);
}

function validateAccountRow(row: AccountImportRow): AccountImportPreview["errors"] {
  const errors: AccountImportPreview["errors"] = [];

  if (!row.name) {
    errors.push({ row: row.row, field: "name", message: "Name is required" });
  }

  if (!accountStatusSchema.safeParse(row.status).success) {
    errors.push({ row: row.row, field: "status", message: "Status is invalid" });
  }

  return errors;
}

function validateContactRow(row: ContactImportRow): ContactImportPreview["errors"] {
  const errors: ContactImportPreview["errors"] = [];

  if (!row.firstName) {
    errors.push({ row: row.row, field: "firstName", message: "First name is required" });
  }

  if (!row.lastName) {
    errors.push({ row: row.row, field: "lastName", message: "Last name is required" });
  }

  if (row.email && !emailSchema.safeParse(row.email).success) {
    errors.push({ row: row.row, field: "email", message: "Email is invalid" });
  }

  return errors;
}

function validateOpportunityRow(row: OpportunityImportRow): OpportunityImportPreview["errors"] {
  const errors: OpportunityImportPreview["errors"] = [];

  if (!row.name) {
    errors.push({ row: row.row, field: "name", message: "Name is required" });
  }

  if (!row.accountId) {
    errors.push({ row: row.row, field: "accountId", message: "Account ID is required" });
  }

  if (!row.ownerUserId) {
    errors.push({ row: row.row, field: "ownerUserId", message: "Owner User ID is required" });
  }

  if (!opportunityStageSchema.safeParse(row.stage).success) {
    errors.push({ row: row.row, field: "stage", message: "Stage is invalid" });
  }

  if (!Number.isFinite(row.amount ?? 0) || (row.amount ?? 0) < 0) {
    errors.push({ row: row.row, field: "amount", message: "Amount must be a nonnegative number" });
  }

  if (!/^[A-Z]{3}$/.test(row.currency)) {
    errors.push({ row: row.row, field: "currency", message: "Currency must be a 3-letter code" });
  }

  if (
    row.probabilityPct !== undefined &&
    (!Number.isInteger(row.probabilityPct) || row.probabilityPct < 0 || row.probabilityPct > 100)
  ) {
    errors.push({ row: row.row, field: "probabilityPct", message: "Probability must be between 0 and 100" });
  }

  return errors;
}

function validateConferenceCompanyRow(
  row: ConferenceCompanyImportRow
): ConferenceCompanyImportPreview["errors"] {
  const errors: ConferenceCompanyImportPreview["errors"] = [];

  if (!row.company) {
    errors.push({ row: row.row, field: "company", message: "Company is required" });
  }

  if (!conferenceRoleSchema.safeParse(row.conferenceRole).success) {
    errors.push({ row: row.row, field: "conferenceRole", message: "Conference role is invalid" });
  }

  if (!Number.isInteger(row.companyScore) || row.companyScore < 0 || row.companyScore > 20) {
    errors.push({ row: row.row, field: "companyScore", message: "Company score must be between 0 and 20" });
  }

  return errors;
}

function validateConferencePersonRow(
  row: ConferencePersonImportRow
): ConferencePersonImportPreview["errors"] {
  const errors: ConferencePersonImportPreview["errors"] = [];

  if (!row.name) {
    errors.push({ row: row.row, field: "name", message: "Name is required" });
  }

  if (!row.title) {
    errors.push({ row: row.row, field: "title", message: "Title is required" });
  }

  if (row.email && !emailSchema.safeParse(row.email).success) {
    errors.push({ row: row.row, field: "email", message: "Email is invalid" });
  }

  if (row.email && !row.lawfulBasisNotes) {
    errors.push({
      row: row.row,
      field: "lawfulBasisNotes",
      message: "Lawful basis notes are required when email is stored"
    });
  }

  if (!conferenceIcpCategorySchema.safeParse(row.icpCategory).success) {
    errors.push({ row: row.row, field: "icpCategory", message: "ICP category is invalid" });
  }

  if (!conferenceOutreachStatusSchema.safeParse(row.outreachStatus).success) {
    errors.push({ row: row.row, field: "outreachStatus", message: "Outreach status is invalid" });
  }

  if (!conferenceSourceTypeSchema.safeParse(row.sourceType).success) {
    errors.push({ row: row.row, field: "sourceType", message: "Source type is invalid" });
  }

  if (!row.source) {
    errors.push({ row: row.row, field: "source", message: "Source is required" });
  }

  if (!conferenceOptOutStatusSchema.safeParse(row.optOutStatus).success) {
    errors.push({ row: row.row, field: "optOutStatus", message: "Opt out status is invalid" });
  }

  if (
    row.optOutStatus === "opted_out" &&
    ["queued", "contacted", "meeting_requested", "meeting_booked"].includes(row.outreachStatus)
  ) {
    errors.push({
      row: row.row,
      field: "outreachStatus",
      message: "Opted-out people cannot be included in outreach actions"
    });
  }

  validateScoreRange(errors, row, "seniorityScore", 0, 4);
  validateScoreRange(errors, row, "companyFitScore", 0, 4);
  validateScoreRange(errors, row, "signalScore", 0, 5);
  validateScoreRange(errors, row, "conferenceSignalScore", 0, 3);
  validateScoreRange(errors, row, "warmIntroScore", 0, 2);
  validateScoreRange(errors, row, "timingScore", 0, 2);

  return errors;
}

function validateConferenceMeetingRow(
  row: ConferenceMeetingImportRow
): ConferenceMeetingImportPreview["errors"] {
  const errors: ConferenceMeetingImportPreview["errors"] = [];

  if (!row.conferencePersonId && !row.name) {
    errors.push({ row: row.row, field: "name", message: "Name or conference person ID is required" });
  }

  if (!row.reasonToMeet) {
    errors.push({ row: row.row, field: "reasonToMeet", message: "Reason to meet is required" });
  }

  if (!conferenceMeetingStatusSchema.safeParse(row.status).success) {
    errors.push({ row: row.row, field: "status", message: "Meeting status is invalid" });
  }

  return errors;
}

function validateScoreRange(
  errors: ConferencePersonImportPreview["errors"],
  row: ConferencePersonImportRow,
  field: keyof Pick<
    ConferencePersonImportRow,
    | "seniorityScore"
    | "companyFitScore"
    | "signalScore"
    | "conferenceSignalScore"
    | "warmIntroScore"
    | "timingScore"
  >,
  min: number,
  max: number
) {
  const value = row[field];
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push({
      row: row.row,
      field,
      message: `${field} must be between ${min} and ${max}`
    });
  }
}
