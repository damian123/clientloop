-- Genericize conference company fit flags and buyer categories for a
-- public B2B SaaS sales workflow (no domain-specific playbook fields).

ALTER TABLE "conference_companies" RENAME COLUMN "rwa_relevance" TO "product_fit";
ALTER TABLE "conference_companies" RENAME COLUMN "private_markets_relevance" TO "expansion_fit";
ALTER TABLE "conference_companies" RENAME COLUMN "fundraising_relevance" TO "budget_fit";

ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'founder_operator' TO 'executive';
ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'asset_owner' TO 'economic_buyer';
ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'private_markets' TO 'operator';
ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'fintech_digital_assets' TO 'technical_evaluator';
ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'investor_allocator' TO 'champion';
ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'strategic_partner' TO 'partner';
ALTER TYPE "ConferenceIcpCategory" RENAME VALUE 'lower_priority' TO 'other';
