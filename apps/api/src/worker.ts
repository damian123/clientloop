import { InMemoryCRMRepository } from "./adapters/in-memory-repository";

const repository = new InMemoryCRMRepository();

async function runOnce() {
  const events = await repository.pendingOutbox(25);

  for (const event of events) {
    console.log(`delivering outbox event ${event.id} ${event.type}`);
    await repository.markOutboxDelivered(event.id);
  }

  return events.length;
}

const delivered = await runOnce();
console.log(`worker completed; delivered=${delivered}`);
