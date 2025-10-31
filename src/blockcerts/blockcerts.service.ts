import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Wallet } from 'ethers';
import { IssuerProfile, RevocationList } from './interfaces/blockcerts.interface.js';
import { CertificateService } from '../certificate/certificate.service.js';

const prisma = new PrismaClient();

@Injectable()
export class BlockcertsService {
    constructor(private readonly certificateService: CertificateService) {}

    private getBaseUrl(): any {
        return process.env.APP_URL ;
    }

    private resolveIssuerAddress(): string {
        if (process.env.ISSUER_BLOCKCHAIN_ADDRESS) {
            return process.env.ISSUER_BLOCKCHAIN_ADDRESS;
        }

        const privateKey = process.env.ISSUER_PRIVATE_KEY || process.env.ETHEREUM_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('Unable to resolve issuer blockchain address. Set ISSUER_BLOCKCHAIN_ADDRESS or provide a private key.');
        }

        try {
            const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            const wallet = new Wallet(normalizedKey);
            return wallet.address;
        } catch (error) {
            throw new Error('Unable to derive issuer blockchain address from the configured private key.');
        }
    }

    async getIssuerProfile(): Promise<IssuerProfile> {
        const baseUrl = this.getBaseUrl();
        const issuerAddress = this.resolveIssuerAddress();
        const createdAt = process.env.ISSUER_KEY_CREATED_AT;
        const revokedAt = process.env.ISSUER_KEY_REVOKED_AT;
        const expiresAt = process.env.ISSUER_KEY_EXPIRES_AT;

        return {
            '@context': [
                'https://www.w3.org/ns/credentials/v2',
                'https://w3id.org/blockcerts/v3.1',
                'https://w3id.org/security/suites/secp256k1-2019/v1',
                {
                    'issuanceDate': 'http://www.w3.org/2001/XMLSchema#dateTime',
                    'RevocationList': 'https://w3id.org/blockcerts#RevocationList',
                    'courseName': 'https://schema.org/name'
                }
            ],
            id: `${baseUrl}/issuer.json`,
            type: 'Issuer',
            name: process.env.ISSUER_NAME || 'Cert Issuer',
            url: baseUrl,
            publicKey: [
                {
                    id: `ecdsa-koblitz-pubkey:${issuerAddress}`,
                    ...(createdAt ? { created: createdAt } : {}),
                    ...(revokedAt ? { revoked: revokedAt } : {}),
                    ...(expiresAt ? { expires: expiresAt } : {}),
                },
            ],
            verificationMethod: [
                {
                    id: `${baseUrl}/issuer.json#key-1`,
                    type: 'EcdsaSecp256k1VerificationKey2019',
                    controller: `${baseUrl}/issuer.json`,
                    publicKeyJwk: {
                        kty: 'EC',
                        crv: 'secp256k1',
                        x: process.env.ISSUER_JWK_X!,
                        y: process.env.ISSUER_JWK_Y!,
                        kid: `${baseUrl}/issuer.json#key-1`,
                    },
                },
            ],
            assertionMethod: `${baseUrl}/issuer.json#key-1`,
            revocationList: `${baseUrl}/revocationList.json`,
        };
    }

    async getRevocationList(): Promise<RevocationList> {
        const baseUrl = this.getBaseUrl();
        const revokedCertificates = await prisma.certificate.findMany({
            where: { status: 'CANCELLED' },
            select: { id: true, updatedAt: true },
        });

        return {
            id: `${baseUrl}/revocationList.json`,
            type: 'RevocationList',
            issuer: `${baseUrl}/issuer.json`,
            revokedAssertions: revokedCertificates.map(cert => ({
                id: `urn:uuid:${cert.id}`,
                revocationReason: 'Revoked by issuer',
                revokedOn: cert.updatedAt.toISOString(),
            })),
        };
    }

    async getCredential(id: string) {
        return this.certificateService.getBlockcertsJson(id);
    }
}
