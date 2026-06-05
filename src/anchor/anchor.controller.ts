import { Controller, Post, Body, Get, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AnchorService } from './anchor.service.js';
import { ApproveAnchorDto } from './dto/approve-anchor.dto.js';
import { Scopes } from '../auth/scopes.decorator.js';
// import { AuthGuard } from '../auth/auth.guard'; // Descomenta si tienes AuthGuard

@ApiTags('Anchors')
@Controller('anchors')
// @UseGuards(AuthGuard) // Descomenta si tienes AuthGuard
export class AnchorController {
  constructor(private readonly anchorService: AnchorService) {}

  @Post('approve')
  @Scopes('anchors:approve')
  @ApiOperation({
    summary: 'Aprobar y anclar certificados a blockchain',
    description: `Ancla un lote de certificados a blockchain usando un Merkle tree.
    
**Proceso:**
1. Valida que los certificados estén en estado PENDING
2. Calcula el hash canónico de cada certificado (excluyendo proof y campos visuales)
3. Construye un Merkle tree con los hashes
4. Ancla el root del Merkle tree a blockchain (Besu o Sepolia)
5. Genera Merkle proofs para cada certificado
6. Actualiza los certificados con estado ISSUED y el proof de anclaje

**Requisitos:**
- Los certificados deben estar en estado PENDING
- Máximo 100 certificados por lote
- No se permiten IDs duplicados
- Debe estar configurado: ETHEREUM_PRIVATE_KEY, BESU_RPC_URL o ETHEREUM_RPC_URL

**Blockchains soportadas (slugs):**
- 'besu' (incluye 'local')
- 'sepolia' (alias: 'eth-sepolia', 'testnet')
- 'mocknet' (modo mock)`
  })
  @ApiBody({ 
    type: ApproveAnchorDto,
    description: 'IDs de certificados a anclar y blockchain a usar'
  })
  @ApiResponse({
    status: 201,
    description: 'Certificados anclados exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        rootHash: { type: 'string', example: '0x1234...abcd' },
        txHash: { type: 'string', example: '0x5678...efgh' },
        blockchain: { type: 'string', example: 'besu', enum: ['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet'] },
        status: { type: 'string', example: 'CONFIRMED', enum: ['PENDING', 'CONFIRMED', 'FAILED'] },
        certificates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string', example: 'ISSUED' },
              hash: { type: 'string' },
              merkleProof: { type: 'object' }
            }
          }
        },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos: lote muy grande, IDs duplicados, o certificados no válidos' })
  @ApiResponse({ status: 500, description: 'Error al anclar a blockchain' })
  async approveAndAnchor(@Body() body: ApproveAnchorDto) {
    try {
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
      return await this.anchorService.approveAndAnchor(body.certificateIds, body.blockchain);
    } catch (error: any) {
      // Si ya es una excepción HTTP de NestJS, re-lanzarla
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      // Para otros errores, lanzar una excepción con el mensaje del error
      throw new BadRequestException(
        error?.message || 'Error al anclar certificados: ' + String(error)
      );
    }
  }

  @Get()
  @Scopes('anchors:read')
  @ApiOperation({
    summary: 'Listar todos los anclajes',
    description: 'Retorna una lista de todos los anclajes realizados en el sistema, incluyendo su estado y detalles de la transacción.'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de anclajes',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          rootHash: { type: 'string' },
          txHash: { type: 'string' },
          blockchain: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'FAILED'] },
          createdAt: { type: 'string', format: 'date-time' },
          confirmedAt: { type: 'string', format: 'date-time', nullable: true }
        }
      }
    }
  })
  findAll() {
    return this.anchorService.findAll();
  }
}
