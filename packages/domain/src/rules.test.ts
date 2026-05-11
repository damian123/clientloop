import { describe, expect, it } from "vitest";
import { changeOpportunityStage } from "./rules";
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
