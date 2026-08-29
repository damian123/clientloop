import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedTenantId, seedUserId } from "@clientloop/domain";

const prisma = new PrismaClient();
const source = "linkedin_prospect_queue";

type JsonFields = Record<string, unknown>;
type LeadRow = Awaited<ReturnType<typeof prisma.lead.findMany>>[number];
type TaskRow = Awaited<ReturnType<typeof prisma.task.findMany>>[number];

type Options = {
  batch: string;
  outputDir: string;
  tenantId: string;
  actorUserId: string;
  initializeOutcomes: boolean;
  updateBatchTasks: boolean;
};

type HandoffRow = {
  rank: number;
  tier: string;
  rankReason: string;
  company: string;
  contact: string;
  role: string;
  priority: string;
  status: string;
  profileUrl: string;
  followUpDate: string;
  sourceUrl: string;
  whyThisFits: string;
  suggestedNote: string;
  shortNote: string;
  shortNoteChars: number;
  nextAction: string;
  peopleSearch: string;
  profileVerificationResult: string;
  reviewDecision: string;
  outreachExecutionStatus: string;
  actualInviteSentDate: string;
  responseStatus: string;
  reviewerNotes: string;
};

type OutcomeDefinition = {
  entityType: "lead";
  key: string;
  label: string;
  fieldType: string;
  isIndexed: boolean;
  options: string[];
};

const outcomeDefinitions: OutcomeDefinition[] = [
  {
    entityType: "lead",
    key: "linkedin_review_decision",
    label: "LinkedIn review decision",
    fieldType: "single_select",
    isIndexed: true,
    options: ["Pending review", "Approved for invite", "Rejected", "Deferred", "Needs alternate contact"]
  },
  {
    entityType: "lead",
    key: "linkedin_profile_verification_result",
    label: "LinkedIn profile verification result",
    fieldType: "single_select",
    isIndexed: true,
    options: [
      "Pending profile confirmation",
      "Verified",
      "Mismatch",
      "Not found",
      "Needs manual profile search",
      "Company-level only"
    ]
  },
  {
    entityType: "lead",
    key: "linkedin_outreach_execution_status",
    label: "LinkedIn outreach execution status",
    fieldType: "single_select",
    isIndexed: true,
    options: ["Not started", "Invite sent", "Message sent", "Responded", "No action", "Blocked"]
  },
  {
    entityType: "lead",
    key: "linkedin_actual_invite_sent_date",
    label: "LinkedIn actual invite sent date",
    fieldType: "date",
    isIndexed: true,
    options: []
  },
  {
    entityType: "lead",
    key: "linkedin_response_status",
    label: "LinkedIn response status",
    fieldType: "single_select",
    isIndexed: true,
    options: ["No response", "Accepted", "Replied", "Declined", "Bounced", "Not applicable"]
  },
  {
    entityType: "lead",
    key: "linkedin_reviewer_notes",
    label: "LinkedIn reviewer notes",
    fieldType: "textarea",
    isIndexed: false,
    options: []
  }
];

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function fields(value: unknown): JsonFields {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as JsonFields) } : {};
}

function textField(record: JsonFields, key: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function numberField(record: JsonFields, key: string, fallback = 999): number {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(raw) ? JSON.stringify(raw) : raw;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function mdLink(label: string, url: string): string {
  return url ? `[${label}](${url})` : label;
}

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "unscheduled";
}

function liveSignalBatchTaskWhere(batch: string) {
  return {
    title: { startsWith: "Live-signal batch" },
    description: { contains: batch }
  };
}

function parseArgs(argv: string[]): Options {
  let batch: string | null = null;
  let outputDir = process.env.LINKEDIN_BRIEF_OUTPUT_DIR ?? "outputs/linkedin-prospect-briefs";
  let tenantId = seedTenantId;
  let actorUserId = seedUserId;
  let initializeOutcomes = true;
  let updateBatchTasks = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];
    if (arg === "--batch" && next) {
      batch = next;
      index += 1;
      continue;
    }
    if (arg === "--output-dir" && next) {
      outputDir = next;
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
    if (arg === "--no-init-outcomes") {
      initializeOutcomes = false;
      continue;
    }
    if (arg === "--no-update-batch-tasks") {
      updateBatchTasks = false;
      continue;
    }
    usage(`Unknown or incomplete argument: ${arg}`);
  }

  if (!batch) {
    usage("--batch is required.");
  }

  return {
    batch,
    outputDir: path.resolve(outputDir),
    tenantId,
    actorUserId,
    initializeOutcomes,
    updateBatchTasks
  };
}

function usage(error?: string): never {
  if (error) {
    console.error(error);
  }
  console.error(
    [
      "Usage:",
      "  npm run crm:export-live-signal-handoff -- --batch <batch-name>",
      "",
      "Options:",
      "  --output-dir <dir>           Defaults to outputs/linkedin-prospect-briefs",
      "  --tenant-id <uuid>           Defaults to seed tenant",
      "  --actor-user-id <uuid>       Defaults to seed user",
      "  --no-init-outcomes           Do not upsert/initialize outcome fields",
      "  --no-update-batch-tasks      Do not add handoff links to batch tasks"
    ].join("\n")
  );
  process.exit(1);
}

function toRow(lead: LeadRow): HandoffRow {
  const leadFields = fields(lead.customFields);
  return {
    rank: numberField(leadFields, "linkedin_review_rank"),
    tier: textField(leadFields, "linkedin_review_tier"),
    rankReason: textField(leadFields, "linkedin_review_rank_reason"),
    company: lead.companyName ?? "",
    contact: lead.contactName,
    role: textField(leadFields, "linkedin_target_persona"),
    priority: textField(leadFields, "linkedin_priority"),
    status: textField(leadFields, "linkedin_review_status"),
    profileUrl: textField(leadFields, "linkedin_profile_url"),
    followUpDate: textField(leadFields, "linkedin_follow_up_date"),
    sourceUrl: textField(leadFields, "linkedin_source_url"),
    whyThisFits: textField(leadFields, "linkedin_why_this_fits"),
    suggestedNote: textField(leadFields, "linkedin_suggested_note"),
    shortNote: textField(leadFields, "linkedin_connection_note_short"),
    shortNoteChars: numberField(leadFields, "linkedin_connection_note_short_chars", 0),
    nextAction: textField(leadFields, "linkedin_next_action"),
    peopleSearch: textField(leadFields, "linkedin_people_search"),
    profileVerificationResult: textField(leadFields, "linkedin_profile_verification_result"),
    reviewDecision: textField(leadFields, "linkedin_review_decision"),
    outreachExecutionStatus: textField(leadFields, "linkedin_outreach_execution_status"),
    actualInviteSentDate: textField(leadFields, "linkedin_actual_invite_sent_date"),
    responseStatus: textField(leadFields, "linkedin_response_status"),
    reviewerNotes: textField(leadFields, "linkedin_reviewer_notes")
  };
}

function tierCounts(rows: HandoffRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const key = row.tier || "Unranked";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

async function upsertOutcomeDefinitions(options: Options): Promise<void> {
  const now = new Date();
  for (const definition of outcomeDefinitions) {
    const existing = await prisma.customFieldDefinition.findUnique({
      where: {
        tenantId_entityType_key: {
          tenantId: options.tenantId,
          entityType: definition.entityType,
          key: definition.key
        }
      }
    });
    const existingSchema = fields(existing?.schema);
    const existingOptions = Array.isArray(existingSchema.options)
      ? existingSchema.options.filter((value): value is string => typeof value === "string")
      : [];
    const schema =
      definition.options.length > 0
        ? { ...existingSchema, options: [...new Set([...existingOptions, ...definition.options])].sort() }
        : existingSchema;

    await prisma.customFieldDefinition.upsert({
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
        updatedAt: now,
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
        createdAt: now,
        updatedAt: now,
        createdBy: options.actorUserId,
        updatedBy: options.actorUserId,
        version: 1
      }
    });
  }
}

async function initializeOutcomeFields(leads: LeadRow[], options: Options): Promise<void> {
  const now = new Date();
  for (const lead of leads) {
    const leadFields = fields(lead.customFields);
    const reviewStatus = textField(leadFields, "linkedin_review_status");
    const nextFields = {
      ...leadFields,
      linkedin_review_decision: textField(leadFields, "linkedin_review_decision") || "Pending review",
      linkedin_profile_verification_result:
        textField(leadFields, "linkedin_profile_verification_result") ||
        (reviewStatus === "Ready to review" ? "Pending profile confirmation" : "Needs manual profile search"),
      linkedin_outreach_execution_status: textField(leadFields, "linkedin_outreach_execution_status") || "Not started",
      linkedin_response_status: textField(leadFields, "linkedin_response_status") || "No response",
      linkedin_reviewer_notes: textField(leadFields, "linkedin_reviewer_notes"),
      linkedin_last_updated: new Date().toISOString().slice(0, 10)
    };

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        customFields: asJson(nextFields),
        updatedAt: now,
        updatedBy: options.actorUserId
      }
    });
  }
}

async function updateBatchTaskLinks(options: Options): Promise<void> {
  const now = new Date();
  const handoffPath = path.join(options.outputDir, `${options.batch}-handoff.md`);
  const notesPath = path.join(options.outputDir, `${options.batch}-connection-notes.md`);
  const trackerPath = path.join(options.outputDir, `${options.batch}-outcome-tracker.md`);
  const tasks = await prisma.task.findMany({ where: liveSignalBatchTaskWhere(options.batch) });

  for (const task of tasks) {
    const additions = [
      `Handoff index: ${handoffPath}`,
      `Connection notes: ${notesPath}`,
      `Outcome tracker: ${trackerPath}`
    ];
    const current = task.description ?? "";
    const description = additions.reduce((text, addition) => (text.includes(addition) ? text : `${text}\n${addition}`), current);
    await prisma.task.update({
      where: { id: task.id },
      data: {
        description,
        updatedAt: now,
        updatedBy: options.actorUserId
      }
    });
  }
}

function buildReviewQueue(rows: HandoffRow[], batch: string, generatedAt: string): string {
  const ready = rows.filter((row) => row.status === "Ready to review");
  const manual = rows.filter((row) => row.status !== "Ready to review");
  const counts = tierCounts(rows);
  const lines: string[] = [
    "---",
    `type: "linkedin_live_signal_review_queue"`,
    `source_of_truth: "postgresql"`,
    `batch: "${batch}"`,
    `generated_at: "${generatedAt}"`,
    `ready_to_review: ${ready.length}`,
    `needs_profile_verification: ${manual.length}`,
    "---",
    "",
    `# Live-Signal Prospect Review Queue - ${batch}`,
    "",
    "Use this as the operational handoff. Review in rank order, open each matched profile, confirm the current role/account in LinkedIn, then approve, reject, or revise the suggested note in the CRM.",
    "",
    "## Snapshot",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Total imported prospects | ${rows.length} |`,
    `| Ready to review with profile URL | ${ready.length} |`,
    `| Needs manual LinkedIn verification | ${manual.length} |`,
    `| Tier A | ${counts.A ?? 0} |`,
    `| Tier B | ${counts.B ?? 0} |`,
    `| Tier C | ${counts.C ?? 0} |`,
    `| Manual profile verification | ${counts.Manual ?? 0} |`,
    "",
    "## Ranked Queue",
    "",
    "| Rank | Tier | Priority | Due | Status | Company | Contact | Profile | Signal | Why now |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.tier} | ${row.priority} | ${row.followUpDate} | ${row.status} | ${row.company} | ${row.contact}<br>${row.role} | ${mdLink(row.profileUrl ? "LinkedIn" : "Manual", row.profileUrl)} | ${mdLink("source", row.sourceUrl)} | ${oneLine(row.rankReason)} |`
    );
  }

  lines.push("", "## Ready Notes", "");
  for (const row of ready) {
    lines.push(
      `### ${row.rank}. ${row.company} - ${row.contact}`,
      "",
      `- Profile: ${mdLink(row.profileUrl, row.profileUrl)}`,
      `- Signal: ${mdLink("source", row.sourceUrl)} - ${oneLine(row.whyThisFits)}`,
      `- Suggested note: ${oneLine(row.suggestedNote)}`,
      `- Short note: ${row.shortNote || "Not set"}`,
      ""
    );
  }

  lines.push("## Manual Verification", "");
  for (const row of manual) {
    lines.push(
      `### ${row.rank}. ${row.company} - ${row.contact}`,
      "",
      `- Priority: ${row.priority}`,
      `- Due: ${row.followUpDate}`,
      `- Role/persona: ${row.role}`,
      `- Signal: ${mdLink("source", row.sourceUrl)} - ${oneLine(row.whyThisFits)}`,
      `- Next action: ${row.nextAction}`,
      "- Manual searches:"
    );
    for (const query of row.peopleSearch.split("\n").map((line) => line.trim()).filter(Boolean)) {
      lines.push(`  - ${query}`);
    }
    lines.push("");
  }

  lines.push(
    "## Review Order",
    "",
    "1. Work ranks 1-9 first; these are Tier A and due 2026-05-22.",
    "2. Then clear ranks 10-12 if there is time in the same review block.",
    "3. Resolve rank 13 manually before lower-priority medium rows because tx / TX Labs is high-priority once the profile is verified.",
    "4. Use ranks 14-16 as secondary follow-up unless there is a direct relationship path.",
    ""
  );

  return lines.join("\n");
}

function buildConnectionNotes(rows: HandoffRow[], batch: string, generatedAt: string): string {
  const noteRows = rows.filter((row) => row.status === "Ready to review" && row.shortNote);
  const lines: string[] = [
    "---",
    `type: "linkedin_connection_note_pack"`,
    `source_of_truth: "postgresql"`,
    `batch: "${batch}"`,
    `generated_at: "${generatedAt}"`,
    `note_count: ${noteRows.length}`,
    "---",
    "",
    `# Connection Notes - ${batch}`,
    "",
    "Copy-ready short notes for ready-to-review prospects. Confirm the live LinkedIn profile and current role before sending.",
    "",
    "| Rank | Tier | Company | Contact | Chars | Profile | Note |",
    "| ---: | --- | --- | --- | ---: | --- | --- |"
  ];

  for (const row of noteRows) {
    lines.push(
      `| ${row.rank} | ${row.tier} | ${row.company} | ${row.contact}<br>${row.role} | ${row.shortNoteChars} | ${mdLink("LinkedIn", row.profileUrl)} | ${row.shortNote} |`
    );
  }

  lines.push("");
  for (const row of noteRows) {
    lines.push(
      `## ${row.rank}. ${row.company} - ${row.contact}`,
      "",
      `- Profile: ${row.profileUrl}`,
      `- Source: ${row.sourceUrl}`,
      `- Characters: ${row.shortNoteChars}`,
      "",
      "```text",
      row.shortNote,
      "```",
      ""
    );
  }

  return lines.join("\n");
}

function buildOutcomeTracker(rows: HandoffRow[], batch: string, generatedAt: string): string {
  const lines: string[] = [
    "---",
    `type: "linkedin_live_signal_outcome_tracker"`,
    `source_of_truth: "postgresql"`,
    `batch: "${batch}"`,
    `generated_at: "${generatedAt}"`,
    `prospects: ${rows.length}`,
    "---",
    "",
    `# Outcome Tracker - ${batch}`,
    "",
    "Use this during manual review. Update the CRM after each row; regenerate exports afterward.",
    "",
    "Allowed decisions: `Pending review`, `Approved for invite`, `Rejected`, `Deferred`, `Needs alternate contact`.",
    "Allowed execution statuses: `Not started`, `Invite sent`, `Message sent`, `Responded`, `No action`, `Blocked`.",
    "",
    "| Rank | Tier | Due | Company | Contact | Review status | Profile result | Decision | Outreach | Response | Profile | Short note |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.tier} | ${row.followUpDate} | ${row.company} | ${row.contact}<br>${row.role} | ${row.status} | ${row.profileVerificationResult} | ${row.reviewDecision} | ${row.outreachExecutionStatus} | ${row.responseStatus} | ${row.profileUrl ? mdLink("LinkedIn", row.profileUrl) : "Manual"} | ${row.shortNote ? "Ready" : "N/A"} |`
    );
  }

  lines.push("", "## Manual Update Checklist", "");
  for (const row of rows) {
    lines.push(
      `### ${row.rank}. ${row.company} - ${row.contact}`,
      "",
      `- [ ] Confirm profile/current role: ${row.profileUrl || "manual search required"}`,
      "- [ ] Set `linkedin_profile_verification_result`.",
      "- [ ] Set `linkedin_review_decision`.",
      "- [ ] If approved, send/copy note and set `linkedin_outreach_execution_status` plus `linkedin_actual_invite_sent_date`.",
      "- [ ] Record response or reason for no action in `linkedin_reviewer_notes`."
    );
    if (row.shortNote) {
      lines.push("", "```text", row.shortNote, "```");
    } else {
      lines.push("", `Next action: ${row.nextAction}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildBatchTasks(tasks: TaskRow[], batch: string, generatedAt: string): string {
  const lines: string[] = [
    "---",
    `type: "linkedin_live_signal_batch_tasks"`,
    `source_of_truth: "postgresql"`,
    `batch: "${batch}"`,
    `generated_at: "${generatedAt}"`,
    `task_count: ${tasks.length}`,
    "---",
    "",
    `# Live-Signal Batch Tasks - ${batch}`,
    "",
    "These are batch-level execution tasks. The standard follow-up export only includes lead-attached tasks, so this file keeps the batch review tasks visible in the handoff.",
    "",
    "| Due | Priority | Status | Task |",
    "| --- | --- | --- | --- |"
  ];

  for (const task of tasks) {
    lines.push(`| ${formatDate(task.dueAt)} | ${task.priority} | ${task.status} | ${task.title} |`);
  }

  lines.push("");
  for (const task of tasks) {
    lines.push(
      `## ${task.title}`,
      "",
      `- Task ID: \`${task.id}\``,
      `- Due: ${formatDate(task.dueAt)}`,
      `- Priority: ${task.priority}`,
      `- Status: ${task.status}`,
      "",
      task.description ?? "No description.",
      ""
    );
  }

  return lines.join("\n");
}

function buildHandoff(rows: HandoffRow[], tasks: TaskRow[], batch: string, generatedAt: string): string {
  const ready = rows.filter((row) => row.status === "Ready to review");
  const manual = rows.filter((row) => row.status !== "Ready to review");
  const counts = tierCounts(rows);
  const lines: string[] = [
    "---",
    `type: "linkedin_live_signal_batch_handoff"`,
    `source_of_truth: "postgresql"`,
    `batch: "${batch}"`,
    `generated_at: "${generatedAt}"`,
    `prospects: ${rows.length}`,
    `ready_to_review: ${ready.length}`,
    `manual_verification: ${manual.length}`,
    "---",
    "",
    `# Live-Signal Prospect Handoff - ${batch}`,
    "",
    "Open this file first. PostgreSQL is the source of truth; generated files are operational snapshots for review and outreach execution.",
    "",
    "## Files",
    "",
    `- ${mdLink("Ranked review queue", `./${batch}-review-queue.md`)}`,
    `- ${mdLink("Copy-ready connection notes", `./${batch}-connection-notes.md`)}`,
    `- ${mdLink("Outcome tracker", `./${batch}-outcome-tracker.md`)}`,
    `- ${mdLink("Batch-level tasks", `./${batch}-batch-tasks.md`)}`,
    `- ${mdLink("Review queue CSV", `./${batch}-review-queue.csv`)}`,
    `- ${mdLink("Connection notes CSV", `./${batch}-connection-notes.csv`)}`,
    `- ${mdLink("Outcome tracker CSV", `./${batch}-outcome-tracker.csv`)}`,
    `- ${mdLink("Original import CSV", `../linkedin-prospect-imports/${batch}.csv`)}`,
    "",
    "## Snapshot",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Prospects in batch | ${rows.length} |`,
    `| Ready with profile URL | ${ready.length} |`,
    `| Manual profile verification | ${manual.length} |`,
    `| Tier A | ${counts.A ?? 0} |`,
    `| Tier B | ${counts.B ?? 0} |`,
    `| Tier C | ${counts.C ?? 0} |`,
    `| Batch tasks | ${tasks.length} |`,
    "",
    "## Immediate Execution Order",
    "",
    "1. Clear Tier A ranks 1-9 using the connection note pack.",
    "2. Clear Tier B high-priority ranks 10-12 if the same review block has capacity.",
    "3. Resolve manual rank 13 tx / TX Labs before lower-priority rows.",
    "4. Record each result in the outcome tracker and CRM.",
    "5. Review ranks 14-16 only after the high-priority rows are handled or if there is a direct relationship path.",
    "",
    "## Top Ranked Rows",
    "",
    "| Rank | Tier | Company | Contact | Status | Profile | Short note ready | Decision | Outreach |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const row of rows.slice(0, 12)) {
    lines.push(
      `| ${row.rank} | ${row.tier} | ${row.company} | ${row.contact}<br>${row.role} | ${row.status} | ${row.profileUrl ? mdLink("LinkedIn", row.profileUrl) : "Manual"} | ${row.shortNote ? "Yes" : "No"} | ${row.reviewDecision} | ${row.outreachExecutionStatus} |`
    );
  }

  lines.push("", "## Manual Verification Rows", "");
  for (const row of manual) {
    lines.push(
      `### ${row.rank}. ${row.company} - ${row.contact}`,
      "",
      `- Priority: ${row.priority}`,
      `- Due: ${row.followUpDate}`,
      `- Role/persona: ${row.role}`,
      `- Next action: ${row.nextAction}`,
      ""
    );
  }

  lines.push("## Batch Tasks", "", "| Due | Priority | Status | Task |", "| --- | --- | --- | --- |");
  for (const task of tasks) {
    lines.push(`| ${formatDate(task.dueAt)} | ${task.priority} | ${task.status} | ${task.title} |`);
  }
  lines.push("");

  return lines.join("\n");
}

async function writeOutputs(rows: HandoffRow[], tasks: TaskRow[], options: Options): Promise<string[]> {
  const generatedAt = new Date().toISOString();
  const filePaths = {
    reviewMd: path.join(options.outputDir, `${options.batch}-review-queue.md`),
    reviewCsv: path.join(options.outputDir, `${options.batch}-review-queue.csv`),
    notesMd: path.join(options.outputDir, `${options.batch}-connection-notes.md`),
    notesCsv: path.join(options.outputDir, `${options.batch}-connection-notes.csv`),
    trackerMd: path.join(options.outputDir, `${options.batch}-outcome-tracker.md`),
    trackerCsv: path.join(options.outputDir, `${options.batch}-outcome-tracker.csv`),
    batchTasksMd: path.join(options.outputDir, `${options.batch}-batch-tasks.md`),
    handoffMd: path.join(options.outputDir, `${options.batch}-handoff.md`)
  };

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(filePaths.reviewMd, buildReviewQueue(rows, options.batch, generatedAt), "utf8");
  await writeFile(filePaths.notesMd, buildConnectionNotes(rows, options.batch, generatedAt), "utf8");
  await writeFile(filePaths.trackerMd, buildOutcomeTracker(rows, options.batch, generatedAt), "utf8");
  await writeFile(filePaths.batchTasksMd, buildBatchTasks(tasks, options.batch, generatedAt), "utf8");
  await writeFile(filePaths.handoffMd, buildHandoff(rows, tasks, options.batch, generatedAt), "utf8");

  const reviewHeaders = [
    "rank",
    "tier",
    "priority",
    "followUpDate",
    "status",
    "company",
    "contact",
    "role",
    "profileUrl",
    "sourceUrl",
    "rankReason",
    "suggestedNote",
    "shortNote",
    "nextAction",
    "peopleSearch"
  ];
  await writeFile(
    filePaths.reviewCsv,
    [reviewHeaders.join(","), ...rows.map((row) => reviewHeaders.map((key) => csvCell(row[key as keyof HandoffRow])).join(","))].join("\n"),
    "utf8"
  );

  const noteRows = rows.filter((row) => row.status === "Ready to review" && row.shortNote);
  const noteHeaders = ["rank", "tier", "priority", "company", "contact", "role", "profileUrl", "sourceUrl", "shortNoteChars", "shortNote"];
  await writeFile(
    filePaths.notesCsv,
    [noteHeaders.join(","), ...noteRows.map((row) => noteHeaders.map((key) => csvCell(row[key as keyof HandoffRow])).join(","))].join("\n"),
    "utf8"
  );

  const trackerHeaders = [
    "rank",
    "tier",
    "priority",
    "followUpDate",
    "company",
    "contact",
    "role",
    "status",
    "profileUrl",
    "profileVerificationResult",
    "reviewDecision",
    "outreachExecutionStatus",
    "actualInviteSentDate",
    "responseStatus",
    "reviewerNotes",
    "shortNote",
    "nextAction"
  ];
  await writeFile(
    filePaths.trackerCsv,
    [trackerHeaders.join(","), ...rows.map((row) => trackerHeaders.map((key) => csvCell(row[key as keyof HandoffRow])).join(","))].join("\n"),
    "utf8"
  );

  return Object.values(filePaths);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const initialLeads = await prisma.lead.findMany({
    where: {
      source,
      customFields: {
        path: ["linkedin_import_batch"],
        equals: options.batch
      }
    }
  });

  if (initialLeads.length === 0) {
    throw new Error(`No LinkedIn prospect leads found for batch ${options.batch}.`);
  }

  if (options.initializeOutcomes) {
    await upsertOutcomeDefinitions(options);
    await initializeOutcomeFields(initialLeads, options);
  }

  if (options.updateBatchTasks) {
    await updateBatchTaskLinks(options);
  }

  const [leads, batchTasks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        source,
        customFields: {
          path: ["linkedin_import_batch"],
          equals: options.batch
        }
      }
    }),
    prisma.task.findMany({
      where: liveSignalBatchTaskWhere(options.batch),
      orderBy: [{ dueAt: "asc" }, { title: "asc" }]
    })
  ]);
  const rows = leads.map(toRow).sort((a, b) => a.rank - b.rank || a.company.localeCompare(b.company));
  const generated = await writeOutputs(rows, batchTasks, options);
  const ready = rows.filter((row) => row.status === "Ready to review");
  const manual = rows.filter((row) => row.status !== "Ready to review");
  const noteRows = ready.filter((row) => row.shortNote);

  console.log(
    JSON.stringify(
      {
        batch: options.batch,
        outputDir: options.outputDir,
        prospects: rows.length,
        readyToReview: ready.length,
        manualVerification: manual.length,
        connectionNotes: noteRows.length,
        batchTasks: batchTasks.length,
        initializedOutcomes: options.initializeOutcomes,
        updatedBatchTasks: options.updateBatchTasks,
        generated
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
