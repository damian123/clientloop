import type {
  CRMEntityType,
  EntityId,
  ISODate,
  TenantId
} from "./types";

export type DomainEventType =
  | "account.created"
  | "account.updated"
  | "contact.created"
  | "contact.updated"
  | "lead.created"
  | "lead.converted"
  | "opportunity.created"
  | "opportunity.stage_changed"
  | "task.created"
  | "task.completed"
  | "task.updated"
  | "note.appended"
  | "note.updated"
  | "activity.logged"
  | "activity.updated";

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: EntityId;
  tenantId: TenantId;
  type: DomainEventType;
  entity: {
    type: CRMEntityType;
    id: EntityId;
  };
  actorUserId: EntityId;
  occurredAt: ISODate;
  payload: TPayload;
}

export interface OutboxEvent extends DomainEvent {
  status: "pending" | "delivering" | "delivered" | "failed";
  attempts: number;
  nextAttemptAt?: ISODate | null;
  deliveredAt?: ISODate | null;
  lastError?: string | null;
}

export function createDomainEvent<TPayload extends Record<string, unknown>>(input: {
  id: EntityId;
  tenantId: TenantId;
  type: DomainEventType;
  entityType: CRMEntityType;
  entityId: EntityId;
  actorUserId: EntityId;
  occurredAt: ISODate;
  payload: TPayload;
}): DomainEvent<TPayload> {
  return {
    id: input.id,
    tenantId: input.tenantId,
    type: input.type,
    entity: {
      type: input.entityType,
      id: input.entityId
    },
    actorUserId: input.actorUserId,
    occurredAt: input.occurredAt,
    payload: input.payload
  };
}
