import {
  accountCreateInput,
  contactCreateInput,
  contactCreateValidationMessage,
  emptyOpportunityCreateDraft,
  leadCreateInput,
  leadCreateValidationMessage,
  opportunityCreateInput,
  opportunityCreateValidationMessage
} from "./create-record-inputs";
import { describe, expect, it } from "vitest";

describe("create record inputs", () => {
  it("trims account fields and omits blank optional fields", () => {
    expect(
      accountCreateInput({
        name: "  Northstar  ",
        domain: "  northstar.example  ",
        status: "prospect"
      })
    ).toEqual({
      name: "Northstar",
      domain: "northstar.example",
      status: "prospect",
      customFields: {}
    });

    expect(
      accountCreateInput({
        name: "  ",
        domain: "northstar.example",
        status: "prospect"
      })
    ).toBeNull();
  });

  it("validates contact names and optional email", () => {
    expect(
      contactCreateInput({
        firstName: "  Maya  ",
        lastName: " Chen ",
        email: " maya@example.com ",
        phone: "  +1 555 0100 ",
        accountId: "account-1"
      })
    ).toEqual({
      firstName: "Maya",
      lastName: "Chen",
      accountId: "account-1",
      email: "maya@example.com",
      phone: "+1 555 0100",
      customFields: {}
    });

    const invalidEmail = {
      firstName: "Maya",
      lastName: "Chen",
      email: "not-an-email",
      phone: "",
      accountId: ""
    };

    expect(contactCreateInput(invalidEmail)).toBeNull();
    expect(contactCreateValidationMessage(invalidEmail)).toContain("valid email");
  });

  it("validates lead name, source, and optional email", () => {
    expect(
      leadCreateInput({
        contactName: "  Jordan Rivera ",
        companyName: "  Acme ",
        email: "",
        source: " Website "
      })
    ).toEqual({
      contactName: "Jordan Rivera",
      companyName: "Acme",
      email: undefined,
      source: "Website",
      status: "new",
      customFields: {}
    });

    const invalidLead = {
      contactName: "Jordan Rivera",
      companyName: "",
      email: "bad",
      source: "Website"
    };

    expect(leadCreateInput(invalidLead)).toBeNull();
    expect(leadCreateValidationMessage(invalidLead)).toContain("valid email");
  });

  it("parses opportunity numeric fields and rejects invalid values", () => {
    expect(
      opportunityCreateInput(
        {
          ...emptyOpportunityCreateDraft(),
          accountId: "account-1",
          primaryContactId: "contact-1",
          name: "  Expansion ",
          stage: "discovery",
          amount: "64000.50",
          expectedCloseDate: "2026-06-30",
          probabilityPct: "45"
        },
        "owner-1"
      )
    ).toEqual({
      accountId: "account-1",
      primaryContactId: "contact-1",
      name: "Expansion",
      stage: "discovery",
      amount: 64000.5,
      currency: "USD",
      expectedCloseDate: "2026-06-30",
      ownerUserId: "owner-1",
      probabilityPct: 45,
      customFields: {}
    });

    const invalidAmount = {
      ...emptyOpportunityCreateDraft(),
      accountId: "account-1",
      name: "Expansion",
      amount: "-1"
    };
    expect(opportunityCreateInput(invalidAmount, "owner-1")).toBeNull();
    expect(opportunityCreateValidationMessage(invalidAmount)).toContain("nonnegative amount");

    const invalidProbability = {
      ...emptyOpportunityCreateDraft(),
      accountId: "account-1",
      name: "Expansion",
      probabilityPct: "101"
    };
    expect(opportunityCreateInput(invalidProbability, "owner-1")).toBeNull();
    expect(opportunityCreateValidationMessage(invalidProbability)).toContain("0 to 100");
  });
});
