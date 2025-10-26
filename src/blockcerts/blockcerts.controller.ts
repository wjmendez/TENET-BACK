import { Controller, Get, Param, Header, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BlockcertsService } from './blockcerts.service.js';
import { GetCredentialDto } from './dto/get-credential.dto.js';
import { IssuerProfile, RevocationList } from './interfaces/blockcerts.interface.js';

@Controller()
export class BlockcertsController {
  constructor(private readonly blockcertsService: BlockcertsService) {}

  @Get('issuer.json')
  @Header('Content-Type', 'application/json')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'public, max-age=600')
  @Header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  @Header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
  @ApiOperation({ summary: 'Get issuer profile for Blockcerts verification' })
  @ApiResponse({ status: 200, description: 'Issuer profile', type: Object })
  async getIssuerProfile(): Promise<IssuerProfile> {
    return this.blockcertsService.getIssuerProfile();
  }

  @Get('revocationList.json')
  @Header('Content-Type', 'application/json')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'public, max-age=60')
  @Header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  @Header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
  @ApiOperation({ summary: 'Get revocation list for Blockcerts verification' })
  @ApiResponse({ status: 200, description: 'Revocation list', type: Object })
  async getRevocationList(): Promise<RevocationList> {
    return this.blockcertsService.getRevocationList();
  }

  @Get('credentials/:id')
  @Header('Content-Type', 'application/json')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  @Header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
  @ApiOperation({ summary: 'Get individual credential for Blockcerts verification' })
  @ApiParam({ name: 'id', description: 'Certificate UUID' })
  @ApiResponse({ status: 200, description: 'Credential JSON' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  @ApiResponse({ status: 409, description: 'Credential not issued' })
  async getCredential(@Param() params: GetCredentialDto) {
    try {
      return await this.blockcertsService.getCredential(params.id);
    } catch (error) {
      if (error.message === 'Certificate not found') {
        throw new HttpException({ code: 'NOT_FOUND', message: 'Certificate not found' }, HttpStatus.NOT_FOUND);
      }
      if (error.message === 'Credential not issued') {
        throw new HttpException({ code: 'NOT_ISSUED', message: 'Credential not issued' }, HttpStatus.CONFLICT);
      }
      throw new HttpException({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
