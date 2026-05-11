import { createRepositoryFromEnv } from "./repository-factory";
import { deliverPendingWebhooks } from "./webhook-delivery";

const repository = createRepositoryFromEnv();

async function runOnce() {
  return deliverPendingWebhooks(repository, {
    limit: Number(process.env.WEBHOOK_DELIVERY_BATCH_SIZE ?? 25),
    logger: console
  });
}

try {
  const result = await runOnce();
  console.log(
    `worker completed; scanned=${result.scanned} delivered=${result.delivered} skipped=${result.skipped} failed=${result.failed}`
  );
} finally {
  const maybeDisconnect = repository as typeof repository & {
    disconnect?: () => Promise<void>;
  };
  await maybeDisconnect.disconnect?.();
}
