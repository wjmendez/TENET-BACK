import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @Scopes('api-keys:read')
  @ApiOperation({
    summary: 'Listar API keys',
    description: 'Retorna todas las API keys del tenant actual (sin el secreto).',
  })
  @ApiResponse({ status: 200, description: 'Lista de API keys' })
  async list() {
    return this.apiKeysService.list();
  }

  @Post()
  @Scopes('api-keys:write')
  @ApiOperation({
    summary: 'Crear API key',
    description: 'Crea una API key y retorna el secreto solo una vez.',
  })
  @ApiBody({
    description: 'Datos de la API key',
    schema: {
      type: 'object',
      required: ['name', 'scopes'],
      properties: {
        name: { type: 'string', example: 'Integracion CRM' },
        scopes: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'API key creada' })
  async create(@Body() body: { name: string; scopes: string[] }) {
    return this.apiKeysService.create(body);
  }

  @Post(':id/revoke')
  @Scopes('api-keys:write')
  @ApiOperation({
    summary: 'Revocar API key',
    description: 'Revoca una API key por ID.',
  })
  @ApiParam({ name: 'id', description: 'ID de la API key' })
  @ApiResponse({ status: 200, description: 'API key revocada' })
  async revoke(@Param('id') id: string) {
    return this.apiKeysService.revoke(id);
  }

  @Post(':id/rotate')
  @Scopes('api-keys:write')
  @ApiOperation({
    summary: 'Rotar API key',
    description: 'Revoca la key actual y genera una nueva (mismo nombre).',
  })
  @ApiParam({ name: 'id', description: 'ID de la API key' })
  @ApiBody({
    description: 'Scopes opcionales para la nueva key',
    schema: {
      type: 'object',
      properties: {
        scopes: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'API key rotada' })
  async rotate(@Param('id') id: string, @Body() body?: { scopes?: string[] }) {
    return this.apiKeysService.rotate(id, body?.scopes);
  }
}
