import { describe, expect, it } from "vitest";
import { previewAccountImport, previewContactImport, previewOpportunityImport } from "../import-export";

describe("import/export helpers", () => {
  it("previews contact CSV with aliases and validation errors", () => {
    const preview = previewContactImport({
      csv: [
        "First Name,Last Name,Email,Phone",
        "Avery,Stone,avery@example.com,+1 415 555 0101",
        "Missing,,not-an-email,"
      ].join("\n")
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      firstName: "Avery",
      lastName: "Stone",
      email: "avery@example.com"
    });
    expect(preview.errors).toEqual([
      { row: 3, field: "lastName", message: "Last name is required" },
      { row: 3, field: "email", message: "Email is invalid" }
    ]);
  });

  it("previews account CSV with defaults and validation errors", () => {
    const preview = previewAccountImport({
      csv: ["Account Name,Domain,Status", "Apex Labs,apex.example,customer", ",bad.example,unknown"].join("\n")
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      name: "Apex Labs",
      domain: "apex.example",
      status: "customer"
    });
    expect(preview.errors).toEqual([
      { row: 3, field: "name", message: "Name is required" },
      { row: 3, field: "status", message: "Status is invalid" }
    ]);
  });

  it("previews opportunity CSV with numeric validation", () => {
    const preview = previewOpportunityImport({
      csv: [
        "Opportunity Name,Account ID,Owner User ID,Stage,Amount,Currency,Probability %",
        "Expansion,account-1,user-1,proposal,50000,USD,60",
        ",,user-1,bad-stage,not-a-number,US,101"
      ].join("\n")
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      name: "Expansion",
      accountId: "account-1",
      ownerUserId: "user-1",
      stage: "proposal",
      amount: 50000,
      currency: "USD",
      probabilityPct: 60
    });
    expect(preview.errors).toEqual([
      { row: 3, field: "name", message: "Name is required" },
      { row: 3, field: "accountId", message: "Account ID is required" },
      { row: 3, field: "stage", message: "Stage is invalid" },
      { row: 3, field: "amount", message: "Amount must be a nonnegative number" },
      { row: 3, field: "currency", message: "Currency must be a 3-letter code" },
      { row: 3, field: "probabilityPct", message: "Probability must be between 0 and 100" }
    ]);
  });
});
