-- CreateEnum
CREATE TYPE "public"."BundleStatus" AS ENUM ('PENDING', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."CertificateStatus" AS ENUM ('PENDING', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RevocationStatus" AS ENUM ('ACTIVE', 'REINSTATED');

-- CreateEnum
CREATE TYPE "public"."AnchorStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."NFTStatus" AS ENUM ('PENDING', 'MINTED', 'TRANSFERRED', 'BURNED');

-- CreateTable
CREATE TABLE "public"."Vertical" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vertical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CredentialType" (
    "id" TEXT NOT NULL,
    "verticalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "schema" JSONB,
    "displayConfig" JSONB,
    "updatePolicy" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CredentialBundle" (
    "id" TEXT NOT NULL,
    "verticalId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "bundleHash" TEXT,
    "anchorId" TEXT,
    "status" "public"."BundleStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CredentialUpdate" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "updateData" JSONB NOT NULL,
    "previousState" JSONB,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Issuer" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "logo" TEXT,
    "publicKeyJwk" JSONB NOT NULL,
    "privateKeyHex" TEXT,
    "blockchainAddress" TEXT,
    "verticalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jsonLd" JSONB,
    "variables" JSONB,
    "issuerId" TEXT,
    "verticalId" TEXT,
    "credentialTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Certificate" (
    "id" TEXT NOT NULL,
    "credentialUuid" TEXT,
    "templateId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "public"."CertificateStatus" NOT NULL DEFAULT 'PENDING',
    "hash" TEXT,
    "anchorId" TEXT,
    "bundleId" TEXT,
    "verticalId" TEXT,
    "issuerDid" TEXT,
    "updatePolicy" JSONB,
    "merkleProof" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Anchor" (
    "id" TEXT NOT NULL,
    "rootHash" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "status" "public"."AnchorStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Revocation" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "public"."RevocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NFT" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "metadataURI" TEXT,
    "ipfsHash" TEXT,
    "txHash" TEXT,
    "status" "public"."NFTStatus" NOT NULL DEFAULT 'PENDING',
    "anchorId" TEXT,
    "hash" TEXT,
    "merkleProof" JSONB,
    "metadataHistory" JSONB,
    "updatePolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NFT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_name_key" ON "public"."Vertical"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vertical_slug_key" ON "public"."Vertical"("slug");

-- CreateIndex
CREATE INDEX "Vertical_slug_idx" ON "public"."Vertical"("slug");

-- CreateIndex
CREATE INDEX "Vertical_isActive_idx" ON "public"."Vertical"("isActive");

-- CreateIndex
CREATE INDEX "CredentialType_verticalId_idx" ON "public"."CredentialType"("verticalId");

-- CreateIndex
CREATE INDEX "CredentialType_type_idx" ON "public"."CredentialType"("type");

-- CreateIndex
CREATE INDEX "CredentialType_isActive_idx" ON "public"."CredentialType"("isActive");

-- CreateIndex
CREATE INDEX "CredentialBundle_verticalId_idx" ON "public"."CredentialBundle"("verticalId");

-- CreateIndex
CREATE INDEX "CredentialBundle_recipientId_idx" ON "public"."CredentialBundle"("recipientId");

-- CreateIndex
CREATE INDEX "CredentialBundle_status_idx" ON "public"."CredentialBundle"("status");

-- CreateIndex
CREATE INDEX "CredentialUpdate_credentialId_idx" ON "public"."CredentialUpdate"("credentialId");

-- CreateIndex
CREATE INDEX "CredentialUpdate_updateType_idx" ON "public"."CredentialUpdate"("updateType");

-- CreateIndex
CREATE INDEX "CredentialUpdate_appliedAt_idx" ON "public"."CredentialUpdate"("appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_did_key" ON "public"."Issuer"("did");

-- CreateIndex
CREATE INDEX "Issuer_did_idx" ON "public"."Issuer"("did");

-- CreateIndex
CREATE INDEX "Issuer_verticalId_idx" ON "public"."Issuer"("verticalId");

-- CreateIndex
CREATE INDEX "Template_issuerId_idx" ON "public"."Template"("issuerId");

-- CreateIndex
CREATE INDEX "Template_verticalId_idx" ON "public"."Template"("verticalId");

-- CreateIndex
CREATE INDEX "Template_credentialTypeId_idx" ON "public"."Template"("credentialTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_credentialUuid_key" ON "public"."Certificate"("credentialUuid");

-- CreateIndex
CREATE INDEX "Certificate_anchorId_idx" ON "public"."Certificate"("anchorId");

-- CreateIndex
CREATE INDEX "Certificate_status_idx" ON "public"."Certificate"("status");

-- CreateIndex
CREATE INDEX "Certificate_bundleId_idx" ON "public"."Certificate"("bundleId");

-- CreateIndex
CREATE INDEX "Certificate_verticalId_idx" ON "public"."Certificate"("verticalId");

-- CreateIndex
CREATE INDEX "Certificate_issuerDid_idx" ON "public"."Certificate"("issuerDid");

-- CreateIndex
CREATE UNIQUE INDEX "Revocation_certificateId_key" ON "public"."Revocation"("certificateId");

-- CreateIndex
CREATE INDEX "Revocation_issuerId_status_revokedAt_idx" ON "public"."Revocation"("issuerId", "status", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NFT_tokenId_key" ON "public"."NFT"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "NFT_certificateId_key" ON "public"."NFT"("certificateId");

-- CreateIndex
CREATE INDEX "NFT_certificateId_idx" ON "public"."NFT"("certificateId");

-- CreateIndex
CREATE INDEX "NFT_tokenId_idx" ON "public"."NFT"("tokenId");

-- CreateIndex
CREATE INDEX "NFT_ownerAddress_idx" ON "public"."NFT"("ownerAddress");

-- CreateIndex
CREATE INDEX "NFT_status_idx" ON "public"."NFT"("status");

-- CreateIndex
CREATE INDEX "NFT_anchorId_idx" ON "public"."NFT"("anchorId");

-- AddForeignKey
ALTER TABLE "public"."CredentialType" ADD CONSTRAINT "CredentialType_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "public"."Vertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialBundle" ADD CONSTRAINT "CredentialBundle_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "public"."Vertical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialBundle" ADD CONSTRAINT "CredentialBundle_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "public"."Anchor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CredentialUpdate" ADD CONSTRAINT "CredentialUpdate_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "public"."Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issuer" ADD CONSTRAINT "Issuer_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "public"."Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "public"."Issuer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "public"."Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_credentialTypeId_fkey" FOREIGN KEY ("credentialTypeId") REFERENCES "public"."CredentialType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "public"."Anchor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "public"."CredentialBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificate" ADD CONSTRAINT "Certificate_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "public"."Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revocation" ADD CONSTRAINT "Revocation_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "public"."Issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Revocation" ADD CONSTRAINT "Revocation_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "public"."Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NFT" ADD CONSTRAINT "NFT_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "public"."Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NFT" ADD CONSTRAINT "NFT_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "public"."Anchor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
