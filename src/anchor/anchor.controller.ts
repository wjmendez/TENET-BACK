import { Controller, Post, Body, Get, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { AnchorService } from './anchor.service.js';
import { ApproveAnchorDto } from './dto/approve-anchor.dto.js';
// import { AuthGuard } from '../auth/auth.guard'; // Descomenta si tienes AuthGuard

@Controller('anchors')
// @UseGuards(AuthGuard) // Descomenta si tienes AuthGuard
export class AnchorController {
  constructor(private readonly anchorService: AnchorService) {}

  @Post('approve')
  @ApiBody({ type: ApproveAnchorDto })
  async approveAndAnchor(@Body() body: ApproveAnchorDto) {
    // Validar tamaño de lote
    if (body.certificateIds.length > 100) {
      throw new BadRequestException('El lote no puede superar 100 certificados');
    }
    // Validar duplicados
    const unique = new Set(body.certificateIds);
    if (unique.size !== body.certificateIds.length) {
      throw new BadRequestException('No se permiten IDs duplicados en el lote');
    }
    // (Opcional) Validar permisos del usuario aquí
    // if (!req.user.isAdmin) throw new ForbiddenException('Solo administradores pueden anclar');
    return this.anchorService.approveAndAnchor(body.certificateIds, body.blockchain );
  }

  @Get()
  findAll() {
    return this.anchorService.findAll();
  }
}
