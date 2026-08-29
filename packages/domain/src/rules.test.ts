import { describe, expect, it } from "vitest";
import {
  assertConferenceEmailLawfulBasis,
  assertConferenceOutreachAllowed,
  changeOpportunityStage,
  convertLead,
  scoreConferenceProspect
} from "./rules";
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

describe("conference prospecting rules", () => {
  it("scores conference prospects and derives priority bands", () => {
    const score = scoreConferenceProspect({
      seniorityScore: 4,
      companyFitScore: 4,
      signalScore: 5,
      conferenceSignalScore: 3,
      warmIntroScore: 1,
      timingScore: 2
    });

    expect(score.totalScore).toBe(19);
    expect(score.priorityBand).toBe("request_meeting");
  });

  it("rejects out-of-range score inputs", () => {
    expect(() =>
      scoreConferenceProspect({
        seniorityScore: 5,
        companyFitScore: 4,
        signalScore: 5,
        conferenceSignalScore: 3,
        warmIntroScore: 1,
        timingScore: 2
      })
    ).toThrow("seniorityScore");
  });

  it("requires lawful basis notes before storing outreach email", () => {
    expect(() =>
      assertConferenceEmailLawfulBasis({
        email: "buyer@example.com"
      })
    ).toThrow("Lawful basis");
  });

  it("blocks outreach actions for opted-out people", () => {
    expect(() =>
      assertConferenceOutreachAllowed({
        optOutStatus: "opted_out",
        outreachStatus: "meeting_requested"
      })
    ).toThrow("Opted-out");
  });
});
