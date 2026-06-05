import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CertificateService } from '../certificate/certificate.service.js';
import { prisma } from '../common/prisma/prisma.js';
import { getTenantId } from '../common/tenant/tenant-context.js';
import { Scopes } from '../auth/scopes.decorator.js';


@ApiTags('Verticals')
@Controller('verticals/:slug/credentials')
export class VerticalCredentialsController {
  constructor(private readonly certificateService: CertificateService) {}

  /**
   * Lista credenciales de una vertical específica
   */
  @Get()
  @Scopes('credentials:read')
  @ApiOperation({
    summary: 'Listar credenciales de una vertical',
    description: `Retorna todas las credenciales emitidas para una vertical específica.
    
    El slug de la vertical se obtiene de la URL, por lo que no es necesario proporcionarlo en el query.`,
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (ej: edtech, sportstech)',
    example: 'edtech',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filtrar por estado',
    enum: ['PENDING', 'ISSUED', 'CANCELLED'],
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de credenciales de la vertical',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          templateId: { type: 'string' },
          verticalId: { type: 'string' },
          issuerDid: { type: 'string', nullable: true },
          status: { type: 'string' },
          credentialUuid: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada' })
  async listCredentials(
    @Param('slug') slug: string,
    @Query('status') status?: string,
  ) {
    // Obtener vertical por slug
    const tenantId = getTenantId();
    const vertical = await prisma.vertical.findFirst({
      where: { slug, tenantId },
    });

    if (!vertical) {
      throw new Error(`Vertical with slug ${slug} not found`);
    }

    // Listar credenciales de la vertical
    return this.certificateService.findAll(vertical.id);
  }

  /**
   * Obtiene una credencial específica de una vertical
   */
  @Get(':id')
  @Scopes('credentials:read')
  @ApiOperation({
    summary: 'Obtener credencial de una vertical',
    description: 'Retorna los detalles de una credencial específica de la vertical.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical',
    example: 'edtech',
    type: String,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Credencial encontrada',
  })
  @ApiResponse({ status: 404, description: 'Credencial o vertical no encontrada' })
  async getCredential(@Param('slug') slug: string, @Param('id') id: string) {
    // Verificar que la vertical existe
    const tenantId = getTenantId();
    const vertical = await prisma.vertical.findFirst({
      where: { slug, tenantId },
    });

    if (!vertical) {
      throw new Error(`Vertical with slug ${slug} not found`);
    }

    // Obtener credencial y verificar que pertenece a la vertical
    const credential = await this.certificateService.findOne(id);

    if (credential.verticalId !== vertical.id) {
      throw new Error(
        `Credential ${id} does not belong to vertical ${slug}`,
      );
    }

    return credential;
  }
}

