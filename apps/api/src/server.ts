import cors from "@fastify/cors";
import Fastify, { type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AuthorizationError, CustomFieldValidationError, DomainRuleError } from "@clientloop/domain";
import { corsAllowedOriginsFromEnv, normalizeCorsAllowedOrigins } from "./cors";
import { registerCrmRoutes } from "./modules/crm-routes";
import { registerGraphqlRoute } from "./graphql";
import { registerSessionRoutes } from "./modules/session-routes";
import {
  oidcEmailLinkingAllowedFromEnv,
  oidcProviderFromEnv,
  type OidcProvider
} from "./oidc";
import { createRepositoryFromEnv } from "./repository-factory";
import type { CRMRepository } from "./repository";
import { isValidCsrfRequest, requiresCsrfProtection } from "./session";

export interface BuildServerOptions {
  repository?: CRMRepository;
  oidcProvider?: OidcProvider | null;
  corsAllowedOrigins?: readonly string[];
  allowOidcEmailLinking?: boolean;
  loggerStream?: { write(message: string): void };
}

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: {
      serializers: {
        req: requestForLog
      },
      ...(options.loggerStream ? { stream: options.loggerStream } : {})
    }
  });
  const repository = options.repository ?? createRepositoryFromEnv();
  const oidcProvider = options.oidcProvider === null
    ? undefined
    : options.oidcProvider ?? oidcProviderFromEnv();
  const corsAllowedOrigins = new Set(
    normalizeCorsAllowedOrigins(
      options.corsAllowedOrigins ?? corsAllowedOriginsFromEnv()
    )
  );

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, Boolean(origin && corsAllowedOrigins.has(origin)));
    },
    credentials: true
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation failed",
        issues: error.issues
      });
    }

    if (error instanceof AuthorizationError) {
      return reply.code(403).send({
        error: error.message
      });
    }

    if (error instanceof CustomFieldValidationError) {
      return reply.code(400).send({
        error: error.message
      });
    }

    const normalizedError = error instanceof Error ? error : new Error("Unknown error");

    if (
      normalizedError instanceof DomainRuleError ||
      normalizedError.message.includes("Version conflict")
    ) {
      return reply.code(409).send({
        error: normalizedError.message
      });
    }

    if (normalizedError.message.includes("not found")) {
      return reply.code(404).send({
        error: normalizedError.message
      });
    }

    if (normalizedError.message.includes("already exists")) {
      return reply.code(409).send({
        error: normalizedError.message
      });
    }

    app.log.error(normalizedError);
    return reply.code(500).send({
      error: "Internal server error"
    });
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!requiresCsrfProtection(request)) {
      return;
    }

    if (!isValidCsrfRequest(request)) {
      return reply.code(403).send({ error: "Invalid CSRF token" });
    }
  });

  await registerSessionRoutes(
    app,
    repository,
    oidcProvider,
    options.allowOidcEmailLinking ?? oidcEmailLinkingAllowedFromEnv()
  );
  await registerGraphqlRoute(app, repository);
  await registerCrmRoutes(app, repository);

  app.addHook("onClose", async () => {
    const maybeDisconnect = repository as CRMRepository & {
      disconnect?: () => Promise<void>;
    };
    await maybeDisconnect.disconnect?.();
  });

  return app;
}

function requestForLog(request: FastifyRequest) {
  const queryStart = request.url.indexOf("?");
  const url = queryStart === -1
    ? request.url
    : `${request.url.slice(0, queryStart)}?[REDACTED]`;

  return {
    method: request.method,
    url,
    host: request.host,
    remoteAddress: request.ip
  };
}
