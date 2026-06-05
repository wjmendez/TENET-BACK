import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { VerticalService } from './vertical.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('Verticals')
@Controller('verticals')
export class VerticalController {
  constructor(private readonly verticalService: VerticalService) {}

  @Post()
  @Scopes('verticals:write')
  @ApiOperation({ 
    summary: 'Crear una nueva vertical',
    description: `Crea una nueva vertical en el sistema. Las verticales representan diferentes dominios de negocio (EdTech, SportsTech, HealthTech, etc.).

**Verticales predefinidas:**
- EdTech: Educación (activa)
- SportsTech: Deportes (activa)
- HealthTech: Salud (inactiva)
- HR Tech: Recursos Humanos (inactiva)
- Retail: Consumo (inactiva)

**Configuración:**
Cada vertical puede tener configuración específica:
- blockchain: Blockchain a usar (besu, sepolia, eth-sepolia, lacchain, polygon)
- privacyLevel: Nivel de privacidad (public, private)
- didMethod: Método DID (did:web, did:lacchain)
- features: Características habilitadas (bundle, nft, dynamic_metadata, etc.)`
  })
  @ApiBody({
    description: 'Datos de la vertical a crear',
    schema: {
      type: 'object',
      required: ['name', 'slug'],
      properties: {
        name: { type: 'string', example: 'EdTech', description: 'Nombre de la vertical' },
        slug: { type: 'string', example: 'edtech', description: 'Slug único (URL-friendly)' },
        description: { type: 'string', example: 'Educación - Certificados académicos', nullable: true },
        config: { 
          type: 'object', 
          example: { blockchain: 'besu', privacyLevel: 'public', didMethod: 'did:web', features: ['bundle'] },
          nullable: true
        },
        isActive: { type: 'boolean', example: true, default: true }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Vertical creada exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string', nullable: true },
        config: { type: 'object' },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o slug duplicado' })
  async createVertical(@Body() data: {
    name: string;
    slug: string;
    description?: string;
    config?: any;
    isActive?: boolean;
  }) {
    return this.verticalService.createVertical(data);
  }

  @Get()
  @Scopes('verticals:read')
  @ApiOperation({ 
    summary: 'Listar verticales',
    description: 'Retorna una lista de verticales. Por defecto solo retorna las activas.'
  })
  @ApiQuery({ 
    name: 'all', 
    required: false, 
    type: String, 
    description: 'Si es "true", retorna todas las verticales (activas e inactivas)',
    example: 'true'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de verticales',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  async listVerticals(@Query('all') all?: string) {
    if (all === 'true') {
      return this.verticalService.listAllVerticals();
    }
    return this.verticalService.listActiveVerticals();
  }

  @Get(':slug')
  @Scopes('verticals:read')
  @ApiOperation({ 
    summary: 'Obtener vertical por slug',
    description: 'Retorna los detalles completos de una vertical, incluyendo sus tipos de credenciales y configuración.'
  })
  @ApiParam({ 
    name: 'slug', 
    description: 'Slug de la vertical (ej: edtech, sportstech)',
    example: 'edtech',
    type: String
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Vertical encontrada',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string', nullable: true },
        config: { type: 'object' },
        isActive: { type: 'boolean' },
        credentialTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' }
            }
          }
        },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada' })
  async getVertical(@Param('slug') slug: string) {
    return this.verticalService.getVertical(slug);
  }

  @Put(':id/config')
  @Scopes('verticals:configure')
  @ApiOperation({ 
    summary: 'Actualizar configuración de vertical',
    description: 'Actualiza la configuración específica de una vertical (blockchain, privacidad, features, etc.)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la vertical',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiBody({
    description: 'Nueva configuración',
    schema: {
      type: 'object',
      example: {
        blockchain: 'besu',
        privacyLevel: 'public',
        didMethod: 'did:web',
        features: ['bundle', 'open_badges']
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuración actualizada',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        config: { type: 'object' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada' })
  async updateConfig(@Param('id') id: string, @Body() config: any) {
    return this.verticalService.updateVerticalConfig(id, config);
  }

  @Put(':id/active')
  @Scopes('verticals:configure')
  @ApiOperation({ 
    summary: 'Activar/desactivar vertical',
    description: 'Activa o desactiva una vertical. Las verticales inactivas no pueden emitir nuevas credenciales.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la vertical',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiBody({
    description: 'Estado de activación',
    schema: {
      type: 'object',
      required: ['isActive'],
      properties: {
        isActive: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado actualizado',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        isActive: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada' })
  async setActive(@Param('id') id: string, @Body() data: { isActive: boolean }) {
    return this.verticalService.setActive(id, data.isActive);
  }

  @Delete(':id')
  @Scopes('verticals:write')
  @ApiOperation({ 
    summary: 'Eliminar vertical (soft delete)',
    description: 'Desactiva una vertical (soft delete). No elimina físicamente los datos, solo marca la vertical como inactiva.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la vertical a eliminar',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Vertical desactivada',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        isActive: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Vertical desactivada' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada' })
  async deleteVertical(@Param('id') id: string) {
    return this.verticalService.deleteVertical(id);
  }
}

