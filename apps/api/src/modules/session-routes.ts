import type { FastifyInstance } from "fastify";
import { devLoginSchema, type SessionResponse } from "@clientloop/contracts";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import { principalFromRequest } from "../auth";
import {
  appendClearedOidcTransactionCookie,
  callbackUrlFromRequest,
  normalizeReturnTo,
  readOidcTransaction,
  setOidcTransactionCookie,
  type OidcProvider
} from "../oidc";
import type { CRMRepository } from "../repository";
import {
  allowDevLogin,
  clearSessionCookies,
  createSessionToken,
  csrfTokenForSessionToken,
  readSessionToken,
  setSessionCookies
} from "../session";

export async function registerSessionRoutes(
  app: FastifyInstance,
  repository: CRMRepository,
  oidcProvider?: OidcProvider,
  allowOidcEmailLinking = false
) {
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

  app.get("/v1/session/oidc/login", async (request, reply) => {
    if (!oidcProvider) {
      return reply.code(404).send({ error: "OIDC login is not configured" });
    }

    let returnTo: string;
    try {
      returnTo = normalizeReturnTo((request.query as { returnTo?: unknown }).returnTo);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid returnTo"
      });
    }

    const authorization = await oidcProvider.createAuthorizationRequest(returnTo);
    setOidcTransactionCookie(reply, authorization.transaction);
    return reply.redirect(authorization.authorizationUrl.href);
  });

  app.get("/v1/session/oidc/callback", async (request, reply) => {
    if (!oidcProvider) {
      return reply.code(404).send({ error: "OIDC login is not configured" });
    }

    const transaction = readOidcTransaction(request);
    if (!transaction) {
      appendClearedOidcTransactionCookie(reply);
      return reply.code(400).send({ error: "OIDC transaction is missing, invalid, or expired" });
    }

    try {
      const identity = await oidcProvider.exchangeCallback(
        callbackUrlFromRequest(request),
        transaction
      );
      const principal = await repository.getPrincipalByOidcIdentity({
        tenantId: oidcProvider.tenantId,
        issuer: identity.issuer,
        subject: identity.subject,
        email: identity.email,
        allowEmailLinking: allowOidcEmailLinking
      });
      const sessionToken = createSessionToken({
        tenantId: principal.tenantId,
        userId: principal.user.id
      });
      setSessionCookies(reply, sessionToken);
      appendClearedOidcTransactionCookie(reply);
      return reply.redirect(transaction.returnTo);
    } catch (error) {
      request.log.warn(
        { error: error instanceof Error ? error.message : "OIDC callback failed" },
        "OIDC callback rejected"
      );
      appendClearedOidcTransactionCookie(reply);
      return reply.code(401).send({ error: "OIDC authentication failed" });
    }
  });

  app.post("/v1/session/logout", async (_request, reply) => {
    clearSessionCookies(reply);
    return reply.code(204).send();
  });
}
