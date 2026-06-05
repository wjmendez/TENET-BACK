-- Add local KMS fields to Issuer
ALTER TABLE "Issuer" ADD COLUMN "encryptedPrivateKey" TEXT;
ALTER TABLE "Issuer" ADD COLUMN "keyAlgorithm" TEXT;
ALTER TABLE "Issuer" ADD COLUMN "keyVersion" INTEGER;
ALTER TABLE "Issuer" ADD COLUMN "kmsType" TEXT;
