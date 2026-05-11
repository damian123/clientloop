import type { FastifyRequest } from "fastify";
import type { AccessPrincipal } from "@clientloop/domain";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import type { CRMRepository } from "./repository";

function headerValue(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

export async function principalFromRequest(
  request: FastifyRequest,
  repository: CRMRepository
): Promise<AccessPrincipal> {
  const tenantId = headerValue(request.headers["x-tenant-id"], seedTenantId);
  const userId = headerValue(request.headers["x-user-id"], seedUserId);

  return repository.getPrincipal(tenantId, userId);
}
