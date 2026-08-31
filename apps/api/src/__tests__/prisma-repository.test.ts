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

  it("persists strict OIDC issuer and subject bindings across repository instances", async () => {
    const prisma = new PrismaClient();
    const firstRepository = new PrismaCRMRepository(new PrismaClient());
    const secondRepository = new PrismaCRMRepository(new PrismaClient());
    const suffix = randomUUID().slice(0, 8);
    const tenantId = randomUUID();
    const userId = randomUUID();
    const email = `oidc-${suffix}@example.test`;
    const issuer = `https://identity-${suffix}.example`;
    const subject = `subject-${suffix}`;

    try {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: `OIDC test tenant ${suffix}`
        }
      });
      await prisma.user.create({
        data: {
          id: userId,
          tenantId,
          email,
          displayName: "OIDC Test User",
          status: "active"
        }
      });

      await expect(
        firstRepository.getPrincipalByOidcIdentity({
          tenantId,
          issuer,
          subject,
          email,
          allowEmailLinking: false
        })
      ).rejects.toThrow("not linked");

      const linkingIdentity = {
        tenantId,
        issuer,
        subject,
        email,
        allowEmailLinking: true
      };
      const [linked, concurrentLinked] = await Promise.all([
        firstRepository.getPrincipalByOidcIdentity(linkingIdentity),
        secondRepository.getPrincipalByOidcIdentity(linkingIdentity)
      ]);
      expect(linked.user.id).toBe(userId);
      expect(concurrentLinked.user.id).toBe(userId);
      expect(
        await prisma.userOidcIdentity.findMany({
          where: { tenantId, issuer, subject },
          select: { userId: true }
        })
      ).toEqual([{ userId }]);

      const persisted = await secondRepository.getPrincipalByOidcIdentity({
        tenantId,
        issuer,
        subject,
        email: "changed-email@example.test",
        allowEmailLinking: false
      });
      expect(persisted.user.id).toBe(userId);

      await expect(
        secondRepository.getPrincipalByOidcIdentity({
          tenantId,
          issuer,
          subject: "replacement-subject",
          email,
          allowEmailLinking: true
        })
      ).rejects.toThrow("not linked");
      await expect(
        secondRepository.getPrincipalByOidcIdentity({
          tenantId,
          issuer: "https://different-identity.example",
          subject,
          email,
          allowEmailLinking: false
        })
      ).rejects.toThrow("not linked");
    } finally {
      try {
        await prisma.tenant.deleteMany({ where: { id: tenantId } });
      } finally {
        await Promise.all([
          firstRepository.disconnect(),
          secondRepository.disconnect(),
          prisma.$disconnect()
        ]);
      }
    }
  });

  it("rechecks concurrent OIDC email-link candidate changes before binding", async () => {
    const prisma = new PrismaClient();
    const blocker = new PrismaClient();
    const repository = new PrismaCRMRepository(new PrismaClient());
    const suffix = randomUUID().slice(0, 8);
    const tenantId = randomUUID();
    const emailUserId = randomUUID();
    const statusUserId = randomUUID();
    const issuer = `https://concurrent-identity-${suffix}.example`;
    const emailUserEmail = `email-race-${suffix}@example.test`;
    const statusUserEmail = `status-race-${suffix}@example.test`;

    try {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: `OIDC concurrency tenant ${suffix}`,
          users: {
            create: [
              {
                id: emailUserId,
                email: emailUserEmail,
                displayName: "OIDC Email Race User",
                status: "active"
              },
              {
                id: statusUserId,
                email: statusUserEmail,
                displayName: "OIDC Status Race User",
                status: "active"
              }
            ]
          }
        }
      });

      await expectConcurrentCandidateChangeToPreventBinding({
        prisma,
        blocker,
        repository,
        tenantId,
        userId: emailUserId,
        email: emailUserEmail,
        issuer,
        subject: `email-subject-${suffix}`,
        update: { email: `changed-${emailUserEmail}` }
      });
      await expectConcurrentCandidateChangeToPreventBinding({
        prisma,
        blocker,
        repository,
        tenantId,
        userId: statusUserId,
        email: statusUserEmail,
        issuer,
        subject: `status-subject-${suffix}`,
        update: { status: "suspended" }
      });
    } finally {
      try {
        await prisma.tenant.deleteMany({ where: { id: tenantId } });
      } finally {
        await Promise.all([
          repository.disconnect(),
          blocker.$disconnect(),
          prisma.$disconnect()
        ]);
      }
    }
  });
});

async function expectConcurrentCandidateChangeToPreventBinding(input: {
  prisma: PrismaClient;
  blocker: PrismaClient;
  repository: PrismaCRMRepository;
  tenantId: string;
  userId: string;
  email: string;
  issuer: string;
  subject: string;
  update: { email?: string; status?: "suspended" };
}): Promise<void> {
  const lockAcquired = deferred<void>();
  const releaseLock = deferred<void>();
  let bindingResult: Promise<
    | { ok: true; userId: string }
    | { ok: false; error: unknown }
  > | undefined;

  const updatePromise = input.blocker.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "users"
      WHERE "tenant_id" = ${input.tenantId}::uuid
        AND "id" = ${input.userId}::uuid
      FOR UPDATE
    `;
    lockAcquired.resolve();
    await releaseLock.promise;
    await transaction.user.update({
      where: { id: input.userId },
      data: input.update
    });
  });
  void updatePromise.catch(lockAcquired.reject);

  try {
    await lockAcquired.promise;
    bindingResult = input.repository
      .getPrincipalByOidcIdentity({
        tenantId: input.tenantId,
        issuer: input.issuer,
        subject: input.subject,
        email: input.email,
        allowEmailLinking: true
      })
      .then(
        (principal) => ({ ok: true as const, userId: principal.user.id }),
        (error: unknown) => ({ ok: false as const, error })
      );

    await waitForOidcCandidateLock(input.prisma);
    releaseLock.resolve();
    await updatePromise;

    const result = await bindingResult;
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error(`OIDC identity unexpectedly bound to user ${result.userId}`);
    }
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toContain("Authenticated user was not found");
    expect(
      await input.prisma.userOidcIdentity.findUnique({
        where: {
          tenantId_issuer_subject: {
            tenantId: input.tenantId,
            issuer: input.issuer,
            subject: input.subject
          }
        }
      })
    ).toBeNull();
  } finally {
    releaseLock.resolve();
    await Promise.allSettled([
      updatePromise,
      ...(bindingResult ? [bindingResult] : [])
    ]);
  }
}

async function waitForOidcCandidateLock(prisma: PrismaClient): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [activity] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND query LIKE '%oidc_email_link_candidate_lock%'
          AND wait_event_type = 'Lock'
      ) AS "waiting"
    `;
    if (activity?.waiting) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("Timed out waiting for the OIDC candidate row lock");
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
