-- DropForeignKey
ALTER TABLE "public"."Anchor" DROP CONSTRAINT "Anchor_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Certificate" DROP CONSTRAINT "Certificate_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CredentialBundle" DROP CONSTRAINT "CredentialBundle_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CredentialType" DROP CONSTRAINT "CredentialType_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CredentialUpdate" DROP CONSTRAINT "CredentialUpdate_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Issuer" DROP CONSTRAINT "Issuer_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NFT" DROP CONSTRAINT "NFT_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Revocation" DROP CONSTRAINT "Revocation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Template" DROP CONSTRAINT "Template_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Vertical" DROP CONSTRAINT "Vertical_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Vertical" ADD CONSTRAINT "Vertical_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialType" ADD CONSTRAINT "CredentialType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialBundle" ADD CONSTRAINT "CredentialBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialUpdate" ADD CONSTRAINT "CredentialUpdate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issuer" ADD CONSTRAINT "Issuer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Anchor" ADD CONSTRAINT "Anchor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revocation" ADD CONSTRAINT "Revocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NFT" ADD CONSTRAINT "NFT_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
