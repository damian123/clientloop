-- Bind an application user to an immutable OpenID Connect issuer/subject pair.
CREATE UNIQUE INDEX "users_tenant_id_id_key" ON "users"("tenant_id", "id");

CREATE TABLE "user_oidc_identities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_oidc_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_oidc_identities_tenant_id_issuer_subject_key"
ON "user_oidc_identities"("tenant_id", "issuer", "subject");

CREATE UNIQUE INDEX "user_oidc_identities_tenant_id_user_id_issuer_key"
ON "user_oidc_identities"("tenant_id", "user_id", "issuer");

CREATE INDEX "user_oidc_identities_user_id_idx" ON "user_oidc_identities"("user_id");

ALTER TABLE "user_oidc_identities"
ADD CONSTRAINT "user_oidc_identities_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_oidc_identities"
ADD CONSTRAINT "user_oidc_identities_tenant_id_user_id_fkey"
FOREIGN KEY ("tenant_id", "user_id") REFERENCES "users"("tenant_id", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
