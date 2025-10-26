import { Controller, Post, Body } from '@nestjs/common';

@Controller('api/event')
export class EventController {
  @Post('certificate')
  handleEvent(@Body() body: any) {
    // Puedes loguear el evento si quieres
    // console.log('Evento recibido:', body);
    return { status: 'ok' };
  }
}
