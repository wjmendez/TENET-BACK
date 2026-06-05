-- AlterTable
ALTER TABLE "public"."Anchor" ADD COLUMN     "chainNetworkId" TEXT;

-- CreateTable
CREATE TABLE "public"."ChainNetwork" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "veramoPlugin" TEXT NOT NULL,
    "chainId" TEXT,
    "rpcUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainNetwork_slug_key" ON "public"."ChainNetwork"("slug");

-- CreateIndex
CREATE INDEX "ChainNetwork_isActive_idx" ON "public"."ChainNetwork"("isActive");

-- CreateIndex
CREATE INDEX "Anchor_chainNetworkId_idx" ON "public"."Anchor"("chainNetworkId");

-- AddForeignKey
ALTER TABLE "public"."Anchor" ADD CONSTRAINT "Anchor_chainNetworkId_fkey" FOREIGN KEY ("chainNetworkId") REFERENCES "public"."ChainNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
