import { Injectable } from '@nestjs/common';
import { getVeramoAgent } from './veramo.config.js';
import { IIdentifier, IKey } from '@veramo/core';
import { prisma } from '../common/prisma/prisma.js';
import { decryptPrivateKey, publicKeyHexFromJwk } from '../common/kms/local-kms.js';

@Injectable()
export class VeramoService {
  private async ensureIssuerImported(did: string): Promise<IIdentifier | null> {
    const veramoAgent = await getVeramoAgent(false);
    try {
      return await veramoAgent.didManagerGet({ did });
    } catch {
      // continue to import
    }

    const issuer = await prisma.issuer.findFirst({
      where: { did },
      select: {
        did: true,
        encryptedPrivateKey: true,
        publicKeyJwk: true,
      },
    });

    if (!issuer?.encryptedPrivateKey || !issuer.publicKeyJwk) {
      return null;
    }

    const privateKeyHex = decryptPrivateKey(issuer.encryptedPrivateKey);
    const publicKeyHex = publicKeyHexFromJwk(issuer.publicKeyJwk as { x: string });
    const kid = `${issuer.did}#key-1`;

    await veramoAgent.didManagerImport({
      did: issuer.did,
      provider: 'did:web',
      controllerKeyId: kid,
      keys: [
        {
          kid,
          kms: 'local',
          type: 'Ed25519',
          privateKeyHex,
          publicKeyHex,
          meta: { publicKeyJwk: issuer.publicKeyJwk },
        },
      ],
      services: [],
    });

    return veramoAgent.didManagerGet({ did: issuer.did });
  }
  /**
   * Crea un DID para un issuer
   * @param domain Dominio base (ej: 'example.com')
   * @param issuerId ID único del issuer (UUID)
   * @returns DID creado
   */
  async createIssuerDid(domain: string, issuerId: string): Promise<IIdentifier> {
    // NO necesitamos CredentialIssuerLD para crear DIDs
    const veramoAgent = await getVeramoAgent(false);
    const did = await veramoAgent.didManagerCreate({
      provider: 'did:web',
      alias: `${domain}:issuers:${issuerId}`,
      options: {
        domain,
        path: `issuers/${issuerId}`,
      },
    });
    
    return did;
  }

  /**
   * Obtiene un DID existente
   * @param did DID a obtener
   * @returns DID o null si no existe
   */
  async getDid(did: string): Promise<IIdentifier | null> {
    try {
      // NO necesitamos CredentialIssuerLD para obtener DIDs
      const veramoAgent = await getVeramoAgent(false);
      return await veramoAgent.didManagerGet({ did });
    } catch {
      return this.ensureIssuerImported(did);
    }
  }

  /**
   * Lista todos los DIDs gestionados
   * @returns Array de DIDs
   */
  async listDids(): Promise<IIdentifier[]> {
    // NO necesitamos CredentialIssuerLD para listar DIDs
    const veramoAgent = await getVeramoAgent(false);
    return veramoAgent.didManagerFind();
  }

  /**
   * Firma un Verifiable Credential (formato JSON-LD)
   * Retorna el VC firmado, manteniendo estructura compatible con Blockcerts
   * 
   * @param credential Credential a firmar (debe tener estructura Blockcerts)
   * @param issuerDid DID del issuer que firma
   * @returns Credential firmado con proof de Veramo
   */
  async signCredential(credential: any, issuerDid: string): Promise<any> {
    await this.ensureIssuerImported(issuerDid);
    // Necesitamos CredentialIssuerLD para firmar credenciales
    const veramoAgent = await getVeramoAgent(true);
    const signedCredential = await veramoAgent.createVerifiableCredential({
      credential: {
        '@context': credential['@context'],
        type: credential.type,
        id: credential.id,
        issuer: { id: issuerDid },
        issuanceDate: credential.issuanceDate,
        credentialSubject: credential.credentialSubject,
        // Mantener campos Blockcerts
        ...(credential.metadata && { metadata: credential.metadata }),
        ...(credential.display && { display: credential.display }),
        ...(credential.displayHtml && { displayHtml: credential.displayHtml }),
      },
      proofFormat: 'lds', // JSON-LD Signature
      save: false,
    });

    // El proof de Veramo se agrega automáticamente
    // Retornamos el credential firmado (aún sin MerkleProof2019)
    return signedCredential;
  }

  /**
   * Verifica un Verifiable Credential
   * @param credential Credential a verificar
   * @returns true si es válido, false en caso contrario
   */
  async verifyCredential(credential: any): Promise<boolean> {
    try {
      // Necesitamos CredentialIssuerLD para verificar credenciales
      const veramoAgent = await getVeramoAgent(true);
      const result = await veramoAgent.verifyCredential({
        credential,
      });
      return result.verified;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene las claves de un DID
   * @param did DID del cual obtener las claves
   * @returns Array de claves
   */
  async getDidKeys(did: string): Promise<IKey[]> {
    const identifier = await this.getDid(did);
    return identifier?.keys || [];
  }

  /**
   * Resuelve un DID a su DID Document
   * Construye el DID Document desde el IIdentifier de Veramo
   * @param did DID a resolver
   * @returns DID Document
   */
  async resolveDid(did: string): Promise<any> {
    try {
      // NO necesitamos CredentialIssuerLD para resolver DIDs
      const veramoAgent = await getVeramoAgent(false);
      
      // Obtener el identifier desde Veramo
      const identifier = await this.ensureIssuerImported(did) || await veramoAgent.didManagerGet({ did });
      
      if (!identifier) {
        throw new Error(`DID ${did} not found in Veramo`);
      }
      
      // Construir el DID Document desde el identifier
      const didDocument: any = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1',
        ],
        id: identifier.did,
        verificationMethod: identifier.keys.map((key: any) => {
          // Obtener la clave pública desde Veramo
          let publicKeyJwk = key.meta?.publicKeyJwk;
          
          // Si no hay publicKeyJwk completo, construir uno desde publicKeyHex
          if (!publicKeyJwk || !publicKeyJwk.x) {
            // Veramo almacena la clave pública en formato hex
            const publicKeyHex = key.publicKeyHex || key.meta?.publicKeyHex;
            
            if (publicKeyHex) {
              // Convertir hex a Base64URL (sin padding) para Ed25519
              // Ed25519 public keys son 32 bytes (64 hex chars)
              const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
              const publicKeyBase64Url = publicKeyBytes.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
              
              publicKeyJwk = {
                kty: 'OKP', // OKP (Octet Key Pair) es el tipo correcto para Ed25519
                crv: 'Ed25519',
                x: publicKeyBase64Url, // Clave pública en Base64URL (requerido para verificación)
                kid: key.kid || `${identifier.did}#key-1`,
              };
            } else {
              // Fallback si no hay clave pública disponible
              publicKeyJwk = {
                kty: 'OKP',
                crv: 'Ed25519',
                kid: key.kid || `${identifier.did}#key-1`,
              };
            }
          }
          
          return {
            id: `${identifier.did}#${key.kid || 'key-1'}`,
            type: 'Ed25519VerificationKey2020',
            controller: identifier.did,
            publicKeyJwk,
          };
        }),
        authentication: [`${identifier.did}#${identifier.keys[0]?.kid || 'key-1'}`],
        assertionMethod: [`${identifier.did}#${identifier.keys[0]?.kid || 'key-1'}`],
      };
      
      return didDocument;
    } catch (error) {
      throw new Error(`Failed to resolve DID ${did}: ${error.message}`);
    }
  }
}

