import { describe, expect, it } from "vitest";
import { InMemoryCRMRepository } from "../adapters/in-memory-repository";
import { corsAllowedOriginsFromEnv } from "../cors";
import { buildServer } from "../server";

describe("credentialed CORS", () => {
  it("allows credentials only for an explicitly configured origin", async () => {
    const app = await buildServer({
      repository: new InMemoryCRMRepository(),
      oidcProvider: null,
      corsAllowedOrigins: ["https://crm.example"]
    });

    const allowed = await preflight(app, "https://crm.example");
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://crm.example");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await preflight(app, "https://attacker.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();

    await app.close();
  });

  it("uses local-only development defaults and denies all cross-origin production requests", () => {
    expect(corsAllowedOriginsFromEnv({ NODE_ENV: "test" })).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]);
    expect(corsAllowedOriginsFromEnv({ NODE_ENV: "production" })).toEqual([]);
    expect(
      corsAllowedOriginsFromEnv({
        NODE_ENV: "production",
        CORS_ALLOWED_ORIGINS: "https://CRM.example/, https://crm.example"
      })
    ).toEqual(["https://crm.example"]);
    expect(
      corsAllowedOriginsFromEnv({
        NODE_ENV: "development",
        CORS_ALLOWED_ORIGINS: ""
      })
    ).toEqual([]);
  });

  it("rejects wildcard and URL-shaped entries that are not origins", () => {
    expect(() =>
      corsAllowedOriginsFromEnv({ CORS_ALLOWED_ORIGINS: "*" })
    ).toThrow("invalid origin");
    expect(() =>
      corsAllowedOriginsFromEnv({ CORS_ALLOWED_ORIGINS: "https://crm.example/path" })
    ).toThrow("without paths");
  });
});

function preflight(
  app: Awaited<ReturnType<typeof buildServer>>,
  origin: string
) {
  return app.inject({
    method: "OPTIONS",
    url: "/v1/session",
    headers: {
      origin,
      "access-control-request-method": "GET"
    }
  });
}
