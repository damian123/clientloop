import { describe, expect, it } from "vitest";
import { changeOpportunityStage, convertLead } from "./rules";
import { seedOpportunities, seedUserId } from "./seed";

describe("opportunity rules", () => {
  it("increments version when stage changes with the expected version", () => {
    const opportunity = seedOpportunities[0]!;

    const updated = changeOpportunityStage({
      opportunity,
      nextStage: "proposal",
      actorUserId: seedUserId,
      expectedVersion: opportunity.version,
      now: "2026-05-12T00:00:00.000Z"
    });

    expect(updated.stage).toBe("proposal");
    expect(updated.version).toBe(opportunity.version + 1);
  });

  it("rejects stale versions", () => {
    const opportunity = seedOpportunities[0]!;

    expect(() =>
      changeOpportunityStage({
        opportunity,
        nextStage: "proposal",
        actorUserId: seedUserId,
        expectedVersion: 99,
        now: "2026-05-12T00:00:00.000Z"
      })
    ).toThrow("version conflict");
  });
});

describe("lead rules", () => {
  it("converts leads with optimistic concurrency", () => {
    const lead = {
      id: "lead-1",
      tenantId: "tenant-1",
      source: "website",
      contactName: "Iris Novak",
      status: "qualified" as const,
      customFields: {},
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:00:00.000Z",
      createdBy: seedUserId,
      updatedBy: seedUserId,
      version: 1
    };

    const converted = convertLead({
      lead,
      actorUserId: seedUserId,
      expectedVersion: 1,
      now: "2026-05-11T01:00:00.000Z",
      convertedAccountId: "account-1",
      convertedContactId: "contact-1",
      convertedOpportunityId: "opportunity-1"
    });

    expect(converted.status).toBe("converted");
    expect(converted.convertedAccountId).toBe("account-1");
    expect(converted.convertedContactId).toBe("contact-1");
    expect(converted.convertedOpportunityId).toBe("opportunity-1");
    expect(converted.version).toBe(2);
    expect(() =>
      convertLead({
        lead,
        actorUserId: seedUserId,
        expectedVersion: 99,
        now: "2026-05-11T01:00:00.000Z",
        convertedAccountId: "account-1",
        convertedContactId: "contact-1"
      })
    ).toThrow("version conflict");
  });
});
