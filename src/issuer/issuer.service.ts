import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import { VeramoService } from '../veramo/veramo.service.js';
import { getTenantId, getTenantIdOptional } from '../common/tenant/tenant-context.js';
import { encryptPrivateKey, generateLocalEd25519KeyMaterial } from '../common/kms/local-kms.js';


@Injectable()
export class IssuerService {
  constructor(private readonly veramoService: VeramoService) {}

  /**
   * Crea un nuevo issuer con DID usando Veramo
   * 
   * Veramo gestiona automáticamente:
   * - Generación del DID (did:web)
   * - Creación del par de claves
   * - Almacenamiento seguro de claves
   */
  async createIssuer(data: {
    did?: string;
    name: string;
    url?: string;
    logo?: string;
  }): Promise<any> {
    const tenantId = getTenantId();
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const domain = new URL(baseUrl).hostname;
    
    // Si ya tiene un DID, verificar que no exista
    if (data.did) {
      const existing = await prisma.issuer.findFirst({
        where: { did: data.did, tenantId }
      });
      if (existing) {
        throw new Error(`Issuer with DID ${data.did} already exists`);
      }
      
      // Verificar si el DID existe en Veramo
      const veramoDid = await this.veramoService.getDid(data.did);
      if (veramoDid) {
        throw new Error(`DID ${data.did} already exists in Veramo`);
      }
    }
    
    // Generar nuevo issuer con DID local
    const issuerId = uuidv4();
    const did = data.did || `did:web:${domain}:issuers:${issuerId}`;
    const keyMaterial = generateLocalEd25519KeyMaterial(did);
    const encryptedPrivateKey = encryptPrivateKey(keyMaterial.privateKeyHex);

    const issuer = await prisma.issuer.create({
      data: {
        tenantId,
        did,
        name: data.name,
        url: data.url || null,
        logo: data.logo || null,
        publicKeyJwk: keyMaterial.publicKeyJwk,
        privateKeyHex: null,
        encryptedPrivateKey,
        keyAlgorithm: keyMaterial.keyAlgorithm,
        keyVersion: keyMaterial.keyVersion,
        kmsType: keyMaterial.kmsType,
        blockchainAddress: null,
      },
    });
    
    return issuer;
  }

  /**
   * Lista todos los issuers
   */
  async findAll(): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.issuer.findMany({
      where: { tenantId },
      select: {
        id: true,
        did: true,
        name: true,
        url: true,
        logo: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Obtiene un issuer por ID
   */
  async findOne(id: string): Promise<any> {
    const tenantId = getTenantId();
    const issuer = await prisma.issuer.findFirst({
      where: { id, tenantId },
      include: {
        templates: {
          select: {
            id: true,
            name: true,
            createdAt: true
          }
        }
      }
    });

    if (!issuer) {
      throw new NotFoundException('Issuer not found');
    }

    return issuer;
  }

  /**
   * Crea o encuentra un issuer basado en la información del business
   * Usa Veramo para gestionar DIDs y claves
   */
  async findOrCreateIssuer(business: {
    did?: string;
    name: string;
    url?: string;
    logo?: string;
  }): Promise<any> {
    const tenantId = getTenantId();
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // Si ya tiene un DID, buscar el issuer existente
    if (business.did) {
      const existing = await prisma.issuer.findFirst({
        where: { did: business.did, tenantId }
      });
      if (existing) {
        return existing;
      }
    }
    
    // Generar nuevo issuer con DID local
    const issuerId = uuidv4();
    const domain = new URL(baseUrl).hostname;
    const did = business.did || `did:web:${domain}:issuers:${issuerId}`;
    const keyMaterial = generateLocalEd25519KeyMaterial(did);
    const encryptedPrivateKey = encryptPrivateKey(keyMaterial.privateKeyHex);

    const issuer = await prisma.issuer.create({
      data: {
        tenantId,
        did,
        name: business.name,
        url: business.url || null,
        logo: business.logo || null,
        publicKeyJwk: keyMaterial.publicKeyJwk,
        privateKeyHex: null,
        encryptedPrivateKey,
        keyAlgorithm: keyMaterial.keyAlgorithm,
        keyVersion: keyMaterial.keyVersion,
        kmsType: keyMaterial.kmsType,
        blockchainAddress: null,
      },
    });
    
    return issuer;
  }
  
  /**
   * Obtiene el documento DID de un issuer usando Veramo
   * Si el DID no existe en Veramo (por ejemplo, después de un reinicio),
   * lo recrea desde la información de la BD
   */
  async getDidDocument(did: string): Promise<any> {
    const tenantId = getTenantIdOptional();
    // Primero buscar el issuer en la BD (opcional, para metadata)
    const issuer = await prisma.issuer.findFirst({
      where: tenantId ? { did, tenantId } : { did },
    });
    
    // Intentar obtener el DID desde Veramo
    let identifier = await this.veramoService.getDid(did);
    
    // Si el DID no existe en Veramo, intentar crearlo desde el DID
    if (!identifier) {
      // Extraer dominio e issuerId del DID
      const didParts = did.split(':');
      if (didParts.length < 5 || didParts[1] !== 'web') {
        throw new Error(`Invalid DID format: ${did}`);
      }
      
      const domain = didParts[2];
      const issuerId = didParts[4]; // Última parte después de :issuers:
      
      try {
        // Intentar recrear el DID en Veramo
        identifier = await this.veramoService.createIssuerDid(domain, issuerId);
        
        // Verificar que el DID creado coincide
        if (identifier.did !== did) {
          throw new Error(`DID mismatch: expected ${did}, got ${identifier.did}`);
        }
      } catch (error: any) {
        // Si no se puede crear, lanzar error descriptivo
        throw new Error(`DID ${did} not found in Veramo and could not be created: ${error.message}`);
      }
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
        // Veramo almacena la clave pública en publicKeyHex o en meta.publicKeyJwk
        let publicKeyJwk = key.meta?.publicKeyJwk || (issuer?.publicKeyJwk as any);
        
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
              kid: `${identifier.did}#key-1`,
            };
          } else {
            // Fallback si no hay clave pública disponible
            publicKeyJwk = {
              kty: 'OKP',
              crv: 'Ed25519',
              kid: `${identifier.did}#key-1`,
            };
          }
        } else {
          // Asegurar que el kid sea correcto
          publicKeyJwk = {
            ...publicKeyJwk,
            kid: publicKeyJwk.kid || `${identifier.did}#key-1`,
          };
        }
        
        return {
          // IMPORTANTE: Usar 'key-1' como estándar de Blockcerts para que coincida con los certificados
          // Si Veramo genera un kid diferente, forzamos 'key-1' para compatibilidad con Blockcerts
          id: `${identifier.did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: identifier.did,
          publicKeyJwk,
        };
      }),
      authentication: [`${identifier.did}#key-1`],
      assertionMethod: [`${identifier.did}#key-1`],
    };
    
    // Agregar servicios específicos de Blockcerts
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const issuerId = did.split(':').pop();
    
    didDocument.service = [
      {
        id: `${did}#issuer`,
        type: 'IssuerProfile',
        serviceEndpoint: `${baseUrl}/issuers/${issuerId}/issuer.json`
      },
      {
        id: `${did}#revocation`,
        type: 'RevocationList2020',
        serviceEndpoint: `${baseUrl}/issuers/${issuerId}/revocationList.json`
      }
    ];
    
    // Agregar alsoKnownAs si hay URL del issuer (si existe en BD)
    if (issuer?.url) {
      didDocument.alsoKnownAs = [issuer.url];
    }
    
    return didDocument;
  }
  
  /**
   * Obtiene el perfil de issuer en formato Blockcerts
   * Usa Veramo para obtener información del DID completamente
   * Si el issuer no existe en BD, genera el profile desde Veramo con valores por defecto
   */
  async getIssuerProfile(did: string): Promise<any> {
    const tenantId = getTenantIdOptional();
    // Buscar el issuer en BD (opcional, para metadata como name, url, logo)
    const issuer = await prisma.issuer.findFirst({
      where: tenantId ? { did, tenantId } : { did },
    });
    
    // Obtener DID Document completo desde Veramo
    // Si el DID no existe en Veramo, getDidDocument() intentará crearlo
    const didDocument = await this.getDidDocument(did);
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const issuerId = did.split(':').pop();
    
    // Usar SOLO los datos del DID Document de Veramo
    // Veramo gestiona las claves y métodos de verificación
    let verificationMethod = didDocument.verificationMethod?.[0];
    
    if (!verificationMethod) {
      throw new Error(`No verification method found in DID Document for ${did}`);
    }
    
    // IMPORTANTE: Asegurar que el verificationMethod.id use exactamente el formato ${did}#key-1
    // Esto debe coincidir EXACTAMENTE con el usado en los certificados
    // Si el verificationMethod.id no termina en #key-1, forzarlo para que coincida
    if (!verificationMethod.id || !verificationMethod.id.endsWith('#key-1')) {
      verificationMethod = {
        ...verificationMethod,
        id: `${did}#key-1`, // Forzar el formato exacto que usan los certificados
      };
    }
    
    // Construir Issuer Profile en formato Blockcerts usando datos de Veramo
    // Veramo usa Ed25519 por defecto, así que usamos el contexto correcto
    // IMPORTANTE: Algunos verificadores de Blockcerts esperan 'publicKey' además de 'verificationMethod'
    const issuerProfile: any = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://w3id.org/blockcerts/v3.1',
        'https://w3id.org/security/suites/ed25519-2020/v1', // Ed25519, no secp256k1
        {
          'issuanceDate': 'http://www.w3.org/2018/credentials#issuanceDate',
          'RevocationList': 'https://w3id.org/blockcerts#RevocationList',
          'courseName': 'https://schema.org/name'
        }
      ],
      id: did,
      type: 'Issuer',
      name: issuer?.name || process.env.ISSUER_NAME || 'Cert Issuer', // Nombre desde BD o por defecto
      url: issuer?.url || baseUrl, // URL desde BD o por defecto
      ...(issuer?.logo && { image: issuer.logo }), // Logo desde BD (solo si existe)
      revocationList: `${baseUrl}/issuers/${issuerId}/revocationList.json`,
    };
    
    // Usar SOLO verificationMethod de Veramo (no mezclar con BD)
    // IMPORTANTE: El verificationMethod debe ser un array con el objeto completo
    // El formato del verificationMethod.id debe coincidir con el usado en los certificados
    const verificationMethodId = verificationMethod.id || `${did}#key-1`;
    
    // Asegurar que el verificationMethod.id sea exactamente el formato esperado
    // IMPORTANTE: El controller debe coincidir con el id del Issuer Profile (did)
    const normalizedVerificationMethod = {
      ...verificationMethod,
      id: verificationMethodId, // Forzar el formato exacto
      controller: did, // Asegurar que el controller coincida con el id del Issuer Profile
    };
    
    issuerProfile.verificationMethod = [normalizedVerificationMethod];
    // assertionMethod debe ser un array con el ID del verificationMethod (usado en los proofs)
    // El verificador verifica que el verificationMethod del certificado esté en assertionMethod
    // IMPORTANTE: Algunos verificadores también verifican que el verificationMethod esté en el array verificationMethod
    // Por lo tanto, aseguramos que el verificationMethod.id coincida exactamente con el usado en los certificados
    issuerProfile.assertionMethod = [verificationMethodId];
    
    // IMPORTANTE: Asegurar que el verificationMethod.id del Issuer Profile coincida EXACTAMENTE con el del certificado
    // El verificador puede buscar el verificationMethod del certificado en el array verificationMethod del Issuer Profile
    // Por lo tanto, el verificationMethod.id debe ser exactamente el mismo formato que se usa en los certificados
    // Ya lo estamos forzando arriba con normalizedVerificationMethod, pero asegurémonos de que sea consistente
    
    // Agregar publicKey para compatibilidad con verificadores antiguos de Blockcerts
    // Algunos verificadores esperan publicKey además de verificationMethod
    if (normalizedVerificationMethod.publicKeyJwk) {
      issuerProfile.publicKey = [{
        id: verificationMethodId,
        type: normalizedVerificationMethod.type,
        controller: normalizedVerificationMethod.controller,
        publicKeyJwk: normalizedVerificationMethod.publicKeyJwk
      }];
    }
    
    return issuerProfile;
  }
  
  /**
   * Obtiene la lista de revocación de un issuer
   */
  async getRevocationList(did: string): Promise<any> {
    const tenantId = getTenantIdOptional();
    const issuer = await prisma.issuer.findFirst({
      where: tenantId ? { did, tenantId } : { did },
      select: { id: true, did: true },
    });
    
    if (!issuer) {
      throw new Error(`Issuer with DID ${did} not found`);
    }
    
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const issuerId = did.split(':').pop();
    
    const revokedCertificates = await prisma.revocation.findMany({
      where: {
        issuerId: issuer.id,
        status: 'ACTIVE',
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        certificateId: true,
        reason: true,
        revokedAt: true,
      },
      orderBy: { revokedAt: 'desc' },
    });
    
    return {
      id: `${baseUrl}/issuers/${issuerId}/revocationList.json`,
      type: 'RevocationList',
      issuer: did,
      revokedAssertions: revokedCertificates.map((revoked) => ({
        id: `urn:uuid:${revoked.certificateId}`,
        revocationReason: revoked.reason || 'Revoked by issuer',
        revokedOn: revoked.revokedAt.toISOString(),
      }))
    };
  }
}

