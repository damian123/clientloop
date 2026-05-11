import { createHmac, timingSafeEqual } from "node:crypto";
import { buildServer } from "./server";

export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = signWebhookPayload(payload, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

const app = await buildServer();

app.post("/v1/inbound-webhooks/:provider", async (request, reply) => {
  const secret = process.env.WEBHOOK_SIGNING_SECRET ?? "replace-me";
  const signature = request.headers["x-clientloop-signature"];
  const payload = JSON.stringify(request.body ?? {});

  if (
    typeof signature !== "string" ||
    !verifyWebhookSignature(payload, signature, secret)
  ) {
    return reply.code(401).send({ error: "Invalid webhook signature" });
  }

  return reply.code(202).send({ accepted: true });
});

await app.listen({
  port: Number(process.env.WEBHOOK_PORT ?? 4001),
  host: process.env.API_HOST ?? "0.0.0.0"
});
