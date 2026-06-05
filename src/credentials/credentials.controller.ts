import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { IssuanceService } from '../issuance/issuance.service.js';
import { CertificateService } from '../certificate/certificate.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('Credentials')
@Controller('credentials')
export class CredentialsController {
  constructor(
    private readonly issuanceService: IssuanceService,
    private readonly certificateService: CertificateService,
  ) {}

  /**
   * Emite una credencial con validación de vertical y DID del emisor
   * 
   * Este endpoint centraliza la emisión de credenciales con validaciones:
   * - Valida que la vertical existe y está activa
   * - Valida que el template pertenece al vertical
   * - Valida o crea el DID del emisor en Veramo
   * - Firma la credencial con Veramo usando el DID del emisor
   */
  @Post('issue')
  @Scopes('credentials:issue')
  @ApiOperation({
    summary: 'Emitir credencial con validación de vertical',
    description: `Emite una credencial validando que:
    - La vertical existe y está activa
    - El template pertenece al vertical
    - El DID del emisor existe en Veramo (o se crea automáticamente)
    - La credencial se firma con Veramo usando el DID del emisor
    
    **DID del Emisor:**
    - Si se proporciona \`issuerDid\`, se valida que existe en Veramo
    - Si no existe, se crea automáticamente
    - Si no se proporciona, se usa el DID del template (si existe)
    
    **Firma:**
    - Todas las credenciales se firman con Veramo usando el DID del emisor
    - EdTech: Firma Veramo + MerkleProof2019 (Blockcerts)
    - Otras verticales: Solo firma Veramo (configuración especial)`,
  })
  @ApiBody({
    description: 'Datos para emitir la credencial',
    schema: {
      type: 'object',
      required: ['verticalId', 'templateId', 'issuerDid', 'recipientData'],
      properties: {
        verticalId: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
          description: 'ID de la vertical',
        },
        templateId: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440001',
          description: 'ID del template',
        },
        issuerDid: {
          type: 'string',
          example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440002',
          description: 'DID de Veramo del usuario que emite (se crea automáticamente si no existe)',
        },
        recipientData: {
          type: 'object',
          description: 'Datos del destinatario',
          example: {
            studentName: 'Juan Pérez',
            email: 'juan@example.com',
            courseName: 'Ingeniería',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Credencial emitida exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          templateId: { type: 'string' },
          verticalId: { type: 'string' },
          issuerDid: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'ISSUED', 'CANCELLED'] },
          credentialUuid: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o validación fallida' })
  @ApiResponse({ status: 404, description: 'Vertical o template no encontrado' })
  async issueCredential(@Body() body: {
    verticalId: string;
    templateId: string;
    issuerDid: string;
    recipientData: any;
  }) {
    return this.issuanceService.issueCredential(body);
  }

  /**
   * Lista credenciales con filtro opcional por vertical
   */
  @Get()
  @Scopes('credentials:read')
  @ApiOperation({
    summary: 'Listar credenciales',
    description: 'Retorna una lista de credenciales, opcionalmente filtradas por vertical.',
  })
  @ApiQuery({
    name: 'verticalId',
    required: false,
    type: String,
    description: 'Filtrar por ID de vertical',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de credenciales',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          templateId: { type: 'string' },
          verticalId: { type: 'string', nullable: true },
          issuerDid: { type: 'string', nullable: true },
          status: { type: 'string' },
          credentialUuid: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async findAll(@Query('verticalId') verticalId?: string) {
    return this.certificateService.findAll(verticalId);
  }

  /**
   * Revoca una credencial
   */
  @Post(':id/revoke')
  @Scopes('credentials:revoke')
  @ApiOperation({
    summary: 'Revocar credencial',
    description: 'Marca la credencial como revocada y la agrega a la lista de revocacion del issuer.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID o credentialUuid de la credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          example: 'Revoked by issuer',
          description: 'Razon libre de revocacion',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Credencial revocada' })
  @ApiResponse({ status: 404, description: 'Credencial no encontrada' })
  async revokeCredential(
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.certificateService.revokeCertificate(id, body?.reason);
  }

  /**
   * Reinstala una credencial revocada
   */
  @Post(':id/reinstate')
  @Scopes('credentials:reinstate')
  @ApiOperation({
    summary: 'Reinstalar credencial',
    description: 'Cambia el estado de revocacion a reinstated y devuelve la credencial a estado ISSUED.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID o credentialUuid de la credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Credencial reinstalada' })
  @ApiResponse({ status: 404, description: 'Revocacion no encontrada' })
  async reinstateCredential(@Param('id') id: string) {
    return this.certificateService.reinstateCertificate(id);
  }

  /**
   * Obtiene el Blockcerts JSON de una credencial
   * Solo disponible para EdTech (vertical que usa Blockcerts)
   * 
   * Nota: Para obtener la credencial completa, usa GET /credentials/:id (endpoint estándar Blockcerts)
   */
  @Get(':id/blockcerts')
  @Scopes('credentials:read')
  @ApiOperation({
    summary: 'Obtener credencial en formato Blockcerts',
    description: `Retorna la credencial en formato Blockcerts (solo para EdTech).
    
    **Nota:** Este endpoint solo está disponible para credenciales de la vertical EdTech.
    Otras verticales usan configuración especial y no generan Blockcerts.`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Credencial en formato Blockcerts',
  })
  @ApiResponse({ status: 400, description: 'Credencial no anclada o no es EdTech' })
  @ApiResponse({ status: 404, description: 'Credencial no encontrada' })
  async getBlockcerts(@Param('id') id: string) {
    return this.certificateService.getBlockcertsJson(id);
  }
}

