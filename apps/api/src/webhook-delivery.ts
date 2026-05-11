import type { OutboxEvent } from "@clientloop/domain";
import type { CRMRepository, WebhookDeliveryTarget } from "./repository";
import { signWebhookPayload } from "./webhook-signing";

export interface WebhookPostRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
  event: OutboxEvent;
  subscription: WebhookDeliveryTarget;
}

export interface WebhookPostResponse {
  ok: boolean;
  status: number;
  body?: string;
}

export interface WebhookDeliveryOptions {
  limit?: number;
  now?: Date;
  post?: (request: WebhookPostRequest) => Promise<WebhookPostResponse>;
  logger?: Pick<Console, "error" | "log">;
}

export interface WebhookDeliveryResult {
  scanned: number;
  delivered: number;
  skipped: number;
  failed: number;
}

const defaultLimit = 25;

export async function deliverPendingWebhooks(
  repository: CRMRepository,
  options: WebhookDeliveryOptions = {}
): Promise<WebhookDeliveryResult> {
  const events = await repository.pendingOutbox(options.limit ?? defaultLimit);
  const result: WebhookDeliveryResult = {
    scanned: events.length,
    delivered: 0,
    skipped: 0,
    failed: 0
  };

  for (const event of events) {
    const subscriptions = await repository.activeWebhookSubscriptions(event.tenantId, event.type);

    if (subscriptions.length === 0) {
      await repository.markOutboxDelivered(event.id);
      result.skipped += 1;
      continue;
    }

    const payload = JSON.stringify(toWebhookPayload(event));
    const failures: string[] = [];

    for (const subscription of subscriptions) {
      try {
        const response = await (options.post ?? postWebhook)({
          url: subscription.url,
          body: payload,
          headers: {
            "Content-Type": "application/json",
            "X-ClientLoop-Event-Id": event.id,
            "X-ClientLoop-Event-Type": event.type,
            "X-ClientLoop-Signature": signWebhookPayload(payload, subscription.signingSecret)
          },
          event,
          subscription
        });

        if (!response.ok) {
          failures.push(
            `${subscription.id} returned ${response.status}${response.body ? `: ${response.body}` : ""}`
          );
        }
      } catch (error) {
        failures.push(`${subscription.id} failed: ${errorMessage(error)}`);
      }
    }

    if (failures.length === 0) {
      await repository.markOutboxDelivered(event.id);
      result.delivered += 1;
      options.logger?.log(`delivered outbox event ${event.id} ${event.type}`);
      continue;
    }

    await repository.markOutboxFailed(
      event.id,
      failures.join("; "),
      nextAttemptAt(event, options.now ?? new Date()).toISOString()
    );
    result.failed += 1;
    options.logger?.error(`failed outbox event ${event.id} ${event.type}: ${failures.join("; ")}`);
  }

  return result;
}

async function postWebhook(request: WebhookPostRequest): Promise<WebhookPostResponse> {
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text().catch(() => "")
  };
}

function toWebhookPayload(event: OutboxEvent) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    type: event.type,
    entity: event.entity,
    actorUserId: event.actorUserId,
    occurredAt: event.occurredAt,
    payload: event.payload
  };
}

function nextAttemptAt(event: OutboxEvent, now: Date): Date {
  const attempt = event.attempts + 1;
  const delayMs = Math.min(60 * 60 * 1_000, 2 ** Math.min(attempt, 8) * 1_000);
  return new Date(now.getTime() + delayMs);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
