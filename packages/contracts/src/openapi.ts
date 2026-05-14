export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "ClientLoop CRM API",
    version: "0.1.0"
  },
  paths: {
    "/health": {
      get: {
        summary: "Service health",
        responses: {
          "200": { description: "Healthy" }
        }
      }
    },
    "/v1/dashboard": {
      get: {
        summary: "Fetch CRM dashboard aggregate"
      }
    },
    "/v1/session": {
      get: {
        summary: "Read the authenticated CRM session"
      }
    },
    "/v1/session/dev-login": {
      post: {
        summary: "Create a local development session cookie",
        responses: {
          "201": { description: "Session created" },
          "404": { description: "Disabled outside local development" }
        }
      }
    },
    "/v1/session/logout": {
      post: {
        summary: "Clear the current session cookie",
        responses: {
          "204": { description: "Session cleared" },
          "403": { description: "CSRF token is missing or invalid" }
        }
      }
    },
    "/v1/accounts": {
      get: { summary: "List accounts" },
      post: { summary: "Create account" }
    },
    "/v1/contacts": {
      get: { summary: "List contacts" },
      post: { summary: "Create contact" }
    },
    "/v1/leads": {
      get: { summary: "List leads" },
      post: { summary: "Create lead" }
    },
    "/v1/leads/{id}/convert": {
      post: {
        summary: "Convert a lead into account, contact, and optional opportunity",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Converted" },
          "409": { description: "Version conflict or invalid lead state" }
        }
      }
    },
    "/v1/opportunities": {
      get: { summary: "List opportunities" },
      post: { summary: "Create opportunity" }
    },
    "/v1/opportunities/{id}": {
      patch: {
        summary: "Update opportunity with optimistic concurrency",
        parameters: [
          {
            name: "If-Match",
            in: "header",
            schema: { type: "string" }
          },
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Updated" },
          "409": { description: "Version conflict" }
        }
      }
    },
    "/v1/tasks": {
      get: { summary: "List tasks" },
      post: { summary: "Create task" }
    },
    "/v1/tasks/{id}/complete": {
      post: {
        summary: "Complete task with optimistic concurrency",
        responses: {
          "200": { description: "Completed" },
          "409": { description: "Version conflict" }
        }
      }
    },
    "/v1/tasks/{id}": {
      patch: {
        summary: "Update task with optimistic concurrency",
        responses: {
          "200": { description: "Updated" },
          "409": { description: "Version conflict" }
        }
      }
    },
    "/v1/notes": {
      post: { summary: "Append note" }
    },
    "/v1/notes/{id}": {
      patch: {
        summary: "Update note with optimistic concurrency",
        responses: {
          "200": { description: "Updated" },
          "409": { description: "Version conflict" }
        }
      }
    },
    "/v1/activities": {
      get: { summary: "List activities" },
      post: { summary: "Log activity" }
    },
    "/v1/activities/{id}": {
      patch: {
        summary: "Update activity with optimistic concurrency",
        responses: {
          "200": { description: "Updated" },
          "409": { description: "Version conflict" }
        }
      }
    },
    "/v1/custom-fields": {
      get: { summary: "List custom field definitions" },
      post: {
        summary: "Create custom field definition",
        responses: {
          "201": { description: "Created" },
          "409": { description: "Custom field key already exists" }
        }
      }
    },
    "/v1/custom-field-values/{entityType}/{id}": {
      patch: {
        summary: "Update custom field values for a CRM record",
        parameters: [
          {
            name: "entityType",
            in: "path",
            schema: {
              type: "string",
              enum: ["account", "contact", "lead", "opportunity"]
            }
          },
          {
            name: "id",
            in: "path",
            schema: { type: "string" }
          },
          {
            name: "If-Match",
            in: "header",
            schema: { type: "string" }
          },
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Updated" },
          "400": { description: "Invalid custom field value" },
          "409": { description: "Version conflict" }
        }
      }
    },
    "/v1/webhooks/subscriptions": {
      get: { summary: "List outbound webhook subscriptions" },
      post: {
        summary: "Create outbound webhook subscription",
        responses: {
          "201": {
            description: "Created; response includes the signing secret once"
          }
        }
      }
    },
    "/v1/exports/{entity}": {
      get: {
        summary: "Export CRM records as CSV",
        parameters: [
          {
            name: "entity",
            in: "path",
            schema: {
              type: "string",
              enum: ["accounts", "contacts", "opportunities"]
            }
          }
        ],
        responses: {
          "200": { description: "CSV export" },
          "403": { description: "Export is not permitted" }
        }
      }
    },
    "/v1/imports/accounts/preview": {
      post: { summary: "Preview account CSV import" }
    },
    "/v1/imports/accounts": {
      post: {
        summary: "Import accounts from CSV",
        responses: {
          "201": { description: "Imported" },
          "400": { description: "CSV validation failed" }
        }
      }
    },
    "/v1/imports/contacts/preview": {
      post: { summary: "Preview contact CSV import" }
    },
    "/v1/imports/contacts": {
      post: {
        summary: "Import contacts from CSV",
        responses: {
          "201": { description: "Imported" },
          "400": { description: "CSV validation failed" }
        }
      }
    },
    "/v1/imports/opportunities/preview": {
      post: { summary: "Preview opportunity CSV import" }
    },
    "/v1/imports/opportunities": {
      post: {
        summary: "Import opportunities from CSV",
        responses: {
          "201": { description: "Imported" },
          "400": { description: "CSV validation failed" }
        }
      }
    },
    "/v1/search": {
      get: { summary: "Search CRM records" }
    }
  }
} as const;
