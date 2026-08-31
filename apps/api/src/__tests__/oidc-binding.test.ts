import { describe, expect, it } from "vitest";
import { createSeedData, seedTenantId, seedUserId } from "@clientloop/domain";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";

const issuer = "https://identity.example";

describe("OIDC identity binding", () => {
  it("refuses ambiguous case-insensitive email matches during migration linking", async () => {
    const seed = createSeedData();
    const user = seed.users.find((candidate) => candidate.id === seedUserId)!;
    seed.users.push({
      ...user,
      id: "00000000-0000-4000-8000-000000000099",
      email: user.email.toUpperCase()
    });
    const repository = new InMemoryCRMRepository(seed);

    await expect(
      repository.getPrincipalByOidcIdentity({
        tenantId: seedTenantId,
        issuer,
        subject: "subject",
        email: user.email,
        allowEmailLinking: true
      })
    ).rejects.toThrow("Authenticated user was not found");
  });

  it("does not authenticate an archived user through an existing binding", async () => {
    const seed = createSeedData();
    const user = seed.users.find((candidate) => candidate.id === seedUserId)!;
    const repository = new InMemoryCRMRepository(seed);
    const identity = {
      tenantId: seedTenantId,
      issuer,
      subject: "subject",
      email: user.email,
      allowEmailLinking: true
    };
    await repository.getPrincipalByOidcIdentity(identity);
    user.archivedAt = new Date().toISOString();

    await expect(
      repository.getPrincipalByOidcIdentity({
        ...identity,
        email: "changed@example.test",
        allowEmailLinking: false
      })
    ).rejects.toThrow("Authenticated user was not found");
  });
});
