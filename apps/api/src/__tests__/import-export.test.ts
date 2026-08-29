import { describe, expect, it } from "vitest";
import {
  previewAccountImport,
  previewConferenceCompanyImport,
  previewConferenceMeetingImport,
  previewConferencePersonImport,
  previewContactImport,
  previewOpportunityImport
} from "../import-export";

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

  it("previews conference company CSV with relevance flags", () => {
    const preview = previewConferenceCompanyImport({
      csv: [
        "Company,Conference role,Sector,RWA relevance,Private markets relevance,Company score,Source URL",
        "Harbor Finance,sponsor,Private markets,true,yes,17,https://example.com/sponsors",
        ",unknown-role,,false,false,21,"
      ].join("\n")
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      company: "Harbor Finance",
      conferenceRole: "sponsor",
      rwaRelevance: true,
      privateMarketsRelevance: true,
      companyScore: 17
    });
    expect(preview.errors).toEqual([
      { row: 3, field: "company", message: "Company is required" },
      { row: 3, field: "conferenceRole", message: "Conference role is invalid" },
      { row: 3, field: "companyScore", message: "Company score must be between 0 and 20" }
    ]);
  });

  it("previews conference people CSV with lawful basis and score validation", () => {
    const preview = previewConferencePersonImport({
      csv: [
        "Name,Title,Email,ICP category,Source type,Source,Opt out status,Outreach status,Seniority score,Company fit score,Signal score,Conference signal score,Warm intro score,Timing score,Lawful basis notes",
        "Avery Stone,Head of Partnerships,,strategic_partner,speaker_agenda,Agenda page,not_opted_out,not_started,4,4,5,3,1,2,No email stored",
        "Bad Row,,bad-email,bad,manual_research,,opted_out,meeting_requested,9,4,5,3,1,2,"
      ].join("\n")
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      name: "Avery Stone",
      icpCategory: "strategic_partner",
      seniorityScore: 4
    });
    expect(preview.errors).toEqual([
      { row: 3, field: "title", message: "Title is required" },
      { row: 3, field: "email", message: "Email is invalid" },
      {
        row: 3,
        field: "lawfulBasisNotes",
        message: "Lawful basis notes are required when email is stored"
      },
      { row: 3, field: "icpCategory", message: "ICP category is invalid" },
      { row: 3, field: "source", message: "Source is required" },
      {
        row: 3,
        field: "outreachStatus",
        message: "Opted-out people cannot be included in outreach actions"
      },
      { row: 3, field: "seniorityScore", message: "seniorityScore must be between 0 and 4" }
    ]);
  });

  it("previews conference meeting CSV with status derivation and required person", () => {
    const preview = previewConferenceMeetingImport({
      csv: [
        "Name,Company,Reason to meet,Proposed ask,Intro path,Meeting requested,Meeting booked,Notes,Next step",
        "Avery Stone,Harbor Finance,Compare notes on tokenization,15-minute meeting,Warm intro,yes,false,Prioritize before event,Request intro",
        ",Harbor Finance,,15-minute meeting,,false,false,,"
      ].join("\n")
    });

    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      name: "Avery Stone",
      company: "Harbor Finance",
      reasonToMeet: "Compare notes on tokenization",
      status: "requested"
    });
    expect(preview.errors).toEqual([
      { row: 3, field: "name", message: "Name or conference person ID is required" },
      { row: 3, field: "reasonToMeet", message: "Reason to meet is required" }
    ]);
  });
});
