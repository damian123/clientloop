import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { AuthorizationError, DomainRuleError } from "@clientloop/domain";
import { InMemoryCRMRepository } from "./adapters/in-memory-repository";
import { registerCrmRoutes } from "./modules/crm-routes";
import type { CRMRepository } from "./repository";

export interface BuildServerOptions {
  repository?: CRMRepository;
}

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: true
  });
  const repository = options.repository ?? new InMemoryCRMRepository();

  await app.register(cors, {
    origin: true,
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

    app.log.error(normalizedError);
    return reply.code(500).send({
      error: "Internal server error"
    });
  });

  await registerCrmRoutes(app, repository);

  return app;
}
