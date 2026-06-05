import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CertificateService } from './certificate.service.js';
import { Scopes } from '../auth/scopes.decorator.js';

/**
 * Controlador para gestión de certificados
 * 
 * Mantiene solo endpoints de debug/verificación.
 * Los endpoints principales de emisión y consulta están en CredentialsController.
 */
@ApiTags('Certificates')
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) { }

  /**
   * Obtiene el JSON-LD de Blockcerts de un certificado
   * 
   * Retorna el certificado en formato VerifiableCredential completo con el proof
   * de anclaje a blockchain. Este formato es compatible con verificadores de Blockcerts.
   */
  @Get(':id/verify-hash')
  @Scopes('credentials:read')
  @ApiOperation({ 
    summary: '[DEBUG] Verificar hash canónico del certificado',
    description: `Endpoint de depuración para verificar que el hash canónico calculado coincide con el almacenado.
    
Compara el hash calculado del certificado devuelto con el targetHash almacenado en el merkleProof.`,
  })
  @ApiParam({ name: 'id', description: 'ID del certificado' })
  @ApiResponse({ 
    status: 200, 
    description: 'Resultado de la verificación del hash',
  })
  async verifyHash(@Param('id') id: string) {
    return this.certificateService.verifyHash(id);
  }
}
