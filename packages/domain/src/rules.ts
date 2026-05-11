import type {
  AuditFields,
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
