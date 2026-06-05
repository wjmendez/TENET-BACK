import { Controller, Get, Post, Param, Body, Query, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { IssuerService } from './issuer.service.js';
import { CreateIssuerDto } from './dto/create-issuer.dto.js';
import { prisma } from '../common/prisma/prisma.js';
import { Public } from '../auth/public.decorator.js';
import { Scopes } from '../auth/scopes.decorator.js';


/**
 * Controlador para gestión de DIDs y documentos DID de issuers
 * 
 * Proporciona endpoints para acceder a los documentos DID (DID Documents) y perfiles
 * de issuers según los estándares W3C DID Core y Blockcerts.
 */
@ApiTags('Issuers')
@Controller('issuers')
export class IssuerController {
  constructor(private readonly issuerService: IssuerService) {}

  /**
   * Crea un nuevo issuer con DID según estándar W3C
   */
  @Post()
  @Scopes('issuers:write')
  @ApiOperation({
    summary: 'Crear nuevo issuer con DID generado automáticamente',
    description: `Crea un nuevo issuer y **genera automáticamente** un DID único según estándar W3C.
    
**Generación automática de DID:**
El backend genera automáticamente un DID único si no se proporciona en el request. Solo necesitas enviar:
- \`name\` (requerido): Nombre de la institución
- \`url\` (opcional): URL del sitio web
- \`logo\` (opcional): URL del logo
- \`did\` (opcional): Solo si quieres usar un DID personalizado específico

**Lo que se genera automáticamente:**

1. **DID único**: Según estándar did:web (W3C DID Core)
   - Formato: \`did:web:DOMINIO:issuers:UUID\`
   - Ejemplo generado: \`did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440000\`
   - El dominio se toma de \`APP_URL\` en variables de entorno
   - El UUID se genera automáticamente

2. **Par de claves criptográficas**: Ed25519 (KMS local)
  - Clave pública en formato JWK (JSON Web Key)
  - Clave privada cifrada en la base de datos
  - El cifrado usa la master key de \`LOCAL_KMS_MASTER_KEY\`

3. **Documento DID (DID Document)**: Generado automáticamente según W3C DID Core
   - Incluye verificationMethod, authentication, assertionMethod
   - Service endpoints para issuer profile y revocation list
   - Disponible en: \`GET /issuers/:issuerId/did.json\`

**Estándares cumplidos:**
- ✅ W3C DID Core Specification v1.0
- ✅ did:web Method Specification
- ✅ Blockcerts Issuer Profile
- ✅ Verifiable Credentials Data Model

Ejemplo de request (RECOMENDADO - sin DID): Solo envía name, url y logo. El campo did es opcional y NO debe enviarse al registrar un issuer nuevo. El sistema genera automáticamente un DID único usando Veramo. El DID generado puede ser usado inmediatamente en templates y certificados.`
  })
  @ApiBody({
    type: CreateIssuerDto,
    description: 'Datos del issuer a crear'
  })
  @ApiResponse({
    status: 201,
    description: 'Issuer creado exitosamente con DID generado',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000'
        },
        did: {
          type: 'string',
          example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000',
          description: 'DID único generado según estándar did:web'
        },
        name: {
          type: 'string',
          example: 'Mi Organización'
        },
        url: {
          type: 'string',
          nullable: true,
          example: 'https://example.com'
        },
        logo: {
          type: 'string',
          nullable: true,
          example: 'https://example.com/logo.png'
        },
        blockchainAddress: {
          type: 'string',
          example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5'
        },
        createdAt: {
          type: 'string',
          format: 'date-time'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o DID ya existe'
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor'
  })
  async create(@Body() createIssuerDto: CreateIssuerDto) {
    return this.issuerService.createIssuer(createIssuerDto);
  }

  /**
   * Lista todos los issuers
   */
  @Get()
  @Scopes('issuers:read')
  @ApiOperation({
    summary: 'Listar todos los issuers',
    description: 'Retorna una lista de todos los issuers registrados en el sistema con sus DIDs.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de issuers',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          did: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string', nullable: true },
          logo: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  async findAll() {
    return this.issuerService.findAll();
  }

  /**
   * Obtiene un issuer por ID
   */
  @Get(':id')
  @Scopes('issuers:read')
  @ApiOperation({
    summary: 'Obtener issuer por ID',
    description: 'Retorna los detalles completos de un issuer, incluyendo sus templates asociados.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del issuer (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Issuer encontrado',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        did: { type: 'string' },
        name: { type: 'string' },
        url: { type: 'string', nullable: true },
        logo: { type: 'string', nullable: true },
        templates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issuer no encontrado'
  })
  async findOne(@Param('id') id: string) {
    return this.issuerService.findOne(id);
  }

  /**
   * Obtiene el documento DID (DID Document) de un issuer
   * 
   * Retorna el documento DID según el estándar W3C DID Core Specification.
   * Este documento es esencial para la verificación de credenciales verificables.
   */
  @Get(':issuerId/did.json')
  @Public()
  @ApiOperation({
    summary: 'Obtener documento DID (W3C DID Core)',
    description: `Retorna el documento DID (DID Document) de un issuer según el estándar W3C DID Core.
    
**¿Qué es un DID Document?**
Un DID Document es un documento JSON que describe un DID (Decentralized Identifier) y contiene:
- **Identificador único (DID)**: El DID completo del issuer
- **Métodos de verificación (verificationMethod)**: Claves públicas y métodos de autenticación
- **Servicios asociados (service)**: Endpoints para issuer profile y revocation list
- **Metadatos adicionales**: Información sobre el issuer

**Formato del DID:**
\`did:web:DOMINIO:issuers:UUID\`

**Ejemplo:**
\`did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000\`

Este endpoint es usado por verificadores de credenciales para resolver el DID y obtener
la información necesaria para verificar las firmas de los certificados.`
  })
  @ApiParam({
    name: 'issuerId',
    description: 'ID único del issuer (UUID). Es la última parte del DID después de :issuers:',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Documento DID encontrado exitosamente',
    schema: {
      type: 'object',
      properties: {
        '@context': {
          type: 'array',
          items: { type: 'string' },
          example: [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/secp256k1-2019/v1'
          ]
        },
        id: {
          type: 'string',
          example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000',
          description: 'DID completo del issuer'
        },
        verificationMethod: {
          type: 'array',
          description: 'Métodos de verificación (claves públicas)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', example: 'EcdsaSecp256k1VerificationKey2019' },
              controller: { type: 'string' },
              publicKeyJwk: { type: 'object' }
            }
          }
        },
        authentication: {
          type: 'array',
          description: 'Métodos de autenticación'
        },
        assertionMethod: {
          type: 'array',
          description: 'Métodos de aserción (para firmar credenciales)'
        },
        service: {
          type: 'array',
          description: 'Servicios asociados (issuer profile, revocation list)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              serviceEndpoint: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issuer no encontrado. El issuerId proporcionado no existe en el sistema.'
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor'
  })
  async getDidDocument(@Param('issuerId') issuerId: string, @Req() req: any) {
    const tenantId = req?.tenantId as string | undefined;
    // Primero buscar el issuer por ID
    const issuer = await prisma.issuer.findFirst({
      where: { id: issuerId, ...(tenantId ? { tenantId } : {}) }
    });
    
    // Construir el DID esperado desde el issuerId
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const domain = new URL(baseUrl).hostname;
    const expectedDid = `did:web:${domain}:issuers:${issuerId}`;
    
    // Si el issuer existe en BD, usar su DID (que puede ser diferente)
    if (issuer) {
      return this.issuerService.getDidDocument(issuer.did);
    }
    
    if (tenantId) {
      throw new NotFoundException('Issuer not found for tenant');
    }

    // Si no existe en BD, intentar generar el DID Document directamente desde Veramo
    // Esto permite que el endpoint funcione incluso si el issuer no está en la BD
    // (útil cuando el DID fue creado directamente en Veramo)
    try {
      return this.issuerService.getDidDocument(expectedDid);
    } catch (error: any) {
      // Si falla, retornar error descriptivo
      throw new Error(`Issuer with ID ${issuerId} not found in database, and DID ${expectedDid} could not be resolved: ${error.message}`);
    }
  }


  /**
   * Obtiene el perfil de issuer en formato Blockcerts
   * 
   * Retorna el perfil del issuer en formato compatible con verificadores de Blockcerts.
   * Este endpoint es usado por verificadores para obtener información del emisor.
   */
  @Get(':issuerId/issuer.json')
  @Public()
  @ApiOperation({
    summary: 'Obtener perfil de issuer (Blockcerts)',
    description: `Retorna el perfil del issuer en formato Blockcerts compatible con verificadores estándar.

**¿Qué es un Issuer Profile?**
El issuer profile contiene información sobre el emisor de certificados:
- Información de identidad (nombre, URL, logo)
- Claves públicas para verificación
- Métodos de verificación
- URL de la lista de revocación

Este formato es compatible con:
- Blockcerts verifiers
- W3C Verifiable Credentials verifiers
- Otros sistemas de verificación de credenciales

**Uso:**
Los verificadores de certificados usan este endpoint para:
1. Verificar la identidad del emisor
2. Validar las firmas de los certificados
3. Obtener la lista de revocación`
  })
  @ApiParam({
    name: 'issuerId',
    description: 'ID único del issuer (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil de issuer encontrado exitosamente',
    schema: {
      type: 'object',
      properties: {
        '@context': {
          type: 'array',
          items: { type: 'string' }
        },
        id: {
          type: 'string',
          example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000'
        },
        type: {
          type: 'string',
          example: 'Issuer'
        },
        name: {
          type: 'string',
          example: 'Mi Organización'
        },
        url: {
          type: 'string',
          example: 'https://example.com'
        },
        image: {
          type: 'string',
          example: 'https://example.com/logo.png',
          nullable: true
        },
        publicKey: {
          type: 'array',
          description: 'Claves públicas del issuer'
        },
        verificationMethod: {
          type: 'array',
          description: 'Métodos de verificación'
        },
        assertionMethod: {
          type: 'string',
          description: 'Método de aserción para firmar credenciales'
        },
        revocationList: {
          type: 'string',
          description: 'URL de la lista de revocación'
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issuer no encontrado'
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor'
  })
  async getIssuerProfile(@Param('issuerId') issuerId: string, @Req() req: any) {
    const tenantId = req?.tenantId as string | undefined;
    // Primero buscar el issuer por ID
    const issuer = await prisma.issuer.findFirst({
      where: { id: issuerId, ...(tenantId ? { tenantId } : {}) }
    });
    
    // Construir el DID esperado desde el issuerId
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const domain = new URL(baseUrl).hostname;
    const expectedDid = `did:web:${domain}:issuers:${issuerId}`;
    
    // Si el issuer existe en BD, usar su DID (que puede ser diferente)
    if (issuer) {
      return this.issuerService.getIssuerProfile(issuer.did);
    }
    
    if (tenantId) {
      throw new NotFoundException('Issuer not found for tenant');
    }

    // Si no existe en BD, intentar generar el Issuer Profile directamente desde Veramo
    // Esto permite que el endpoint funcione incluso si el issuer no está en la BD
    try {
      return this.issuerService.getIssuerProfile(expectedDid);
    } catch (error: any) {
      // Si falla, retornar error descriptivo
      throw new Error(`Issuer with ID ${issuerId} not found in database, and DID ${expectedDid} could not be resolved: ${error.message}`);
    }
  }

  /**
   * Obtiene la lista de revocación del issuer
   * 
   * Retorna todos los certificados que han sido revocados por este issuer.
   * Esta lista es esencial para verificar si un certificado sigue siendo válido.
   */
  @Get(':issuerId/revocationList.json')
  @Public()
  @ApiOperation({
    summary: 'Obtener lista de revocación',
    description: `Retorna la lista de certificados revocados del issuer.

**¿Qué es una Revocation List?**
Una lista de revocación contiene todos los certificados que han sido revocados
(invalidados) por el issuer. Los verificadores consultan esta lista para determinar
si un certificado sigue siendo válido.

**Contenido:**
- ID de cada certificado revocado
- Fecha de revocación
- Razón de revocación

**Uso:**
Los verificadores consultan este endpoint para:
1. Verificar si un certificado específico ha sido revocado
2. Mantener una lista actualizada de certificados inválidos
3. Cumplir con estándares de verificación de credenciales

**Nota:** Solo se incluyen revocaciones con estado ACTIVE.`
  })
  @ApiParam({
    name: 'issuerId',
    description: 'ID único del issuer (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de revocación encontrada exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          example: 'https://example.com/issuers/550e8400-e29b-41d4-a716-446655440000/revocationList.json'
        },
        type: {
          type: 'string',
          example: 'RevocationList'
        },
        issuer: {
          type: 'string',
          example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000'
        },
        revokedAssertions: {
          type: 'array',
          description: 'Lista de certificados revocados',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: 'urn:uuid:550e8400-e29b-41d4-a716-446655440001'
              },
              revocationReason: {
                type: 'string',
                example: 'Revoked by issuer'
              },
              revokedOn: {
                type: 'string',
                format: 'date-time',
                example: '2025-01-30T20:00:00.000Z'
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issuer no encontrado'
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor'
  })
  async getRevocationList(@Param('issuerId') issuerId: string, @Req() req: any) {
    const tenantId = req?.tenantId as string | undefined;
    // Primero buscar el issuer por ID
    const issuer = await prisma.issuer.findFirst({
      where: { id: issuerId, ...(tenantId ? { tenantId } : {}) }
    });
    
    // Construir el DID esperado desde el issuerId
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const domain = new URL(baseUrl).hostname;
    const expectedDid = `did:web:${domain}:issuers:${issuerId}`;
    
    if (!issuer && tenantId) {
      throw new NotFoundException('Issuer not found for tenant');
    }

    // Si el issuer existe en BD, usar su DID (que puede ser diferente)
    // Si no existe, usar el DID esperado (retornará lista vacía)
    const did = issuer?.did || expectedDid;
    
    return this.issuerService.getRevocationList(did);
  }
}

