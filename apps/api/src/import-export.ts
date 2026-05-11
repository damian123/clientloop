import { z } from "zod";
import {
  contactImportRequestSchema,
  exportEntitySchema,
  type ContactImportPreview,
  type ContactImportRequest,
  type ContactImportRow,
  type ExportEntity
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

type ContactImportField = "firstName" | "lastName" | "email" | "phone" | "accountId" | "ownerUserId";

const contactAliases: Record<ContactImportField, string[]> = {
  firstName: ["firstName", "first_name", "First Name", "First name"],
  lastName: ["lastName", "last_name", "Last Name", "Last name"],
  email: ["email", "Email"],
  phone: ["phone", "Phone"],
  accountId: ["accountId", "account_id", "Account ID"],
  ownerUserId: ["ownerUserId", "owner_user_id", "Owner User ID"]
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

function readMappedValue(
  row: CsvRow,
  field: ContactImportField,
  mapping: ContactImportRequest["mapping"] | undefined
): string {
  const explicitHeader = mapping?.[field];

  if (explicitHeader) {
    return row[explicitHeader]?.trim() ?? "";
  }

  for (const alias of contactAliases[field]) {
    const value = row[alias]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
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
