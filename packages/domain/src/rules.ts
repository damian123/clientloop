import type {
  AuditFields,
  ConferenceOptOutStatus,
  ConferenceOutreachStatus,
  ConferencePriorityBand,
  EntityId,
  ISODate,
  Lead,
  Opportunity,
  OpportunityStage,
  Task,
  TenantId
} from "./types";

export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainRuleError";
  }
}

export const opportunityStageOrder: OpportunityStage[] = [
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost"
];

const terminalStages = new Set<OpportunityStage>(["closed_won", "closed_lost"]);

export function createAuditFields(input: {
  tenantId: TenantId;
  actorUserId: EntityId;
  now: ISODate;
}): AuditFields {
  return {
    tenantId: input.tenantId,
    createdAt: input.now,
    updatedAt: input.now,
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
    version: 1
  };
}

export function canTransitionOpportunityStage(
  currentStage: OpportunityStage,
  nextStage: OpportunityStage
): boolean {
  if (currentStage === nextStage) {
    return true;
  }

  if (terminalStages.has(currentStage)) {
    return false;
  }

  return opportunityStageOrder.includes(nextStage);
}

export function changeOpportunityStage(input: {
  opportunity: Opportunity;
  nextStage: OpportunityStage;
  actorUserId: EntityId;
  expectedVersion: number;
  now: ISODate;
}): Opportunity {
  if (input.opportunity.version !== input.expectedVersion) {
    throw new DomainRuleError("Opportunity version conflict");
  }

  if (!canTransitionOpportunityStage(input.opportunity.stage, input.nextStage)) {
    throw new DomainRuleError(
      `Cannot transition opportunity from ${input.opportunity.stage} to ${input.nextStage}`
    );
  }

  return {
    ...input.opportunity,
    stage: input.nextStage,
    updatedAt: input.now,
    updatedBy: input.actorUserId,
    version: input.opportunity.version + 1
  };
}

export function completeTask(input: {
  task: Task;
  actorUserId: EntityId;
  expectedVersion: number;
  now: ISODate;
}): Task {
  if (input.task.version !== input.expectedVersion) {
    throw new DomainRuleError("Task version conflict");
  }

  if (input.task.status === "done") {
    return input.task;
  }

  return {
    ...input.task,
    status: "done",
    updatedAt: input.now,
    updatedBy: input.actorUserId,
    version: input.task.version + 1
  };
}

export function convertLead(input: {
  lead: Lead;
  actorUserId: EntityId;
  expectedVersion: number;
  now: ISODate;
  convertedAccountId: EntityId;
  convertedContactId: EntityId;
  convertedOpportunityId?: EntityId | null | undefined;
}): Lead {
  if (input.lead.version !== input.expectedVersion) {
    throw new DomainRuleError("Lead version conflict");
  }

  if (input.lead.status === "converted") {
    throw new DomainRuleError("Lead is already converted");
  }

  if (input.lead.status === "disqualified") {
    throw new DomainRuleError("Disqualified leads cannot be converted");
  }

  return {
    ...input.lead,
    status: "converted",
    convertedAt: input.now,
    convertedAccountId: input.convertedAccountId,
    convertedContactId: input.convertedContactId,
    convertedOpportunityId: input.convertedOpportunityId,
    updatedAt: input.now,
    updatedBy: input.actorUserId,
    version: input.lead.version + 1
  };
}

export interface ConferenceScoreInput {
  seniorityScore: number;
  companyFitScore: number;
  signalScore: number;
  conferenceSignalScore: number;
  warmIntroScore: number;
  timingScore: number;
}

export interface ConferenceScoreResult extends ConferenceScoreInput {
  totalScore: number;
  priorityBand: ConferencePriorityBand;
}

const conferenceScoreRanges: Record<keyof ConferenceScoreInput, { min: number; max: number }> = {
  seniorityScore: { min: 0, max: 4 },
  companyFitScore: { min: 0, max: 4 },
  signalScore: { min: 0, max: 5 },
  conferenceSignalScore: { min: 0, max: 3 },
  warmIntroScore: { min: 0, max: 2 },
  timingScore: { min: 0, max: 2 }
};

export function scoreConferenceProspect(input: ConferenceScoreInput): ConferenceScoreResult {
  for (const [field, range] of Object.entries(conferenceScoreRanges)) {
    const value = input[field as keyof ConferenceScoreInput];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new DomainRuleError(`${field} must be an integer from ${range.min} to ${range.max}`);
    }
  }

  const totalScore =
    input.seniorityScore +
    input.companyFitScore +
    input.signalScore +
    input.conferenceSignalScore +
    input.warmIntroScore +
    input.timingScore;

  return {
    ...input,
    totalScore,
    priorityBand: priorityBandForConferenceScore(totalScore)
  };
}

export function priorityBandForConferenceScore(totalScore: number): ConferencePriorityBand {
  if (!Number.isInteger(totalScore) || totalScore < 0 || totalScore > 20) {
    throw new DomainRuleError("totalScore must be an integer from 0 to 20");
  }

  if (totalScore >= 16) {
    return "request_meeting";
  }

  if (totalScore >= 12) {
    return "personalized_outreach";
  }

  if (totalScore >= 8) {
    return "nurture";
  }

  return "do_not_prioritize";
}

export function assertConferenceEmailLawfulBasis(input: {
  email?: string | null | undefined;
  lawfulBasisNotes?: string | null | undefined;
}): void {
  if (input.email && !input.lawfulBasisNotes?.trim()) {
    throw new DomainRuleError("Lawful basis notes are required before storing an outreach email");
  }
}

export function assertConferenceOutreachAllowed(input: {
  optOutStatus: ConferenceOptOutStatus;
  outreachStatus?: ConferenceOutreachStatus | undefined;
}): void {
  if (
    input.optOutStatus === "opted_out" &&
    (input.outreachStatus === "queued" ||
      input.outreachStatus === "contacted" ||
      input.outreachStatus === "meeting_requested" ||
      input.outreachStatus === "meeting_booked")
  ) {
    throw new DomainRuleError("Opted-out conference prospects cannot be added to outreach actions");
  }
}
