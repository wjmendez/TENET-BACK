-- Enforce tenantId presence across data-plane tables

-- Ensure default tenant exists for legacy data
INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'default', 'ACTIVE', now(), now())
ON CONFLICT ("slug") DO NOTHING;

WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "Vertical" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "CredentialType" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "CredentialBundle" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "CredentialUpdate" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "Issuer" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "Template" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "Certificate" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "Anchor" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "Revocation" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;
WITH default_tenant AS (
  SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1
)
UPDATE "NFT" SET "tenantId" = (SELECT id FROM default_tenant) WHERE "tenantId" IS NULL;

ALTER TABLE "Vertical" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CredentialType" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CredentialBundle" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CredentialUpdate" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Issuer" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Template" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Certificate" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Anchor" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Revocation" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "NFT" ALTER COLUMN "tenantId" SET NOT NULL;
