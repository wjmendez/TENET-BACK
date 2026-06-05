import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { BundleService } from '../bundle/bundle.service.js';
import { CreateBundleDto } from '../bundle/dto/create-bundle.dto.js';
import { AnchorBundleDto } from '../bundle/dto/anchor-bundle.dto.js';
import { VerticalService } from '../vertical/vertical.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('Verticals')
@Controller('verticals/:slug/bundles')
export class VerticalBundlesController {
  constructor(
    private readonly bundleService: BundleService,
    private readonly verticalService: VerticalService,
  ) {}

  /**
   * Crea un bundle de credenciales para cualquier vertical con feature 'bundle'
   * El verticalId se obtiene automáticamente del slug
   */
  @Post()
  @Scopes('bundles:write')
  @ApiOperation({
    summary: 'Crear bundle de credenciales',
    description: `Crea un bundle de credenciales para cualquier vertical que tenga la feature 'bundle' habilitada.
    
    **Vertical implícita:** El slug en la URL determina la vertical.
    La vertical debe tener \`features: ['bundle']\` en su configuración.
    No es necesario proporcionar verticalId en el body.
    
    **Requisitos:**
    - La vertical debe tener la feature 'bundle' habilitada
    - issuerDid: DID de Veramo del usuario que emite (requerido)
    - Templates: Diploma, Analítico de Notas, Carta de Recomendación (opcional)`,
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "bundle" habilitada)',
    example: 'edtech',
    type: String,
  })
  @ApiBody({
    description: 'Datos del bundle (sin verticalId, se obtiene del slug)',
    schema: {
      type: 'object',
      required: ['recipientId', 'templateIds', 'recipientData', 'issuerDid'],
      properties: {
        recipientId: { type: 'string' },
        templateIds: {
          type: 'object',
          properties: {
            diploma: { type: 'string' },
            analitico: { type: 'string' },
            cartaRecomendacion: { type: 'string' },
          },
        },
        recipientData: { type: 'object' },
        issuerDid: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Bundle creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o vertical no tiene feature "bundle"' })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada o feature no habilitada' })
  async createBundle(
    @Param('slug') slug: string,
    @Body() dto: Omit<CreateBundleDto, 'verticalId'> & { issuerDid: string },
  ) {
    // Verificar que la vertical existe y tiene la feature 'bundle' habilitada
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'bundle');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "bundle" feature enabled. ` +
        `Enable "bundle" in the vertical's config.features array.`,
      );
    }

    // Crear bundle con verticalId del slug
    return this.bundleService.createBundle(
      vertical.id,
      dto.recipientId,
      dto.templateIds,
      dto.recipientData,
      dto.issuerDid,
    );
  }

  @Post(':id/anchor')
  @Scopes('bundles:anchor')
  @ApiOperation({
    summary: 'Anclar bundle',
    description: 'Ancla un bundle completo a blockchain. Solo disponible para verticales con feature "bundle".',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "bundle" habilitada)',
    example: 'edtech',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del bundle',
  })
  @ApiBody({ type: AnchorBundleDto })
  @ApiResponse({ status: 200, description: 'Bundle anclado exitosamente' })
  async anchorBundle(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() dto: AnchorBundleDto,
  ) {
    // Verificar que la vertical tiene la feature 'bundle'
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'bundle');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "bundle" feature enabled.`,
      );
    }

    return this.bundleService.anchorBundle(id, dto.blockchain);
  }

  @Get(':id')
  @Scopes('bundles:read')
  @ApiOperation({
    summary: 'Obtener bundle',
    description: 'Obtiene un bundle completo con todas sus credenciales. Solo disponible para verticales con feature "bundle".',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "bundle" habilitada)',
    example: 'edtech',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del bundle',
  })
  @ApiResponse({ status: 200, description: 'Bundle encontrado' })
  @ApiResponse({ status: 404, description: 'Bundle no encontrado' })
  async getBundle(@Param('slug') slug: string, @Param('id') id: string) {
    // Verificar que la vertical tiene la feature 'bundle'
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'bundle');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "bundle" feature enabled.`,
      );
    }

    return this.bundleService.getBundle(id);
  }

  @Get(':id/verify')
  @Scopes('bundles:read')
  @ApiOperation({
    summary: 'Verificar bundle',
    description: 'Verifica todas las credenciales del bundle. Solo disponible para verticales con feature "bundle".',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "bundle" habilitada)',
    example: 'edtech',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del bundle',
  })
  @ApiResponse({ status: 200, description: 'Resultado de la verificación' })
  async verifyBundle(@Param('slug') slug: string, @Param('id') id: string) {
    // Verificar que la vertical tiene la feature 'bundle'
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'bundle');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "bundle" feature enabled.`,
      );
    }

    return this.bundleService.verifyBundle(id);
  }
}

