import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const outputDir = path.resolve(process.env.LINKEDIN_BRIEF_OUTPUT_DIR ?? "outputs/linkedin-prospect-briefs");
const generatedAt = new Date().toISOString();

type JsonFields = Record<string, unknown>;
type AccountRow = Awaited<ReturnType<typeof prisma.account.findMany>>[number];
type LeadRow = Awaited<ReturnType<typeof prisma.lead.findMany>>[number];
type TaskRow = Awaited<ReturnType<typeof prisma.task.findMany>>[number];

function fields(value: unknown): JsonFields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonFields) : {};
}

function textField(record: JsonFields, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function numberField(record: JsonFields, key: string): number {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function priorityRank(priority: string | null): number {
  return { High: 3, Medium: 2, Low: 1 }[priority ?? ""] ?? 0;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "account";
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(-8);
}

function frontmatter(record: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        lines.push(...value.map((item) => `  - ${JSON.stringify(item)}`));
      }
      continue;
    }
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function markdownCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }
  return String(value).replace(/\n/g, "<br>").replace(/\|/g, "\\|");
}

function markdownList(value: string | null, empty = "None recorded."): string {
  if (!value) {
    return empty;
  }
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function countBy<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item) ?? "Not set";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function countTable(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `| ${markdownCell(key)} | ${count} |`)
    .join("\n");
}

function accountSort(a: AccountRow, b: AccountRow): number {
  const aFields = fields(a.customFields);
  const bFields = fields(b.customFields);
  return (
    priorityRank(textField(bFields, "linkedin_priority")) - priorityRank(textField(aFields, "linkedin_priority")) ||
    numberField(bFields, "linkedin_queue_lead_count") - numberField(aFields, "linkedin_queue_lead_count") ||
    a.name.localeCompare(b.name)
  );
}

function leadSort(a: LeadRow, b: LeadRow): number {
  const aFields = fields(a.customFields);
  const bFields = fields(b.customFields);
  return (
    priorityRank(textField(bFields, "linkedin_priority")) - priorityRank(textField(aFields, "linkedin_priority")) ||
    (a.companyName ?? "").localeCompare(b.companyName ?? "") ||
    a.contactName.localeCompare(b.contactName)
  );
}

function formatDate(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function leadSummary(lead: LeadRow, tasksByLeadId: Map<string, TaskRow[]>): string {
  const leadFields = fields(lead.customFields);
  const tasks = tasksByLeadId.get(lead.id) ?? [];
  const taskText = tasks.length
    ? tasks.map((task) => `${task.status} ${task.priority} due ${formatDate(task.dueAt) ?? "unscheduled"}: ${task.title}`).join("; ")
    : "None";

  return [
    `### ${lead.contactName}`,
    "",
    `- Lead ID: \`${lead.id}\``,
    `- Account: ${lead.companyName ?? "Not set"}`,
    `- Priority: ${textField(leadFields, "linkedin_priority") ?? "Not set"}`,
    `- Review status: ${textField(leadFields, "linkedin_review_status") ?? lead.status}`,
    `- Outcome: ${textField(leadFields, "linkedin_outcome") ?? "Not set"}`,
    `- Follow-up date: ${textField(leadFields, "linkedin_follow_up_date") ?? "Not set"}`,
    `- Profile: ${textField(leadFields, "linkedin_profile_url") ?? "Not set"}`,
    `- Tasks: ${taskText}`,
    "",
    "**Why this fits**",
    "",
    textField(leadFields, "linkedin_why_this_fits") ?? "Not set.",
    "",
    "**Suggested note**",
    "",
    textField(leadFields, "linkedin_suggested_note") ?? "Not set.",
    ""
  ].join("\n");
}

function accountBrief(
  account: AccountRow,
  leads: LeadRow[],
  tasksByLeadId: Map<string, TaskRow[]>,
  accountFilePath: string
): string {
  const accountFields = fields(account.customFields);
  const accountTasks = leads.flatMap((lead) => tasksByLeadId.get(lead.id) ?? []);
  const openTasks = accountTasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const leadIds = leads.map((lead) => lead.id);

  return (
    frontmatter({
      type: "linkedin_account_brief",
      source_of_truth: "postgresql",
      generated_at: generatedAt,
      account_id: account.id,
      account_name: account.name,
      domain: account.domain,
      status: account.status,
      priority: textField(accountFields, "linkedin_priority"),
      queue_lead_count: numberField(accountFields, "linkedin_queue_lead_count"),
      workbook_row_count: numberField(accountFields, "linkedin_workbook_row_count"),
      latest_activity_date: textField(accountFields, "linkedin_latest_activity_date"),
      lead_ids: leadIds,
      path: accountFilePath
    }) +
    [
      `# ${account.name}`,
      "",
      "Source of truth: PostgreSQL. Edit CRM records, then regenerate this file.",
      "",
      "## Snapshot",
      "",
      "| Field | Value |",
      "| --- | --- |",
      `| Account ID | \`${account.id}\` |`,
      `| Domain | ${markdownCell(account.domain)} |`,
      `| Status | ${markdownCell(account.status)} |`,
      `| LinkedIn priority | ${markdownCell(textField(accountFields, "linkedin_priority"))} |`,
      `| Region | ${markdownCell(textField(accountFields, "linkedin_region"))} |`,
      `| Fit type | ${markdownCell(textField(accountFields, "linkedin_fit_type"))} |`,
      `| Queue leads | ${numberField(accountFields, "linkedin_queue_lead_count")} |`,
      `| Workbook rows | ${numberField(accountFields, "linkedin_workbook_row_count")} |`,
      `| Needs verification | ${numberField(accountFields, "linkedin_needs_verification_count")} |`,
      `| Latest activity | ${markdownCell(textField(accountFields, "linkedin_latest_activity_date"))} |`,
      `| Open follow-up tasks | ${openTasks.length} |`,
      "",
      "## Prospecting Context",
      "",
      textField(accountFields, "linkedin_fit_rationale") ?? "No fit rationale recorded.",
      "",
      "## Target Personas",
      "",
      markdownList(textField(accountFields, "linkedin_target_personas")),
      "",
      "## Current State",
      "",
      "### Review Statuses",
      "",
      markdownList(textField(accountFields, "linkedin_review_statuses")),
      "",
      "### Invite Outcomes",
      "",
      markdownList(textField(accountFields, "linkedin_invite_outcomes")),
      "",
      "### Next Actions",
      "",
      markdownList(textField(accountFields, "linkedin_next_actions")),
      "",
      "## Evidence",
      "",
      "### Profile URLs",
      "",
      markdownList(textField(accountFields, "linkedin_profile_urls")),
      "",
      "### Source Evidence",
      "",
      markdownList(textField(accountFields, "linkedin_source_evidence")),
      "",
      "### Source Sheets",
      "",
      markdownList(textField(accountFields, "linkedin_source_sheets"), "No source sheets recorded."),
      "",
      "## Linked Leads",
      "",
      leads.length ? leads.map((lead) => leadSummary(lead, tasksByLeadId)).join("\n") : "No master queue leads are attached to this account yet.",
      ""
    ].join("\n")
  );
}

function queueBrief(title: string, description: string, leads: LeadRow[], tasksByLeadId: Map<string, TaskRow[]>): string {
  return (
    frontmatter({
      type: "linkedin_queue_brief",
      source_of_truth: "postgresql",
      generated_at: generatedAt,
      title,
      lead_count: leads.length,
      lead_ids: leads.map((lead) => lead.id)
    }) +
    [
      `# ${title}`,
      "",
      description,
      "",
      "Source of truth: PostgreSQL. Edit CRM records, then regenerate this file.",
      "",
      leads.length ? leads.map((lead) => leadSummary(lead, tasksByLeadId)).join("\n") : "No leads currently match this queue.",
      ""
    ].join("\n")
  );
}

function followUpBrief(tasks: TaskRow[], leadById: Map<string, LeadRow>): string {
  const taskLines = tasks.map((task) => {
    const lead = task.parentId ? leadById.get(task.parentId) : undefined;
    const leadFields = fields(lead?.customFields);
    return [
      `## ${formatDate(task.dueAt) ?? "Unscheduled"} - ${task.title}`,
      "",
      `- Task ID: \`${task.id}\``,
      `- Lead ID: ${lead ? `\`${lead.id}\`` : "Not set"}`,
      `- Account: ${lead?.companyName ?? "Not set"}`,
      `- Contact: ${lead?.contactName ?? "Not set"}`,
      `- Priority: ${task.priority}`,
      `- Status: ${task.status}`,
      `- Review status: ${textField(leadFields, "linkedin_review_status") ?? "Not set"}`,
      `- Profile: ${textField(leadFields, "linkedin_profile_url") ?? "Not set"}`,
      "",
      task.description ?? "No description recorded.",
      ""
    ].join("\n");
  });

  return (
    frontmatter({
      type: "linkedin_follow_up_queue",
      source_of_truth: "postgresql",
      generated_at: generatedAt,
      task_count: tasks.length,
      task_ids: tasks.map((task) => task.id)
    }) +
    [
      "# LinkedIn Follow-Up Queue",
      "",
      "Open and in-progress follow-up tasks generated from current CRM state.",
      "",
      "Source of truth: PostgreSQL. Edit CRM records, then regenerate this file.",
      "",
      taskLines.length ? taskLines.join("\n") : "No open LinkedIn follow-up tasks are currently due.",
      ""
    ].join("\n")
  );
}

async function main() {
  const [allAccounts, leads] = await Promise.all([
    prisma.account.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" }
    }),
    prisma.lead.findMany({
      where: {
        source: "linkedin_prospect_queue",
        archivedAt: null
      },
      orderBy: [{ companyName: "asc" }, { contactName: "asc" }]
    })
  ]);

  const leadIds = leads.map((lead) => lead.id);
  const tasks = leadIds.length
    ? await prisma.task.findMany({
        where: {
          parentType: "lead",
          parentId: { in: leadIds },
          archivedAt: null
        },
        orderBy: [{ dueAt: "asc" }, { title: "asc" }]
      })
    : [];

  const accounts = allAccounts
    .filter((account) => Object.hasOwn(fields(account.customFields), "linkedin_priority"))
    .sort(accountSort);

  const leadsByAccount = new Map<string, LeadRow[]>();
  for (const lead of leads) {
    if (!lead.companyName) {
      continue;
    }
    const group = leadsByAccount.get(lead.companyName) ?? [];
    group.push(lead);
    leadsByAccount.set(lead.companyName, group);
  }
  for (const group of leadsByAccount.values()) {
    group.sort(leadSort);
  }

  const tasksByLeadId = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    if (!task.parentId) {
      continue;
    }
    const group = tasksByLeadId.get(task.parentId) ?? [];
    group.push(task);
    tasksByLeadId.set(task.parentId, group);
  }

  await rm(path.join(outputDir, "accounts"), { recursive: true, force: true });
  await rm(path.join(outputDir, "queues"), { recursive: true, force: true });
  await mkdir(path.join(outputDir, "accounts"), { recursive: true });
  await mkdir(path.join(outputDir, "queues"), { recursive: true });

  const accountManifest = [];
  for (const account of accounts) {
    const relativeFile = `accounts/${slugify(account.name)}-${shortId(account.id)}.md`;
    const accountLeads = leadsByAccount.get(account.name) ?? [];
    await writeFile(
      path.join(outputDir, relativeFile),
      accountBrief(account, accountLeads, tasksByLeadId, relativeFile),
      "utf8"
    );
    accountManifest.push({
      id: account.id,
      name: account.name,
      path: relativeFile,
      leadCount: accountLeads.length,
      priority: textField(fields(account.customFields), "linkedin_priority")
    });
  }

  const readyReviewStatuses = new Set([
    "Ready to review",
    "Approved",
    "Needs LinkedIn profile verification",
    "Needs account verification"
  ]);
  const readyToReviewLeads = leads
    .filter((lead) => readyReviewStatuses.has(textField(fields(lead.customFields), "linkedin_review_status") ?? ""))
    .sort(leadSort);
  const needsVerificationLeads = leads
    .filter((lead) => (textField(fields(lead.customFields), "linkedin_review_status") ?? "").toLowerCase().includes("verification"))
    .sort(leadSort);
  const openFollowUpTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  await writeFile(
    path.join(outputDir, "queues/ready-to-review.md"),
    queueBrief(
      "LinkedIn Ready-To-Review Queue",
      "Prospects that need human review before the next LinkedIn action.",
      readyToReviewLeads,
      tasksByLeadId
    ),
    "utf8"
  );
  await writeFile(
    path.join(outputDir, "queues/needs-verification.md"),
    queueBrief(
      "LinkedIn Needs-Verification Queue",
      "Prospects whose account or profile evidence needs verification before outreach.",
      needsVerificationLeads,
      tasksByLeadId
    ),
    "utf8"
  );
  await writeFile(path.join(outputDir, "queues/follow-ups.md"), followUpBrief(openFollowUpTasks, leadById), "utf8");

  const priorityCounts = countBy(accounts, (account) => textField(fields(account.customFields), "linkedin_priority"));
  const leadStatusCounts = countBy(leads, (lead) => textField(fields(lead.customFields), "linkedin_review_status"));
  const taskStatusCounts = countBy(tasks, (task) => task.status);

  const readme = [
    frontmatter({
      type: "linkedin_prospect_brief_index",
      source_of_truth: "postgresql",
      generated_at: generatedAt,
      account_count: accounts.length,
      lead_count: leads.length,
      follow_up_task_count: tasks.length
    }).trimEnd(),
    "",
    "# LinkedIn Prospect Briefs",
    "",
    "These Markdown files are generated snapshots for AI/chat workflows. PostgreSQL is the source of truth; update the CRM/database, then regenerate these files.",
    "",
    "## Counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| LinkedIn accounts | ${accounts.length} |`,
    `| LinkedIn leads | ${leads.length} |`,
    `| Follow-up tasks | ${tasks.length} |`,
    `| Ready-to-review leads | ${readyToReviewLeads.length} |`,
    `| Needs-verification leads | ${needsVerificationLeads.length} |`,
    `| Open follow-up tasks | ${openFollowUpTasks.length} |`,
    "",
    "## Account Priority Mix",
    "",
    "| Priority | Accounts |",
    "| --- | ---: |",
    countTable(priorityCounts),
    "",
    "## Lead Review Status Mix",
    "",
    "| Review status | Leads |",
    "| --- | ---: |",
    countTable(leadStatusCounts),
    "",
    "## Task Status Mix",
    "",
    "| Task status | Tasks |",
    "| --- | ---: |",
    countTable(taskStatusCounts),
    "",
    "## Queue Files",
    "",
    "- [Ready to review](queues/ready-to-review.md)",
    "- [Needs verification](queues/needs-verification.md)",
    "- [Follow-ups](queues/follow-ups.md)",
    "",
    "## Account Files",
    "",
    ...accountManifest.map((account) => `- [${account.name}](${account.path}) - ${account.priority ?? "Not set"}, ${account.leadCount} linked leads`),
    ""
  ].join("\n");

  await writeFile(path.join(outputDir, "README.md"), readme, "utf8");
  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(
      {
        sourceOfTruth: "postgresql",
        generatedAt,
        counts: {
          accounts: accounts.length,
          leads: leads.length,
          tasks: tasks.length,
          readyToReviewLeads: readyToReviewLeads.length,
          needsVerificationLeads: needsVerificationLeads.length,
          openFollowUpTasks: openFollowUpTasks.length
        },
        accounts: accountManifest
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        outputDir,
        accounts: accounts.length,
        leads: leads.length,
        tasks: tasks.length,
        readyToReviewLeads: readyToReviewLeads.length,
        needsVerificationLeads: needsVerificationLeads.length,
        openFollowUpTasks: openFollowUpTasks.length
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
