import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CredentialTypeService } from './credential-type.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('Credential Types')
@Controller('credential-types')
export class CredentialTypeController {
  constructor(private readonly credentialTypeService: CredentialTypeService) {}

  @Post()
  @Scopes('credential-types:write')
  @ApiOperation({ 
    summary: 'Crear un nuevo tipo de credencial',
    description: `Crea un nuevo tipo de credencial para una vertical específica.

**Tipos de credenciales soportados:**
- VC_STATIC: Verifiable Credential estático (no cambia después de emitido)
- VC_DYNAMIC: Verifiable Credential dinámico (puede actualizarse)
- NFT_STATIC: NFT estático (metadata fija)
- NFT_DYNAMIC: NFT dinámico (metadata actualizable, ej: Smart Medal)
- BUNDLE: Bundle de credenciales (ej: Carpeta de Egreso)

**Schema:**
Define la estructura esperada del credential usando JSON Schema.

**DisplayConfig:**
Configuración de visualización (templates, colores, animaciones).

**UpdatePolicy:**
Política de actualización para credenciales dinámicos (triggers, reglas).`
  })
  @ApiBody({
    description: 'Datos del tipo de credencial a crear',
    schema: {
      type: 'object',
      required: ['verticalId', 'name', 'type'],
      properties: {
        verticalId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID de la vertical' },
        name: { type: 'string', example: 'Diploma', description: 'Nombre del tipo de credencial' },
        type: { type: 'string', example: 'VC_STATIC', enum: ['VC_STATIC', 'VC_DYNAMIC', 'NFT_STATIC', 'NFT_DYNAMIC', 'BUNDLE'] },
        schema: { type: 'object', nullable: true, description: 'JSON Schema para validación' },
        displayConfig: { type: 'object', nullable: true, description: 'Configuración de visualización' },
        updatePolicy: { type: 'object', nullable: true, description: 'Política de actualización (para dinámicos)' },
        isActive: { type: 'boolean', example: true, default: true }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Tipo de credencial creado exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        verticalId: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string' },
        schema: { type: 'object', nullable: true },
        displayConfig: { type: 'object', nullable: true },
        updatePolicy: { type: 'object', nullable: true },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Vertical no encontrada' })
  async createType(@Body() data: {
    verticalId: string;
    name: string;
    type: string;
    schema?: any;
    displayConfig?: any;
    updatePolicy?: any;
    isActive?: boolean;
  }) {
    return this.credentialTypeService.createType(data.verticalId, data);
  }

  @Get()
  @Scopes('credential-types:read')
  @ApiOperation({ 
    summary: 'Listar tipos de credenciales',
    description: 'Retorna una lista de tipos de credenciales. Puede filtrarse por vertical.'
  })
  @ApiQuery({ 
    name: 'verticalId', 
    required: false, 
    type: String, 
    description: 'Filtrar por ID de vertical',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiQuery({ 
    name: 'all', 
    required: false, 
    type: String, 
    description: 'Si es "true", retorna todos los tipos (activos e inactivos)',
    example: 'true'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de tipos de credenciales',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verticalId: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  async listTypes(@Query('verticalId') verticalId?: string, @Query('all') all?: string) {
    if (verticalId) {
      return this.credentialTypeService.listTypesByVertical(verticalId, all === 'true');
    }
    return this.credentialTypeService.listAllTypes(all === 'true');
  }

  @Get(':id')
  @Scopes('credential-types:read')
  @ApiOperation({ 
    summary: 'Obtener tipo de credencial por ID',
    description: 'Retorna los detalles completos de un tipo de credencial, incluyendo schema, displayConfig y updatePolicy.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del tipo de credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tipo de credencial encontrado',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        verticalId: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string' },
        schema: { type: 'object', nullable: true },
        displayConfig: { type: 'object', nullable: true },
        updatePolicy: { type: 'object', nullable: true },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Tipo de credencial no encontrado' })
  async getType(@Param('id') id: string) {
    return this.credentialTypeService.getType(id);
  }

  @Post(':id/validate')
  @Scopes('credential-types:validate')
  @ApiOperation({ 
    summary: 'Validar un credential contra el schema del tipo',
    description: 'Valida que un credential cumple con el schema definido para este tipo de credencial.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del tipo de credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiBody({
    description: 'Credential a validar',
    schema: {
      type: 'object',
      example: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: {
          name: 'Juan Pérez',
          courseName: 'Curso de Blockchain'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Resultado de la validación',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        errors: {
          type: 'array',
          nullable: true,
          items: { type: 'string' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Tipo de credencial no encontrado' })
  async validateCredential(@Param('id') id: string, @Body() credential: any) {
    const isValid = await this.credentialTypeService.validateCredential(id, credential);
    return { valid: isValid };
  }

  @Put(':id')
  @Scopes('credential-types:write')
  @ApiOperation({ 
    summary: 'Actualizar tipo de credencial',
    description: 'Actualiza los campos de un tipo de credencial (schema, displayConfig, updatePolicy, etc.)'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del tipo de credencial',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiBody({
    description: 'Campos a actualizar',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        schema: { type: 'object', nullable: true },
        displayConfig: { type: 'object', nullable: true },
        updatePolicy: { type: 'object', nullable: true },
        isActive: { type: 'boolean', nullable: true }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tipo de credencial actualizado',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        schema: { type: 'object', nullable: true },
        displayConfig: { type: 'object', nullable: true },
        updatePolicy: { type: 'object', nullable: true },
        isActive: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Tipo de credencial no encontrado' })
  async updateType(@Param('id') id: string, @Body() data: {
    name?: string;
    schema?: any;
    displayConfig?: any;
    updatePolicy?: any;
    isActive?: boolean;
  }) {
    return this.credentialTypeService.updateType(id, data);
  }

  @Delete(':id')
  @Scopes('credential-types:write')
  @ApiOperation({ 
    summary: 'Eliminar tipo de credencial (soft delete)',
    description: 'Desactiva un tipo de credencial (soft delete). No elimina físicamente los datos.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del tipo de credencial a eliminar',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tipo de credencial desactivado',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        isActive: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Tipo de credencial desactivado' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Tipo de credencial no encontrado' })
  async deleteType(@Param('id') id: string) {
    return this.credentialTypeService.deleteType(id);
  }
}

