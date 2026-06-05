import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Scopes } from './auth/scopes.decorator.js';

@ApiTags('Events')
@Controller('api/event')
export class EventController {
  @Post('certificate')
  @Scopes('events:ingest')
  @ApiOperation({
    summary: 'Manejar evento de certificado',
    description: 'Endpoint para recibir eventos relacionados con certificados. Actualmente solo retorna confirmación de recepción.'
  })
  @ApiBody({
    description: 'Datos del evento',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'certificate.issued' },
        data: { type: 'object' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Evento recibido correctamente',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' }
      }
    }
  })
  handleEvent(@Body() body: any) {
    // Puedes loguear el evento si quieres
    // console.log('Evento recibido:', body);
    return { status: 'ok' };
  }
}
