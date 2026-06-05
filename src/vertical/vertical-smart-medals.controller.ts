import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { SmartMedalService } from '../smart-medal/smart-medal.service.js';
import { CreateSmartMedalDto } from '../smart-medal/dto/create-smart-medal.dto.js';
import { VerticalService } from '../vertical/vertical.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('Verticals')
@Controller('verticals/:slug/smart-medals')
export class VerticalSmartMedalsController {
  constructor(
    private readonly smartMedalService: SmartMedalService,
    private readonly verticalService: VerticalService,
  ) {}

  /**
   * Crea un Smart Medal para cualquier vertical con feature 'smart-medal'
   * El verticalId se obtiene automáticamente del slug
   */
  @Post()
  @Scopes('smart-medals:write')
  @ApiOperation({
    summary: 'Crear Smart Medal',
    description: `Crea un Smart Medal para cualquier vertical que tenga la feature 'smart-medal' habilitada.
    
    **Vertical implícita:** El slug en la URL determina la vertical.
    La vertical debe tener \`features: ['smart-medal']\` en su configuración.
    No es necesario proporcionar verticalId en el body.
    
    **Requisitos:**
    - La vertical debe tener la feature 'smart-medal' habilitada
    - issuerDid: DID de Veramo del usuario que emite (requerido)
    - Template: Template para Smart Medal`,
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "smart-medal" habilitada)',
    example: 'sportstech',
    type: String,
  })
  @ApiBody({
    description: 'Datos del Smart Medal (sin verticalId, se obtiene del slug)',
    schema: {
      type: 'object',
      required: ['templateId', 'issuerDid', 'eventData'],
      properties: {
        templateId: { type: 'string' },
        issuerDid: { type: 'string' },
        eventData: {
          type: 'object',
          properties: {
            eventName: { type: 'string' },
            participantName: { type: 'string' },
            participantEmail: { type: 'string' },
            eventId: { type: 'string' },
            participantId: { type: 'string' },
            thresholds: {
              type: 'object',
              properties: {
                gold: { type: 'number' },
                silver: { type: 'number' },
                bronze: { type: 'number' },
              },
            },
            timingApiUrl: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Smart Medal creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o vertical no tiene feature "smart-medal"' })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada o feature no habilitada' })
  async createSmartMedal(
    @Param('slug') slug: string,
    @Body() dto: Omit<CreateSmartMedalDto, 'verticalId'>,
  ) {
    // Verificar que la vertical existe y tiene la feature 'smart-medal' habilitada
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'smart-medal');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "smart-medal" feature enabled. ` +
        `Enable "smart-medal" in the vertical's config.features array.`,
      );
    }

    // Crear Smart Medal con verticalId del slug
    return this.smartMedalService.createSmartMedal(
      vertical.id,
      dto.templateId,
      dto.issuerDid,
      dto.eventData,
    );
  }

  @Post(':id/update')
  @Scopes('smart-medals:write')
  @ApiOperation({
    summary: 'Actualizar Smart Medal desde sistema de timing',
    description: 'Actualiza el Smart Medal consultando el sistema de timing externo. Solo disponible para verticales con feature "smart-medal".',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "smart-medal" habilitada)',
    example: 'sportstech',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del certificado (Smart Medal)',
  })
  @ApiResponse({ status: 200, description: 'Smart Medal actualizado' })
  async updateMedal(@Param('slug') slug: string, @Param('id') id: string) {
    // Verificar que la vertical tiene la feature 'smart-medal'
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'smart-medal');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "smart-medal" feature enabled.`,
      );
    }

    const update = await this.smartMedalService.updateMedalFromTiming(id);
    return {
      updated: update !== null,
      update: update || null,
    };
  }

  @Get(':id/status')
  @Scopes('smart-medals:read')
  @ApiOperation({
    summary: 'Obtener estado del Smart Medal',
    description: 'Obtiene el estado actual del Smart Medal. Solo disponible para verticales con feature "smart-medal".',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "smart-medal" habilitada)',
    example: 'sportstech',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del certificado (Smart Medal)',
  })
  @ApiResponse({ status: 200, description: 'Estado del Smart Medal' })
  async getMedalStatus(@Param('slug') slug: string, @Param('id') id: string) {
    // Verificar que la vertical tiene la feature 'smart-medal'
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'smart-medal');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "smart-medal" feature enabled.`,
      );
    }

    return this.smartMedalService.getMedalStatus(id);
  }

  @Get(':id/history')
  @Scopes('smart-medals:read')
  @ApiOperation({
    summary: 'Obtener historial de actualizaciones del Smart Medal',
    description: 'Obtiene el historial completo de actualizaciones del Smart Medal. Solo disponible para verticales con feature "smart-medal".',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug de la vertical (debe tener feature "smart-medal" habilitada)',
    example: 'sportstech',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del certificado (Smart Medal)',
  })
  @ApiResponse({ status: 200, description: 'Historial de actualizaciones' })
  async getUpdateHistory(@Param('slug') slug: string, @Param('id') id: string) {
    // Verificar que la vertical tiene la feature 'smart-medal'
    const vertical = await this.verticalService.getVerticalWithFeature(slug, 'smart-medal');

    if (!vertical) {
      throw new Error(
        `Vertical "${slug}" not found, is not active, or does not have the "smart-medal" feature enabled.`,
      );
    }

    return this.smartMedalService.getUpdateHistory(id);
  }
}

