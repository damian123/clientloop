import { z } from "zod";
import {
  accountImportRequestSchema,
  contactImportRequestSchema,
  exportEntitySchema,
  opportunityImportRequestSchema,
  type AccountImportPreview,
  type AccountImportRequest,
  type AccountImportRow,
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
const opportunityStageSchema = z.enum([
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost"
]);

type AccountImportField = "name" | "domain" | "status" | "ownerUserId";
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
