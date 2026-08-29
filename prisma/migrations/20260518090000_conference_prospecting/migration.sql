-- CreateEnum
CREATE TYPE "AttendeeAccessStatus" AS ENUM ('unknown', 'unavailable', 'registered_only', 'sponsor_directory', 'opt_in_directory', 'lead_retrieval', 'post_event_opt_in');

-- CreateEnum
CREATE TYPE "ConferenceRole" AS ENUM ('speaker', 'moderator', 'sponsor', 'exhibitor', 'startup_showcase', 'award_finalist', 'side_event_host', 'attendee', 'organizer', 'partner', 'other');

-- CreateEnum
CREATE TYPE "ConferenceSourceType" AS ENUM ('official_directory', 'sponsor_access', 'speaker_agenda', 'sponsor_exhibitor_list', 'startup_showcase', 'linkedin_public', 'side_event_rsvp', 'warm_network', 'press_release', 'manual_research');

-- CreateEnum
CREATE TYPE "ConferenceIcpCategory" AS ENUM ('founder_operator', 'asset_owner', 'private_markets', 'fintech_digital_assets', 'investor_allocator', 'strategic_partner', 'lower_priority', 'unknown');

-- CreateEnum
CREATE TYPE "ConferenceOutreachStatus" AS ENUM ('not_started', 'queued', 'contacted', 'replied', 'meeting_requested', 'meeting_booked', 'nurturing', 'disqualified');

-- CreateEnum
CREATE TYPE "ConferenceOptOutStatus" AS ENUM ('unknown', 'not_opted_out', 'opted_out');

-- CreateEnum
CREATE TYPE "ConferencePriorityBand" AS ENUM ('request_meeting', 'personalized_outreach', 'nurture', 'do_not_prioritize');

-- CreateEnum
CREATE TYPE "ConferenceMeetingStatus" AS ENUM ('not_requested', 'requested', 'booked', 'declined', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "conferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "location" TEXT,
    "website" TEXT,
    "audience_type" TEXT,
    "organizer_contact" TEXT,
    "sponsor_package_link" TEXT,
    "app_name" TEXT,
    "attendee_access_status" "AttendeeAccessStatus" NOT NULL DEFAULT 'unknown',
    "source_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "conferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conference_id" UUID NOT NULL,
    "account_id" UUID,
    "company" TEXT NOT NULL,
    "website" TEXT,
    "conference_role" "ConferenceRole" NOT NULL DEFAULT 'other',
    "sector" TEXT,
    "rwa_relevance" BOOLEAN NOT NULL DEFAULT false,
    "private_markets_relevance" BOOLEAN NOT NULL DEFAULT false,
    "fundraising_relevance" BOOLEAN NOT NULL DEFAULT false,
    "market_entry_relevance" BOOLEAN NOT NULL DEFAULT false,
    "partnership_relevance" BOOLEAN NOT NULL DEFAULT false,
    "company_score" INTEGER NOT NULL DEFAULT 0,
    "source_url" TEXT,
    "source_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "conference_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_people" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conference_id" UUID NOT NULL,
    "conference_company_id" UUID,
    "account_id" UUID,
    "contact_id" UUID,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "linkedin" TEXT,
    "email" TEXT,
    "conference_signal" TEXT,
    "icp_category" "ConferenceIcpCategory" NOT NULL DEFAULT 'unknown',
    "buying_signal" TEXT,
    "relationship_path" TEXT,
    "outreach_status" "ConferenceOutreachStatus" NOT NULL DEFAULT 'not_started',
    "source_type" "ConferenceSourceType" NOT NULL DEFAULT 'manual_research',
    "source" TEXT,
    "lawful_basis_notes" TEXT,
    "opt_out_status" "ConferenceOptOutStatus" NOT NULL DEFAULT 'unknown',
    "seniority_score" INTEGER NOT NULL DEFAULT 0,
    "company_fit_score" INTEGER NOT NULL DEFAULT 0,
    "signal_score" INTEGER NOT NULL DEFAULT 0,
    "conference_signal_score" INTEGER NOT NULL DEFAULT 0,
    "warm_intro_score" INTEGER NOT NULL DEFAULT 0,
    "timing_score" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "priority_band" "ConferencePriorityBand" NOT NULL DEFAULT 'do_not_prioritize',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "conference_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conference_meetings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conference_id" UUID NOT NULL,
    "conference_person_id" UUID NOT NULL,
    "reason_to_meet" TEXT NOT NULL,
    "proposed_ask" TEXT,
    "intro_path" TEXT,
    "status" "ConferenceMeetingStatus" NOT NULL DEFAULT 'not_requested',
    "notes" TEXT,
    "next_step" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "conference_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conferences_tenant_id_start_date_idx" ON "conferences"("tenant_id", "start_date");

-- CreateIndex
CREATE INDEX "conferences_tenant_id_name_idx" ON "conferences"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "conference_companies_tenant_id_conference_id_company_idx" ON "conference_companies"("tenant_id", "conference_id", "company");

-- CreateIndex
CREATE INDEX "conference_companies_tenant_id_account_id_idx" ON "conference_companies"("tenant_id", "account_id");

-- CreateIndex
CREATE INDEX "conference_people_tenant_id_conference_id_priority_band_total_score_idx" ON "conference_people"("tenant_id", "conference_id", "priority_band", "total_score");

-- CreateIndex
CREATE INDEX "conference_people_tenant_id_conference_company_id_idx" ON "conference_people"("tenant_id", "conference_company_id");

-- CreateIndex
CREATE INDEX "conference_people_tenant_id_account_id_idx" ON "conference_people"("tenant_id", "account_id");

-- CreateIndex
CREATE INDEX "conference_people_tenant_id_contact_id_idx" ON "conference_people"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "conference_meetings_tenant_id_conference_id_status_idx" ON "conference_meetings"("tenant_id", "conference_id", "status");

-- CreateIndex
CREATE INDEX "conference_meetings_tenant_id_conference_person_id_idx" ON "conference_meetings"("tenant_id", "conference_person_id");

-- AddForeignKey
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_companies" ADD CONSTRAINT "conference_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_companies" ADD CONSTRAINT "conference_companies_conference_id_fkey" FOREIGN KEY ("conference_id") REFERENCES "conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_companies" ADD CONSTRAINT "conference_companies_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_people" ADD CONSTRAINT "conference_people_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_people" ADD CONSTRAINT "conference_people_conference_id_fkey" FOREIGN KEY ("conference_id") REFERENCES "conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_people" ADD CONSTRAINT "conference_people_conference_company_id_fkey" FOREIGN KEY ("conference_company_id") REFERENCES "conference_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_people" ADD CONSTRAINT "conference_people_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_people" ADD CONSTRAINT "conference_people_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_meetings" ADD CONSTRAINT "conference_meetings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_meetings" ADD CONSTRAINT "conference_meetings_conference_id_fkey" FOREIGN KEY ("conference_id") REFERENCES "conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conference_meetings" ADD CONSTRAINT "conference_meetings_conference_person_id_fkey" FOREIGN KEY ("conference_person_id") REFERENCES "conference_people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
