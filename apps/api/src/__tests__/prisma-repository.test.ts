import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import { PrismaCRMRepository } from "../adapters/prisma-repository";

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase("PrismaCRMRepository", () => {
  it("persists account and opportunity writes across repository instances", async () => {
    const prisma = new PrismaClient();
    const firstRepository = new PrismaCRMRepository(new PrismaClient());
    const secondRepository = new PrismaCRMRepository(new PrismaClient());
    const suffix = randomUUID().slice(0, 8);
    const accountName = `Persisted Account ${suffix}`;
    const opportunityName = `Persisted Opportunity ${suffix}`;
    let accountId: string | undefined;
    let opportunityId: string | undefined;

    try {
      const principal = await firstRepository.getPrincipal(seedTenantId, seedUserId);
      const account = await firstRepository.createAccount(principal, {
        name: accountName,
        status: "prospect",
        customFields: {}
      });
      accountId = account.id;

      const opportunity = await firstRepository.createOpportunity(principal, {
        accountId: account.id,
        name: opportunityName,
        stage: "qualification",
        amount: 12000,
        currency: "USD",
        ownerUserId: seedUserId,
        probabilityPct: 25,
        customFields: {}
      });
      opportunityId = opportunity.id;

      await firstRepository.updateOpportunity({
        principal,
        id: opportunity.id,
        idempotencyKey: `persist-${suffix}`,
        body: {
          expectedVersion: opportunity.version,
          stage: "proposal"
        }
      });

      const persistedAccounts = await secondRepository.listAccounts(seedTenantId, {
        q: accountName,
        limit: 10
      });
      const persistedOpportunities = await secondRepository.listOpportunities(seedTenantId, {
        q: opportunityName,
        limit: 10
      });

      expect(persistedAccounts.items).toHaveLength(1);
      expect(persistedAccounts.items[0]!.name).toBe(accountName);
      expect(persistedOpportunities.items).toHaveLength(1);
      expect(persistedOpportunities.items[0]!.stage).toBe("proposal");
      expect(persistedOpportunities.items[0]!.version).toBe(2);
    } finally {
      await prisma.idempotencyKey.deleteMany({
        where: { key: `persist-${suffix}` }
      });
      const entityIds = [accountId, opportunityId].filter((id): id is string => Boolean(id));
      if (entityIds.length > 0) {
        await prisma.outboxEvent.deleteMany({
          where: { entityId: { in: entityIds } }
        });
      }
      if (opportunityId) {
        await prisma.opportunity.deleteMany({ where: { id: opportunityId } });
      }
      if (accountId) {
        await prisma.account.deleteMany({ where: { id: accountId } });
      }
      await firstRepository.disconnect();
      await secondRepository.disconnect();
      await prisma.$disconnect();
    }
  });
});
