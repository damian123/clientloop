ALTER TABLE "webhook_subscriptions"
ADD COLUMN "secret_encrypted" TEXT NOT NULL DEFAULT '';
