import type { FastifyInstance } from "fastify";
import { devLoginSchema, type SessionResponse } from "@clientloop/contracts";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import { principalFromRequest } from "../auth";
import type { CRMRepository } from "../repository";
import {
  allowDevLogin,
  clearSessionCookies,
  createSessionToken,
  csrfTokenForSessionToken,
  readSessionToken,
  setSessionCookies
} from "../session";

export async function registerSessionRoutes(app: FastifyInstance, repository: CRMRepository) {
  app.get("/v1/session", async (request) => {
    const principal = await principalFromRequest(request, repository);
    const response: SessionResponse = {
      authenticated: true,
      tenantId: principal.tenantId,
      user: {
        id: principal.user.id,
        email: principal.user.email,
        displayName: principal.user.displayName,
        permissions: principal.roles.flatMap((role) => role.permissions)
      }
    };

    const sessionToken = readSessionToken(request);
    if (sessionToken) {
      response.csrfToken = csrfTokenForSessionToken(sessionToken);
    }

    return response;
  });

  app.post("/v1/session/dev-login", async (request, reply) => {
    if (!allowDevLogin()) {
      return reply.code(404).send({ error: "Dev login is disabled" });
    }

    const input = devLoginSchema.parse(request.body ?? {});
    const tenantId = input.tenantId ?? seedTenantId;
    const userId = input.userId ?? seedUserId;
    const principal = await repository.getPrincipal(tenantId, userId);
    const sessionToken = createSessionToken({
      tenantId: principal.tenantId,
      userId: principal.user.id
    });

    setSessionCookies(reply, sessionToken);
    return reply.code(201).send({
      authenticated: true,
      tenantId: principal.tenantId,
      user: {
        id: principal.user.id,
        email: principal.user.email,
        displayName: principal.user.displayName,
        permissions: principal.roles.flatMap((role) => role.permissions)
      },
      csrfToken: csrfTokenForSessionToken(sessionToken)
    } satisfies SessionResponse);
  });

  app.post("/v1/session/logout", async (_request, reply) => {
    clearSessionCookies(reply);
    return reply.code(204).send();
  });
}
