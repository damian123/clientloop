import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const normalizedSignature = signature.replace(/^sha256=/, "");
  const expected = signWebhookPayload(payload, secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(normalizedSignature, "hex");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}
