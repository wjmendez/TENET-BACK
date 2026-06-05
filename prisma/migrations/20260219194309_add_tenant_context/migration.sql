/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,did]` on the table `Issuer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,slug]` on the table `Vertical` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Issuer_did_key";

-- DropIndex
DROP INDEX "public"."Vertical_name_key";

-- DropIndex
DROP INDEX "public"."Vertical_slug_key";

-- AlterTable
ALTER TABLE "public"."Anchor" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."Certificate" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."CredentialBundle" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."CredentialType" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."CredentialUpdate" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."Issuer" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."NFT" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."Revocation" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."Template" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "public"."Vertical" ADD COLUMN     "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "Anchor_tenantId_idx" ON "public"."Anchor"("tenantId");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_idx" ON "public"."Certificate"("tenantId");

-- CreateIndex
CREATE INDEX "CredentialBundle_tenantId_idx" ON "public"."CredentialBundle"("tenantId");

-- CreateIndex
CREATE INDEX "CredentialType_tenantId_idx" ON "public"."CredentialType"("tenantId");

-- CreateIndex
CREATE INDEX "CredentialUpdate_tenantId_idx" ON "public"."CredentialUpdate"("tenantId");

-- CreateIndex
CREATE INDEX "Issuer_tenantId_idx" ON "public"."Issuer"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_tenantId_did_key" ON "public"."Issuer"("tenantId", "did");

-- CreateIndex
CREATE INDEX "NFT_tenantId_idx" ON "public"."NFT"("tenantId");

-- CreateIndex
CREATE INDEX "Revocation_tenantId_idx" ON "public"."Revocation"("tenantId");

-- CreateIndex
CREATE INDEX "Template_tenantId_idx" ON "public"."Template"("tenantId");

-- CreateIndex
CREATE INDEX "Vertical_tenantId_idx" ON "public"."Vertical"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_tenantId_slug_key" ON "public"."Vertical"("tenantId", "slug");

-- AddForeignKey
ALTER TABLE "public"."Vertical" ADD CONSTRAINT "Vertical_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialType" ADD CONSTRAINT "CredentialType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialBundle" ADD CONSTRAINT "CredentialBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialUpdate" ADD CONSTRAINT "CredentialUpdate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issuer" ADD CONSTRAINT "Issuer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Anchor" ADD CONSTRAINT "Anchor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revocation" ADD CONSTRAINT "Revocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NFT" ADD CONSTRAINT "NFT_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
