import { describe, expect, it } from "vitest";
import { seedManagerId, seedTenantId, seedUserId } from "@clientloop/domain";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";
import { deliverPendingWebhooks } from "../webhook-delivery";
import { verifyWebhookSignature } from "../webhook-signing";

describe("webhook delivery", () => {
  it("posts signed outbox events to matching active subscriptions", async () => {
    const repository = new InMemoryCRMRepository();
    const principal = await repository.getPrincipal(seedTenantId, seedManagerId);
    const received: Array<{ body: string; headers: Record<string, string> }> = [];

    await repository.createWebhookSubscription(principal, {
      url: "https://example.com/clientloop-webhook",
      eventTypes: ["account.created"],
      signingSecret: "test-secret-with-enough-length"
    });
    await repository.createAccount(principal, {
      name: "Signed Delivery Account",
      status: "prospect",
      customFields: {}
    });

    const result = await deliverPendingWebhooks(repository, {
      post: async (request) => {
        received.push({ body: request.body, headers: request.headers });
        return { ok: true, status: 202, body: "accepted" };
      }
    });

    expect(result).toEqual({
      scanned: 1,
      delivered: 1,
      skipped: 0,
      failed: 0
    });
    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0]!.body).type).toBe("account.created");
    expect(received[0]!.headers["X-ClientLoop-Event-Type"]).toBe("account.created");
    expect(
      verifyWebhookSignature(
        received[0]!.body,
        received[0]!.headers["X-ClientLoop-Signature"]!,
        "test-secret-with-enough-length"
      )
    ).toBe(true);
    expect(await repository.pendingOutbox(10)).toHaveLength(0);
  });

  it("backs off failed deliveries", async () => {
    const repository = new InMemoryCRMRepository();
    const principal = await repository.getPrincipal(seedTenantId, seedManagerId);

    await repository.createWebhookSubscription(principal, {
      url: "https://example.com/clientloop-webhook",
      eventTypes: ["account.created"],
      signingSecret: "test-secret-with-enough-length"
    });
    await repository.createAccount(principal, {
      name: "Failed Delivery Account",
      status: "prospect",
      customFields: {}
    });

    const result = await deliverPendingWebhooks(repository, {
      now: new Date(),
      post: async () => ({ ok: false, status: 503, body: "try later" })
    });

    expect(result.failed).toBe(1);
    expect(await repository.pendingOutbox(10)).toHaveLength(0);
  });

  it("does not allow reps to create webhook subscriptions", async () => {
    const repository = new InMemoryCRMRepository();
    const principal = await repository.getPrincipal(seedTenantId, seedUserId);

    await expect(
      repository.createWebhookSubscription(principal, {
        url: "https://example.com/clientloop-webhook",
        eventTypes: ["*"],
        signingSecret: "test-secret-with-enough-length"
      })
    ).rejects.toThrow("Not allowed");
  });
});
