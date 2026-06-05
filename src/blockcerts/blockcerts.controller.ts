import { Controller, Get, Query, Param, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IssuerService } from '../issuer/issuer.service.js';
import { prisma } from '../common/prisma/prisma.js';
import { Public } from '../auth/public.decorator.js';


/**
 * Controlador para endpoints estándar de Blockcerts y DID:Web
 * 
 * Maneja endpoints como /issuer.json, /revocationList.json y /.well-known/did.json
 * que son usados por verificadores de Blockcerts y resolvers de DID
 */
@ApiTags('Blockcerts')
@Controller()
@Public()
export class BlockcertsController {
  constructor(private readonly issuerService: IssuerService) {}

  /**
   * Endpoint estándar DID:Web: /.well-known/did.json
   * 
   * Según el estándar did:web, este endpoint debe resolver DIDs basados en el path.
   * Para did:web:domain:path:to:resource, se resuelve en https://domain/.well-known/did.json
   * o https://domain/path/to/resource/did.json
   * 
   * En nuestro caso, los DIDs tienen formato: did:web:domain:issuers:issuerId
   * Por lo tanto, debemos resolverlos en: https://domain/.well-known/did.json?resource=issuers:issuerId
   * o directamente en: https://domain/issuers/issuerId/did.json
   */
  @Get('.well-known/did.json')
  @ApiOperation({
    summary: 'Resolver DID Document (DID:Web estándar)',
    description: `Endpoint estándar para resolver DIDs según el método did:web.
    
    **Estándar DID:Web:**
    - Para \`did:web:domain:path:to:resource\`, se resuelve en \`https://domain/.well-known/did.json\`
    - O en \`https://domain/path/to/resource/did.json\`
    
    **Uso:**
    - Si se proporciona \`?resource=issuers:issuerId\`, busca el issuer por ID
    - Si se proporciona \`?did={did}\`, busca el issuer por DID completo
    - Si no se proporciona nada, retorna el issuer más reciente
    
    **Ejemplo:**
    - DID: \`did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000\`
    - URL: \`https://example.com/.well-known/did.json?resource=issuers:550e8400-e29b-41d4-a716-446655440000\`
    - O: \`https://example.com/issuers/550e8400-e29b-41d4-a716-446655440000/did.json\``
  })
  @ApiQuery({
    name: 'resource',
    required: false,
    type: String,
    description: 'Path del recurso (ej: issuers:issuerId)',
    example: 'issuers:550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiQuery({
    name: 'did',
    required: false,
    type: String,
    description: 'DID completo a resolver',
    example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({
    status: 200,
    description: 'DID Document encontrado',
    schema: {
      type: 'object',
      properties: {
        '@context': { type: 'array' },
        id: { type: 'string' },
        verificationMethod: { type: 'array' },
        service: { type: 'array' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'DID no encontrado'
  })
  async resolveDidWeb(@Query('resource') resource?: string, @Query('did') did?: string, @Req() req?: any) {
    try {
      let issuer;
      const tenantId = req?.tenantId as string | undefined;
      
      if (did) {
        // Buscar por DID completo si se proporciona
        issuer = await prisma.issuer.findFirst({
          where: { did, ...(tenantId ? { tenantId } : {}) }
        });
      } else if (resource) {
        // Extraer issuerId del resource (formato: issuers:issuerId)
        const parts = resource.split(':');
        if (parts.length >= 2 && parts[0] === 'issuers') {
          const issuerId = parts.slice(1).join(':'); // Por si el ID tiene ':'
          issuer = await prisma.issuer.findFirst({
            where: { id: issuerId, ...(tenantId ? { tenantId } : {}) }
          });
        }
      } else {
        // Buscar el issuer más reciente
        issuer = await prisma.issuer.findFirst({
          where: tenantId ? { tenantId } : undefined,
          orderBy: { createdAt: 'desc' }
        });
      }
      
      if (!issuer) {
        throw new NotFoundException('DID not found');
      }
      
      // Retornar el DID Document
      const didDocument = await this.issuerService.getDidDocument(issuer.did);
      
      return didDocument;
    } catch (error: any) {
      // Log del error para debugging
      console.error('Error resolving DID:', error);
      // Retornar error más descriptivo
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }

  /**
   * Endpoint alternativo para resolver DIDs usando el path completo
   * Según did:web, did:web:domain:issuers:issuerId puede resolverse en:
   * https://domain/issuers/issuerId/did.json
   * 
   * Este endpoint ya existe en IssuerController, pero lo mantenemos aquí
   * para referencia y como alternativa.
   */
  @Get('well-known/did.json')
  @ApiOperation({
    summary: 'Resolver DID Document (alternativa sin punto)',
    description: `Endpoint alternativo para resolver DIDs sin el punto inicial.
    Funciona igual que /.well-known/did.json pero sin el punto inicial.`
  })
  @ApiQuery({
    name: 'resource',
    required: false,
    type: String,
    description: 'Path del recurso (ej: issuers:issuerId)',
    example: 'issuers:550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiQuery({
    name: 'did',
    required: false,
    type: String,
    description: 'DID completo a resolver',
    example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000'
  })
  async resolveDidWebAlt(@Query('resource') resource?: string, @Query('did') did?: string, @Req() req?: any) {
    return this.resolveDidWeb(resource, did, req);
  }

  /**
   * Endpoint estándar de Blockcerts: /issuer.json
   * 
   * Este endpoint permite resolver el issuer profile cuando el certificado usa
   * una URL genérica como issuer.id. Busca el issuer más reciente o el especificado por DID.
   */
  @Get('issuer.json')
  @ApiOperation({
    summary: 'Obtener issuer profile (Blockcerts estándar)',
    description: `Endpoint estándar de Blockcerts para obtener el issuer profile.
    
    **Uso:**
    - Si se proporciona \`?did={did}\`, busca el issuer por DID
    - Si no se proporciona DID, retorna el issuer más reciente
    
    **Nota:** Se recomienda usar el DID directamente como \`issuer.id\` en los certificados,
    o usar \`/issuers/{issuerId}/issuer.json\` para mayor especificidad.`
  })
  @ApiQuery({
    name: 'did',
    required: false,
    type: String,
    description: 'DID del issuer a buscar',
    example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({
    status: 200,
    description: 'Issuer profile encontrado',
    schema: {
      type: 'object',
      properties: {
        '@context': { type: 'array' },
        id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        url: { type: 'string' },
        verificationMethod: { type: 'array' },
        revocationList: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Issuer no encontrado'
  })
  async getIssuerProfileCompat(@Query('did') did?: string, @Req() req?: any) {
    let issuer;
    const tenantId = req?.tenantId as string | undefined;
    
    if (did) {
      // Buscar por DID si se proporciona
      issuer = await prisma.issuer.findFirst({
        where: { did, ...(tenantId ? { tenantId } : {}) }
      });
    } else {
      // Buscar el issuer más reciente
      issuer = await prisma.issuer.findFirst({
        where: tenantId ? { tenantId } : undefined,
        orderBy: { createdAt: 'desc' }
      });
    }
    
    if (!issuer) {
      throw new NotFoundException('Issuer not found');
    }
    
    return this.issuerService.getIssuerProfile(issuer.did);
  }
}

