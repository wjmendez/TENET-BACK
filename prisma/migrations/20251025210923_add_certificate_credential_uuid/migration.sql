-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN "credentialUuid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_credentialUuid_key" ON "Certificate"("credentialUuid");

-- Backfill existing records so credentials can be fetched by their Blockcert UUID
UPDATE "Certificate" SET "credentialUuid" = regexp_replace((data->>'id'), '^urn:uuid:', '', 'i')
WHERE "credentialUuid" IS NULL AND data ? 'id';
