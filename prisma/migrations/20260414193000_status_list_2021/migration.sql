-- Add StatusList model and certificate status list fields
CREATE TABLE "public"."StatusList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "statusPurpose" TEXT NOT NULL,
    "encodedList" TEXT NOT NULL,
    "listSize" INTEGER NOT NULL DEFAULT 100000,
    "nextIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusList_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Certificate" ADD COLUMN "statusListId" TEXT;
ALTER TABLE "public"."Certificate" ADD COLUMN "statusListIndex" INTEGER;
ALTER TABLE "public"."Certificate" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "public"."Certificate" ADD COLUMN "revocationReason" TEXT;

CREATE INDEX "StatusList_tenantId_idx" ON "public"."StatusList"("tenantId");
CREATE INDEX "StatusList_issuerId_idx" ON "public"."StatusList"("issuerId");
CREATE INDEX "StatusList_statusPurpose_idx" ON "public"."StatusList"("statusPurpose");

CREATE INDEX "Certificate_statusListId_idx" ON "public"."Certificate"("statusListId");
CREATE INDEX "Certificate_statusListIndex_idx" ON "public"."Certificate"("statusListIndex");

ALTER TABLE "public"."StatusList" ADD CONSTRAINT "StatusList_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."StatusList" ADD CONSTRAINT "StatusList_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "public"."Issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_statusListId_fkey" FOREIGN KEY ("statusListId") REFERENCES "public"."StatusList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS and policies
ALTER TABLE "public"."StatusList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StatusList" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."StatusList"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "status_list_public_read" ON "public"."StatusList"
  FOR SELECT
  USING (current_setting('app.public_access', true) = 'true');
