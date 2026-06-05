import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { TemplateService } from './template.service.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { Scopes } from '../auth/scopes.decorator.js';

/**
 * Controlador para gestión de plantillas de certificados
 * 
 * Permite crear, consultar y eliminar plantillas de certificados.
 * Las plantillas incluyen estructura JSON-LD completa, donde el canvas está en
 * jsonLd.credentialSubject.certificate.design (no como campo separado).
 */
@ApiTags('Templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * Crea una nueva plantilla de certificado
   * 
   * La plantilla puede incluir:
   * - Un jsonLd completo con estructura de VerifiableCredential (recomendado)
   * - HTML del template (opcional, solo para entrada) - se prioriza sobre canvas
   * - Un canvas con diseño visual (opcional, solo para entrada)
   *   Se convierte a HTML y se integra en jsonLd.display.content
   * - Variables que se extraen automáticamente del jsonLd y HTML
   */
  @Post()
  @Scopes('templates:write')
  @ApiOperation({ 
    summary: 'Crear una nueva plantilla',
    description: `Crea una plantilla de certificado. La plantilla puede incluir:
    
    1. **jsonLd completo** (recomendado): Estructura completa de VerifiableCredential con variables.
    2. **html** (opcional, solo para entrada): HTML completo del template del certificado.
       Si se proporciona, se usa directamente y se integra en jsonLd.display.content.
       Si se proporciona tanto 'html' como 'canvas', se prioriza 'html'.
    3. **canvas** (opcional, solo para entrada): Diseño visual del certificado.
       Si se proporciona sin jsonLd, se genera un jsonLd completo automáticamente.
       Si se proporciona con jsonLd, se convierte a HTML y se integra en jsonLd.display.content.
       El canvas NO se guarda como campo separado, solo se convierte a HTML.
    4. **variables**: Lista de variables (opcional, se extraen automáticamente del jsonLd y HTML)
    
    Las variables se extraen buscando patrones {{variable}} o {variable} en el jsonLd y HTML.
    
    **Variables soportadas:**
    - Issuer: {issuerDid}, {issuerName}, {issuerUrl}, {issuerLogo}
    - Recipient: {{studentName}}, {{studentDid}}, {{email}}, {{courseName}}, {{date}}, {{qrUrl}}
    - Proof: {{firmaDigital}}
    
    **Nota:** Los campos 'html', 'canvas', 'filePath' y 'business' son solo para entrada
    y no se guardan en la base de datos. El HTML se integra en jsonLd.display.content.`
  })
  @ApiBody({ 
    type: CreateTemplateDto,
    description: 'Datos de la plantilla a crear'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Plantilla creada exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        name: { type: 'string', example: 'Certificado Moderno' },
        description: { type: 'string', nullable: true },
        jsonLd: { type: 'object' },
        variables: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  /**
   * Obtiene todas las plantillas
   */
  @Get()
  @Scopes('templates:read')
  @ApiOperation({ 
    summary: 'Listar todas las plantillas',
    description: 'Retorna una lista de todas las plantillas disponibles en el sistema.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de plantillas',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  findAll() {
    return this.templateService.findAll();
  }

  /**
   * Obtiene una plantilla por ID
   */
  @Get(':id')
  @Scopes('templates:read')
  @ApiOperation({ 
    summary: 'Obtener plantilla por ID',
    description: 'Retorna los detalles completos de una plantilla, incluyendo jsonLd (con canvas en credentialSubject.certificate.design) y variables.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la plantilla',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Plantilla encontrada',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        jsonLd: { type: 'object', nullable: true },
        variables: { type: 'array', items: { type: 'string' }, nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  /**
   * Elimina una plantilla
   */
  @Delete(':id')
  @Scopes('templates:write')
  @ApiOperation({ 
    summary: 'Eliminar plantilla',
    description: 'Elimina una plantilla del sistema. Esta acción no puede deshacerse.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID de la plantilla a eliminar',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Plantilla eliminada exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        message: { type: 'string', example: 'Plantilla eliminada' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  remove(@Param('id') id: string) {
    return this.templateService.remove(id);
  }
}
