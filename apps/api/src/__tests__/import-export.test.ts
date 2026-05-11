import { describe, expect, it } from "vitest";
import { previewContactImport } from "../import-export";

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
});
