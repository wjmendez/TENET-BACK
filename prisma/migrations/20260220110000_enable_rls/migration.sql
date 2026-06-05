-- Enable RLS and policies for tenant-isolated tables

-- Tenant
ALTER TABLE "public"."Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Tenant"
  FOR ALL
  USING ("id" = current_setting('app.tenant_id', true))
  WITH CHECK ("id" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_auth_insert" ON "public"."Tenant"
  FOR INSERT
  WITH CHECK (current_setting('app.auth_access', true) = 'true');

-- TenantBranding
ALTER TABLE "public"."TenantBranding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TenantBranding" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."TenantBranding"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_branding_auth_insert" ON "public"."TenantBranding"
  FOR INSERT
  WITH CHECK (current_setting('app.auth_access', true) = 'true');

-- Membership
ALTER TABLE "public"."Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Membership"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "membership_auth_read" ON "public"."Membership"
  FOR SELECT
  USING (current_setting('app.auth_access', true) = 'true');
CREATE POLICY "membership_auth_insert" ON "public"."Membership"
  FOR INSERT
  WITH CHECK (current_setting('app.auth_access', true) = 'true');

-- ApiKey
ALTER TABLE "public"."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ApiKey" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."ApiKey"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "api_key_auth_read" ON "public"."ApiKey"
  FOR SELECT
  USING (current_setting('app.auth_access', true) = 'true');

-- TenantPlan
ALTER TABLE "public"."TenantPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."TenantPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."TenantPlan"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "tenant_plan_auth_insert" ON "public"."TenantPlan"
  FOR INSERT
  WITH CHECK (current_setting('app.auth_access', true) = 'true');

-- QuotaUsage
ALTER TABLE "public"."QuotaUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."QuotaUsage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."QuotaUsage"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Vertical
ALTER TABLE "public"."Vertical" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Vertical" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Vertical"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- CredentialType
ALTER TABLE "public"."CredentialType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CredentialType" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."CredentialType"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- CredentialBundle
ALTER TABLE "public"."CredentialBundle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CredentialBundle" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."CredentialBundle"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- CredentialUpdate
ALTER TABLE "public"."CredentialUpdate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CredentialUpdate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."CredentialUpdate"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Issuer
ALTER TABLE "public"."Issuer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Issuer" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Issuer"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "issuer_public_read" ON "public"."Issuer"
  FOR SELECT
  USING (current_setting('app.public_access', true) = 'true');

-- Template
ALTER TABLE "public"."Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Template" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Template"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Certificate
ALTER TABLE "public"."Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Certificate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Certificate"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Anchor
ALTER TABLE "public"."Anchor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Anchor" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Anchor"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Revocation
ALTER TABLE "public"."Revocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Revocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."Revocation"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "revocation_public_read" ON "public"."Revocation"
  FOR SELECT
  USING (current_setting('app.public_access', true) = 'true');

-- NFT
ALTER TABLE "public"."NFT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NFT" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "public"."NFT"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
