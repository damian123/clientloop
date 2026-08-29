import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { seedManagerId, seedTenantId, seedUserId } from "@clientloop/domain";
import { parseCsv, type CsvRow } from "../apps/api/src/csv";

const prisma = new PrismaClient();
const source = "linkedin_prospect_queue";

type ImportField =
  | "account"
  | "name"
  | "roleTitle"
  | "profileUrl"
  | "priority"
  | "region"
  | "whyThisFits"
  | "exclusionScreen"
  | "suggestedNote"
  | "reviewStatus"
  | "sourceUrl"
  | "followUpDate"
  | "ownerNotes"
  | "outcome"
  | "domain"
  | "email"
  | "reviewedDate"
  | "inviteSentDate"
  | "lastUpdated"
  | "nextAction"
  | "sourceSheet";

type NormalizedRow = {
  rowNumber: number;
  account: string;
  contactName: string;
  roleTitle: string | null;
  profileUrl: string | null;
  priority: string | null;
  region: string | null;
  whyThisFits: string | null;
  exclusionScreen: string | null;
  suggestedNote: string | null;
  reviewStatus: string;
  sourceUrl: string | null;
  followUpDate: string | null;
  ownerNotes: string | null;
  outcome: string | null;
  domain: string | null;
  email: string | null;
  reviewedDate: string | null;
  inviteSentDate: string | null;
  lastUpdated: string;
  nextAction: string | null;
  sourceSheet: string;
};

type ImportOptions = {
  filePath: string;
  dryRun: boolean;
  batchName: string;
  tenantId: string;
  actorUserId: string;
  ownerUserId: string;
};

const aliases: Record<ImportField, string[]> = {
  account: ["Account", "account", "Company", "company", "Account name", "Account Name"],
  name: ["Name", "name", "Contact", "contact", "LinkedIn target", "LinkedIn Target"],
  roleTitle: ["Role/title", "Role / title", "Role", "Title", "Target persona", "Target Persona"],
  profileUrl: ["LinkedIn profile URL", "LinkedIn URL", "Profile URL", "Profile", "profileUrl"],
  priority: ["Priority", "priority"],
  region: ["Region", "region"],
  whyThisFits: ["Why this fits", "Fit rationale", "Rationale"],
  exclusionScreen: ["Exclusion screen", "Exclusion", "Exclusion notes"],
  suggestedNote: ["Suggested note", "Suggested connection note", "Note", "Connection note"],
  reviewStatus: ["Review status", "Status", "LinkedIn review status"],
  sourceUrl: ["Source", "Source URL", "Source / evidence", "Evidence URL", "URL"],
  followUpDate: ["Follow-up date", "Follow up date", "Followup date", "Next follow-up"],
  ownerNotes: ["Owner notes", "Notes", "Internal notes"],
  outcome: ["Outcome", "LinkedIn outcome", "Invite outcome"],
  domain: ["Domain", "domain", "Website", "website"],
  email: ["Email", "email"],
  reviewedDate: ["Reviewed date", "Reviewed"],
  inviteSentDate: ["Invite sent date", "Invite date"],
  lastUpdated: ["Last updated", "Updated", "Recorded", "Added"],
  nextAction: ["Next action", "Action", "Next step"],
  sourceSheet: ["Source sheet", "Source Sheet", "Sheet", "Batch source"]
};

const customFieldDefinitions = [
  { entityType: "account", key: "linkedin_priority", label: "LinkedIn priority", fieldType: "single_select", isIndexed: true },
  { entityType: "account", key: "linkedin_region", label: "LinkedIn region", fieldType: "text", isIndexed: true },
  { entityType: "account", key: "linkedin_fit_rationale", label: "LinkedIn fit rationale", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_source_url", label: "LinkedIn source URL", fieldType: "text", isIndexed: false },
  { entityType: "account", key: "linkedin_queue_lead_count", label: "LinkedIn queue leads", fieldType: "number", isIndexed: true },
  { entityType: "account", key: "linkedin_high_priority_row_count", label: "LinkedIn high-priority rows", fieldType: "number", isIndexed: true },
  { entityType: "account", key: "linkedin_needs_verification_count", label: "LinkedIn needs verification", fieldType: "number", isIndexed: true },
  { entityType: "account", key: "linkedin_latest_activity_date", label: "LinkedIn latest activity", fieldType: "date", isIndexed: true },
  { entityType: "account", key: "linkedin_target_personas", label: "LinkedIn target personas", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_review_statuses", label: "LinkedIn review statuses", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_invite_outcomes", label: "LinkedIn invite outcomes", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_next_actions", label: "LinkedIn next actions", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_profile_urls", label: "LinkedIn profile URLs", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_source_evidence", label: "LinkedIn source evidence", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_source_sheets", label: "LinkedIn source sheets", fieldType: "textarea", isIndexed: false },
  { entityType: "account", key: "linkedin_manual_import_count", label: "LinkedIn manual imports", fieldType: "number", isIndexed: true },
  { entityType: "lead", key: "linkedin_priority", label: "LinkedIn priority", fieldType: "single_select", isIndexed: true },
  { entityType: "lead", key: "linkedin_region", label: "LinkedIn region", fieldType: "text", isIndexed: true },
  { entityType: "lead", key: "linkedin_target_persona", label: "LinkedIn target persona", fieldType: "text", isIndexed: true },
  { entityType: "lead", key: "linkedin_why_this_fits", label: "Why this fits", fieldType: "textarea", isIndexed: false },
  { entityType: "lead", key: "linkedin_exclusion_screen", label: "Exclusion screen", fieldType: "textarea", isIndexed: false },
  { entityType: "lead", key: "linkedin_suggested_note", label: "Suggested note", fieldType: "textarea", isIndexed: false },
  { entityType: "lead", key: "linkedin_review_status", label: "Review status", fieldType: "single_select", isIndexed: true },
  { entityType: "lead", key: "linkedin_source_url", label: "Source URL", fieldType: "text", isIndexed: false },
  { entityType: "lead", key: "linkedin_profile_url", label: "LinkedIn profile URL", fieldType: "text", isIndexed: true },
  { entityType: "lead", key: "linkedin_reviewed_date", label: "Reviewed date", fieldType: "date", isIndexed: false },
  { entityType: "lead", key: "linkedin_invite_sent_date", label: "Invite sent date", fieldType: "date", isIndexed: false },
  { entityType: "lead", key: "linkedin_outcome", label: "LinkedIn outcome", fieldType: "text", isIndexed: true },
  { entityType: "lead", key: "linkedin_follow_up_date", label: "Follow-up date", fieldType: "date", isIndexed: true },
  { entityType: "lead", key: "linkedin_owner_notes", label: "Owner notes", fieldType: "textarea", isIndexed: false },
  { entityType: "lead", key: "linkedin_last_updated", label: "Last updated", fieldType: "date", isIndexed: false },
  { entityType: "lead", key: "linkedin_import_batch", label: "Import batch", fieldType: "text", isIndexed: true },
  { entityType: "lead", key: "linkedin_source_sheet", label: "Source sheet", fieldType: "text", isIndexed: false },
  { entityType: "lead", key: "linkedin_next_action", label: "Next action", fieldType: "textarea", isIndexed: false }
] satisfies Array<{
  entityType: "account" | "lead";
  key: string;
  label: string;
  fieldType: string;
  isIndexed: boolean;
}>;

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseArgs(argv: string[]): ImportOptions {
  let filePath: string | null = null;
  let dryRun = false;
  let batchName: string | null = null;
  let tenantId = seedTenantId;
  let actorUserId = seedUserId;
  let ownerUserId = seedManagerId;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--batch" && next) {
      batchName = next;
      index += 1;
      continue;
    }
    if (arg === "--tenant-id" && next) {
      tenantId = next;
      index += 1;
      continue;
    }
    if (arg === "--actor-user-id" && next) {
      actorUserId = next;
      index += 1;
      continue;
    }
    if (arg === "--owner-user-id" && next) {
      ownerUserId = next;
      index += 1;
      continue;
    }
    if (!arg.startsWith("--") && !filePath) {
      filePath = arg;
      continue;
    }
    usage(`Unknown or incomplete argument: ${arg}`);
  }

  if (!filePath) {
    usage("CSV file path is required.");
  }

  const resolvedFilePath = path.resolve(filePath);
  return {
    filePath: resolvedFilePath,
    dryRun,
    batchName: batchName ?? path.basename(resolvedFilePath, path.extname(resolvedFilePath)),
    tenantId,
    actorUserId,
    ownerUserId
  };
}

function usage(error?: string): never {
  if (error) {
    console.error(error);
  }
  console.error(
    [
      "Usage:",
      "  npm run crm:import-linkedin-prospects -- <file.csv> [--dry-run] [--batch name]",
      "",
      "Required CSV columns:",
      "  Account",
      "",
      "Recommended columns:",
      "  Name, Role/title, LinkedIn profile URL, Priority, Region, Why this fits, Exclusion screen, Suggested note, Review status, Source, Follow-up date, Owner notes"
    ].join("\n")
  );
  process.exit(1);
}

function pick(row: CsvRow, field: ImportField): string | null {
  for (const alias of aliases[field]) {
    const value = row[alias];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, "").toLowerCase();
}

function normalizeDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  }
  return parsed.toISOString().slice(0, 10);
}

function domainFromUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function normalizeRows(rows: CsvRow[], options: ImportOptions): NormalizedRow[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const account = pick(row, "account");
    if (!account) {
      throw new Error(`Row ${rowNumber}: Account is required.`);
    }

    const name = pick(row, "name");
    const roleTitle = pick(row, "roleTitle");
    const contactName = name ?? (roleTitle ? `${roleTitle} at ${account}` : `LinkedIn prospect at ${account}`);
    const profileUrl = pick(row, "profileUrl");
    const sourceUrl = pick(row, "sourceUrl");
    const followUpDate = normalizeDate(pick(row, "followUpDate"));
    const reviewedDate = normalizeDate(pick(row, "reviewedDate"));
    const inviteSentDate = normalizeDate(pick(row, "inviteSentDate"));
    const lastUpdated = normalizeDate(pick(row, "lastUpdated")) ?? new Date().toISOString().slice(0, 10);

    return {
      rowNumber,
      account,
      contactName,
      roleTitle,
      profileUrl,
      priority: pick(row, "priority") ?? "Medium",
      region: pick(row, "region"),
      whyThisFits: pick(row, "whyThisFits"),
      exclusionScreen: pick(row, "exclusionScreen"),
      suggestedNote: pick(row, "suggestedNote"),
      reviewStatus: pick(row, "reviewStatus") ?? "Ready to review",
      sourceUrl,
      followUpDate,
      ownerNotes: pick(row, "ownerNotes"),
      outcome: pick(row, "outcome"),
      domain: pick(row, "domain") ?? domainFromUrl(sourceUrl),
      email: pick(row, "email"),
      reviewedDate,
      inviteSentDate,
      lastUpdated,
      nextAction: pick(row, "nextAction"),
      sourceSheet: pick(row, "sourceSheet") ?? options.batchName
    };
  });
}

function leadStatus(row: NormalizedRow): "new" | "qualified" | "disqualified" | "converted" {
  const status = row.reviewStatus;
  if (status.includes("Not sent") || status.includes("Blocked")) {
    return "disqualified";
  }
  if (status === "Already connected" || status === "Already pending") {
    return "qualified";
  }
  return "new";
}

function customFields(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function textValue(fields: Record<string, unknown>, key: string): string | null {
  const value = fields[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(fields: Record<string, unknown>, key: string): number {
  const value = fields[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function priorityRank(priority: string | null): number {
  return { High: 3, Medium: 2, Low: 1 }[priority ?? ""] ?? 0;
}

function maxPriority(left: string | null, right: string | null): string | null {
  return priorityRank(right) > priorityRank(left) ? right : left;
}

function appendUnique(existing: string | null, value: string | null, separator = "\n"): string | null {
  const values = new Set((existing ?? "").split(/\n| \/ |, /).map((item) => item.trim()).filter(Boolean));
  if (value) {
    for (const item of value.split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
      values.add(item);
    }
  }
  return values.size > 0 ? [...values].join(separator) : null;
}

function incrementSummary(existing: string | null, value: string | null): string | null {
  if (!value) {
    return existing;
  }
  const counts = new Map<string, number>();
  for (const line of (existing ?? "").split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const splitAt = trimmed.lastIndexOf(": ");
    if (splitAt === -1) {
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
      continue;
    }
    const key = trimmed.slice(0, splitAt);
    const count = Number(trimmed.slice(splitAt + 2));
    counts.set(key, Number.isFinite(count) ? count : 1);
  }
  counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => `${key}: ${count}`).join("\n");
}

function needsVerification(row: NormalizedRow): boolean {
  return [row.reviewStatus, row.ownerNotes, row.nextAction]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("verification");
}

function leadKey(row: NormalizedRow): string {
  const profileKey = normalizeUrl(row.profileUrl);
  return profileKey ? `profile:${profileKey}` : `name:${row.account.toLowerCase()}|${row.contactName.toLowerCase()}`;
}

function buildLeadFields(row: NormalizedRow, options: ImportOptions): Record<string, string | number | null> {
  return {
    linkedin_priority: row.priority,
    linkedin_region: row.region,
    linkedin_target_persona: row.roleTitle,
    linkedin_people_search: null,
    linkedin_why_this_fits: row.whyThisFits,
    linkedin_exclusion_screen: row.exclusionScreen,
    linkedin_suggested_note: row.suggestedNote,
    linkedin_review_status: row.reviewStatus,
    linkedin_source_url: row.sourceUrl,
    linkedin_profile_url: row.profileUrl,
    linkedin_reviewed_date: row.reviewedDate,
    linkedin_invite_sent_date: row.inviteSentDate,
    linkedin_outcome: row.outcome,
    linkedin_follow_up_date: row.followUpDate,
    linkedin_owner_notes: row.ownerNotes,
    linkedin_last_updated: row.lastUpdated,
    linkedin_import_batch: options.batchName,
    linkedin_source_sheet: row.sourceSheet,
    linkedin_next_action: row.nextAction
  };
}

function taskDescription(row: NormalizedRow): string {
  return [
    `Account: ${row.account}`,
    row.profileUrl ? `Profile: ${row.profileUrl}` : null,
    row.outcome ? `Outcome: ${row.outcome}` : null,
    row.suggestedNote ? `Suggested note: ${row.suggestedNote}` : null,
    row.ownerNotes ? `Owner notes: ${row.ownerNotes}` : null,
    row.nextAction ? `Next action: ${row.nextAction}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

async function ensureTenantAndUser(tx: Prisma.TransactionClient, options: ImportOptions) {
  const [tenant, owner, actor] = await Promise.all([
    tx.tenant.findUnique({ where: { id: options.tenantId }, select: { id: true } }),
    tx.user.findUnique({ where: { id: options.ownerUserId }, select: { id: true } }),
    tx.user.findUnique({ where: { id: options.actorUserId }, select: { id: true } })
  ]);

  if (!tenant) {
    throw new Error(`Tenant ${options.tenantId} does not exist. Run the Prisma seed first.`);
  }
  if (!owner) {
    throw new Error(`Owner user ${options.ownerUserId} does not exist. Run the Prisma seed first.`);
  }
  if (!actor) {
    throw new Error(`Actor user ${options.actorUserId} does not exist. Run the Prisma seed first.`);
  }
}

async function upsertDefinitions(tx: Prisma.TransactionClient, rows: NormalizedRow[], options: ImportOptions) {
  const priorityOptions = [...new Set(rows.map((row) => row.priority).filter((value): value is string => Boolean(value)))];
  const reviewOptions = [...new Set(rows.map((row) => row.reviewStatus).filter(Boolean))];

  for (const definition of customFieldDefinitions) {
    const optionValues =
      definition.key === "linkedin_priority"
        ? priorityOptions
        : definition.key === "linkedin_review_status"
          ? reviewOptions
          : [];
    const existing = await tx.customFieldDefinition.findUnique({
      where: {
        tenantId_entityType_key: {
          tenantId: options.tenantId,
          entityType: definition.entityType,
          key: definition.key
        }
      }
    });
    const schema = mergeSchemaOptions(existing?.schema, optionValues);

    await tx.customFieldDefinition.upsert({
      where: {
        tenantId_entityType_key: {
          tenantId: options.tenantId,
          entityType: definition.entityType,
          key: definition.key
        }
      },
      update: {
        label: definition.label,
        fieldType: definition.fieldType,
        required: false,
        isIndexed: definition.isIndexed,
        schema: asJson(schema),
        updatedAt: new Date(),
        updatedBy: options.actorUserId
      },
      create: {
        id: randomUUID(),
        tenantId: options.tenantId,
        entityType: definition.entityType,
        key: definition.key,
        label: definition.label,
        fieldType: definition.fieldType,
        required: false,
        isIndexed: definition.isIndexed,
        schema: asJson(schema),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: options.actorUserId,
        updatedBy: options.actorUserId,
        version: 1
      }
    });
  }
}

function mergeSchemaOptions(existingSchema: Prisma.JsonValue | undefined, optionValues: string[]): Record<string, unknown> {
  const schema = existingSchema && typeof existingSchema === "object" && !Array.isArray(existingSchema)
    ? { ...(existingSchema as Record<string, unknown>) }
    : {};
  if (optionValues.length === 0) {
    return schema;
  }
  const existingOptions = Array.isArray(schema.options) ? schema.options.filter((value): value is string => typeof value === "string") : [];
  schema.options = [...new Set([...existingOptions, ...optionValues])].sort();
  return schema;
}

async function importRows(tx: Prisma.TransactionClient, rows: NormalizedRow[], options: ImportOptions) {
  const now = new Date();
  await ensureTenantAndUser(tx, options);
  await upsertDefinitions(tx, rows, options);

  const existingLeads = await tx.lead.findMany({
    where: {
      tenantId: options.tenantId,
      source,
      archivedAt: null
    }
  });
  const existingLeadByKey = new Map<string, (typeof existingLeads)[number]>();
  for (const lead of existingLeads) {
    const fields = customFields(lead.customFields);
    const profile = textValue(fields, "linkedin_profile_url");
    const key = profile
      ? `profile:${normalizeUrl(profile)}`
      : `name:${(lead.companyName ?? "").toLowerCase()}|${lead.contactName.toLowerCase()}`;
    existingLeadByKey.set(key, lead);
  }

  let accountsCreated = 0;
  let accountsUpdated = 0;
  let leadsCreated = 0;
  let leadsUpdated = 0;
  let tasksCreated = 0;
  let tasksUpdated = 0;

  for (const row of rows) {
    let account = await tx.account.findFirst({
      where: {
        tenantId: options.tenantId,
        name: row.account,
        archivedAt: null
      }
    });
    const accountFields = account ? customFields(account.customFields) : {};
    const currentLeadKey = leadKey(row);
    const existingLead = existingLeadByKey.get(currentLeadKey);
    const isNewLead = !existingLead;

    const mergedAccountFields = {
      ...accountFields,
      linkedin_priority: maxPriority(textValue(accountFields, "linkedin_priority"), row.priority),
      linkedin_region: appendUnique(textValue(accountFields, "linkedin_region"), row.region, " / "),
      linkedin_fit_rationale: textValue(accountFields, "linkedin_fit_rationale") ?? row.whyThisFits,
      linkedin_source_url: textValue(accountFields, "linkedin_source_url") ?? row.sourceUrl,
      linkedin_queue_lead_count: numberValue(accountFields, "linkedin_queue_lead_count") + (isNewLead ? 1 : 0),
      linkedin_high_priority_row_count:
        numberValue(accountFields, "linkedin_high_priority_row_count") + (isNewLead && row.priority === "High" ? 1 : 0),
      linkedin_needs_verification_count:
        numberValue(accountFields, "linkedin_needs_verification_count") + (isNewLead && needsVerification(row) ? 1 : 0),
      linkedin_latest_activity_date: [textValue(accountFields, "linkedin_latest_activity_date"), row.lastUpdated]
        .filter(Boolean)
        .sort()
        .at(-1),
      linkedin_target_personas: appendUnique(textValue(accountFields, "linkedin_target_personas"), row.roleTitle),
      linkedin_review_statuses: isNewLead
        ? incrementSummary(textValue(accountFields, "linkedin_review_statuses"), row.reviewStatus)
        : textValue(accountFields, "linkedin_review_statuses"),
      linkedin_invite_outcomes: isNewLead
        ? incrementSummary(textValue(accountFields, "linkedin_invite_outcomes"), row.outcome)
        : textValue(accountFields, "linkedin_invite_outcomes"),
      linkedin_next_actions: appendUnique(textValue(accountFields, "linkedin_next_actions"), row.nextAction),
      linkedin_profile_urls: appendUnique(textValue(accountFields, "linkedin_profile_urls"), row.profileUrl),
      linkedin_source_evidence: appendUnique(textValue(accountFields, "linkedin_source_evidence"), row.sourceUrl),
      linkedin_source_sheets: appendUnique(textValue(accountFields, "linkedin_source_sheets"), row.sourceSheet, ", "),
      linkedin_manual_import_count: numberValue(accountFields, "linkedin_manual_import_count") + (isNewLead ? 1 : 0)
    };

    if (account) {
      account = await tx.account.update({
        where: { id: account.id },
        data: {
          domain: account.domain ?? row.domain,
          ownerUserId: account.ownerUserId ?? options.ownerUserId,
          customFields: asJson(mergedAccountFields),
          updatedAt: now,
          updatedBy: options.actorUserId,
          version: { increment: 1 }
        }
      });
      accountsUpdated += 1;
    } else {
      account = await tx.account.create({
        data: {
          id: randomUUID(),
          tenantId: options.tenantId,
          name: row.account,
          domain: row.domain,
          ownerUserId: options.ownerUserId,
          status: "prospect",
          customFields: asJson(mergedAccountFields),
          createdAt: now,
          updatedAt: now,
          createdBy: options.actorUserId,
          updatedBy: options.actorUserId,
          version: 1
        }
      });
      accountsCreated += 1;
    }

    const leadFields = buildLeadFields(row, options);
    const lead = existingLead
      ? await tx.lead.update({
          where: { id: existingLead.id },
          data: {
            companyName: row.account,
            contactName: row.contactName,
            email: row.email,
            status: leadStatus(row),
            customFields: asJson({ ...customFields(existingLead.customFields), ...leadFields }),
            updatedAt: now,
            updatedBy: options.actorUserId,
            version: { increment: 1 }
          }
        })
      : await tx.lead.create({
          data: {
            id: randomUUID(),
            tenantId: options.tenantId,
            source,
            companyName: row.account,
            contactName: row.contactName,
            email: row.email,
            status: leadStatus(row),
            customFields: asJson(leadFields),
            createdAt: now,
            updatedAt: now,
            createdBy: options.actorUserId,
            updatedBy: options.actorUserId,
            version: 1
          }
        });

    if (existingLead) {
      leadsUpdated += 1;
    } else {
      leadsCreated += 1;
      existingLeadByKey.set(currentLeadKey, lead);
    }

    if (row.followUpDate) {
      const dueAt = new Date(`${row.followUpDate}T17:00:00.000Z`);
      const title = `Follow up on LinkedIn prospect: ${row.contactName}`;
      const existingTask = await tx.task.findFirst({
        where: {
          tenantId: options.tenantId,
          parentType: "lead",
          parentId: lead.id,
          title: { startsWith: "Follow up on LinkedIn prospect:" },
          archivedAt: null
        }
      });

      if (existingTask) {
        await tx.task.update({
          where: { id: existingTask.id },
          data: {
            title,
            description: taskDescription(row),
            status: "open",
            priority: row.priority === "High" ? "high" : "medium",
            dueAt,
            assignedUserId: options.ownerUserId,
            updatedAt: now,
            updatedBy: options.actorUserId,
            version: { increment: 1 }
          }
        });
        tasksUpdated += 1;
      } else {
        await tx.task.create({
          data: {
            id: randomUUID(),
            tenantId: options.tenantId,
            parentType: "lead",
            parentId: lead.id,
            title,
            description: taskDescription(row),
            status: "open",
            priority: row.priority === "High" ? "high" : "medium",
            dueAt,
            assignedUserId: options.ownerUserId,
            createdAt: now,
            updatedAt: now,
            createdBy: options.actorUserId,
            updatedBy: options.actorUserId,
            version: 1
          }
        });
        tasksCreated += 1;
      }
    }
  }

  return { accountsCreated, accountsUpdated, leadsCreated, leadsUpdated, tasksCreated, tasksUpdated };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const csv = await readFile(options.filePath, "utf8");
  const rows = normalizeRows(parseCsv(csv), options);

  const duplicateKeys = rows.map(leadKey).filter((key, index, keys) => keys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    throw new Error(`CSV contains duplicate prospect keys: ${[...new Set(duplicateKeys)].join(", ")}`);
  }

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          file: options.filePath,
          batch: options.batchName,
          rows: rows.length,
          accounts: new Set(rows.map((row) => row.account)).size,
          prospectsWithProfiles: rows.filter((row) => row.profileUrl).length,
          followUpTasks: rows.filter((row) => row.followUpDate).length
        },
        null,
        2
      )
    );
    return;
  }

  const result = await prisma.$transaction((tx) => importRows(tx, rows, options), {
    timeout: 30_000
  });

  console.log(
    JSON.stringify(
      {
        dryRun: false,
        file: options.filePath,
        batch: options.batchName,
        rows: rows.length,
        ...result,
        next: "Run npm run crm:export-linkedin-briefs to refresh AI Markdown snapshots."
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
