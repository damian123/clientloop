import { InMemoryCRMRepository } from "./adapters/in-memory-repository";
import { PrismaCRMRepository } from "./adapters/prisma-repository";
import type { CRMRepository } from "./repository";

export type RepositoryDriver = "memory" | "prisma";

export function resolveRepositoryDriver(): RepositoryDriver {
  const configured = process.env.CRM_REPOSITORY?.trim().toLowerCase();

  if (configured === "memory" || configured === "prisma") {
    return configured;
  }

  return process.env.DATABASE_URL ? "prisma" : "memory";
}

export function createRepositoryFromEnv(): CRMRepository {
  return resolveRepositoryDriver() === "prisma"
    ? new PrismaCRMRepository()
    : new InMemoryCRMRepository();
}
