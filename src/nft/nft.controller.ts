import { Controller, Post, Get, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { NFTService } from './nft.service.js';
import { MintNFTDto } from './dto/mint-nft.dto.js';
import { TransferNFTDto } from './dto/transfer-nft.dto.js';
import { AnchorNFTDto } from './dto/anchor-nft.dto.js';
import { IssueAndAnchorNFTDto } from './dto/issue-and-anchor-nft.dto.js';
import { Scopes } from '../auth/scopes.decorator.js';

@ApiTags('NFT')
@Controller('nft')
export class NFTController {
  constructor(private readonly nftService: NFTService) {}

  @Post('mint')
  @Scopes('nft:mint')
  @ApiOperation({
    summary: 'Mint un NFT para un certificado',
    description: `Convierte un certificado emitido en un NFT ERC-721.
    
    El proceso incluye:
    1. Subir metadata del certificado a IPFS (Pinata)
    2. Minar el NFT en el contrato CertificateNFT
    3. Asociar el NFT con el certificado en la base de datos
    
    Requisitos:
    - El certificado debe estar en estado ISSUED
    - El certificado no debe tener NFT ya asociado
    - Debe estar configurado: NFT_CONTRACT_ADDRESS, PINATA_API_KEY, PINATA_SECRET_KEY`
  })
  @ApiResponse({
    status: 201,
    description: 'NFT minado exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tokenId: { type: 'string' },
        certificateId: { type: 'string' },
        contractAddress: { type: 'string' },
        ownerAddress: { type: 'string' },
        metadataURI: { type: 'string', example: 'ipfs://Qm...' },
        ipfsHash: { type: 'string' },
        txHash: { type: 'string' },
        status: { type: 'string', enum: ['MINTED'] },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Certificado no encontrado' })
  @ApiResponse({ status: 400, description: 'Error en el proceso de mint' })
  async mint(@Body() mintDto: MintNFTDto) {
    return this.nftService.mintNFT(mintDto.certificateId, mintDto.ownerAddress);
  }

  @Get('token/:tokenId')
  @Scopes('nft:read')
  @ApiOperation({
    summary: 'Obtener NFT por tokenId',
    description: 'Retorna la información completa de un NFT incluyendo el certificado asociado'
  })
  @ApiParam({
    name: 'tokenId',
    description: 'Token ID del NFT',
    example: '123',
  })
  @ApiResponse({ status: 200, description: 'NFT encontrado' })
  @ApiResponse({ status: 404, description: 'NFT no encontrado' })
  async getByTokenId(@Param('tokenId') tokenId: string) {
    return this.nftService.getNFTByTokenId(tokenId);
  }

  @Get('certificate/:certificateId')
  @Scopes('nft:read')
  @ApiOperation({
    summary: 'Obtener NFT por certificateId',
    description: 'Retorna el NFT asociado a un certificado específico'
  })
  @ApiParam({
    name: 'certificateId',
    description: 'ID del certificado',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'NFT encontrado' })
  @ApiResponse({ status: 404, description: 'No se encontró NFT para este certificado' })
  async getByCertificateId(@Param('certificateId') certificateId: string) {
    return this.nftService.getNFTByCertificateId(certificateId);
  }

  @Get('owner/:address')
  @Scopes('nft:read')
  @ApiOperation({
    summary: 'Listar NFTs de un propietario',
    description: 'Retorna todos los NFTs que pertenecen a una dirección Ethereum'
  })
  @ApiParam({
    name: 'address',
    description: 'Dirección Ethereum del propietario',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @ApiResponse({ status: 200, description: 'Lista de NFTs' })
  async getByOwner(@Param('address') address: string) {
    return this.nftService.getNFTsByOwner(address);
  }

  @Post('transfer')
  @Scopes('nft:transfer')
  @ApiOperation({
    summary: 'Transferir NFT',
    description: 'Transfiere un NFT a otra dirección Ethereum. Solo el propietario actual puede transferir.'
  })
  @ApiResponse({ status: 200, description: 'NFT transferido exitosamente' })
  @ApiResponse({ status: 404, description: 'NFT no encontrado' })
  @ApiResponse({ status: 400, description: 'Error en la transferencia' })
  async transfer(@Body() transferDto: TransferNFTDto) {
    return this.nftService.transferNFT(transferDto.tokenId, transferDto.to);
  }

  @Get()
  @Scopes('nft:read')
  @ApiOperation({
    summary: 'Listar todos los NFTs',
    description: 'Retorna todos los NFTs minados en el sistema'
  })
  @ApiResponse({ status: 200, description: 'Lista de NFTs' })
  async findAll() {
    return this.nftService.findAll();
  }

  @Post('anchor')
  @Scopes('nft:anchor')
  @ApiOperation({
    summary: 'Anclar NFTs a blockchain',
    description: `Ancla múltiples NFTs a blockchain usando un Merkle tree, similar al proceso de anclaje de certificados.
    
    El proceso incluye:
    1. Verificar que los NFTs estén en estado MINTED
    2. Calcular hashes de los NFTs (basados en tokenId, contractAddress y hash del certificado)
    3. Construir un Merkle tree con los hashes
    4. Anclar el root del Merkle tree a blockchain
    5. Generar Merkle proofs para cada NFT
    6. Actualizar los NFTs con el proof de anclaje
    
    Requisitos:
    - Los NFTs deben estar en estado MINTED
    - Los certificados asociados deben tener hash calculado
    - Debe estar configurado: ETHEREUM_PRIVATE_KEY, BESU_RPC_URL o ETHEREUM_RPC_URL`
  })
  @ApiBody({ type: AnchorNFTDto })
  @ApiResponse({
    status: 201,
    description: 'NFTs anclados exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        rootHash: { type: 'string' },
        txHash: { type: 'string' },
        blockchain: { type: 'string' },
        status: { type: 'string', enum: ['CONFIRMED'] },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Error en el proceso de anclaje' })
  async anchorNFTs(@Body() anchorDto: AnchorNFTDto) {
    try {
      // Validar tamaño de lote
      if (anchorDto.certificateIds.length > 100) {
        throw new BadRequestException('El lote no puede superar 100 NFTs');
      }
      // Validar duplicados
      const unique = new Set(anchorDto.certificateIds);
      if (unique.size !== anchorDto.certificateIds.length) {
        throw new BadRequestException('No se permiten IDs duplicados en el lote');
      }
      
      return await this.nftService.anchorNFTs(anchorDto.certificateIds, anchorDto.blockchain);
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error?.message || 'Error al anclar NFTs: ' + String(error)
      );
    }
  }

  @Post('issue-and-anchor')
  @Scopes('nft:issue')
  @ApiOperation({
    summary: 'Emitir certificados, anclarlos, minar NFTs y anclarlos (todo en uno)',
    description: `Proceso completo en un solo endpoint, similar a /groups/:id/issue-and-anchor pero para NFTs:
    
    1. Emite certificados usando una plantilla
    2. Ancla los certificados a blockchain
    3. Mina NFTs para cada certificado
    4. Ancla los NFTs a blockchain
    
    Este endpoint realiza todo el flujo completo en una sola llamada, ideal para automatización.
    El formato es consistente con el endpoint de grupos, pero incluye el proceso de NFTs.
    
    Requisitos:
    - Template debe existir
    - Debe estar configurado: NFT_CONTRACT_ADDRESS, PINATA_API_KEY, PINATA_SECRET_KEY, ETHEREUM_PRIVATE_KEY
    - BESU_RPC_URL o ETHEREUM_RPC_URL configurado`
  })
  @ApiBody({ type: IssueAndAnchorNFTDto })
  @ApiResponse({
    status: 201,
    description: 'Proceso completo exitoso',
    schema: {
      type: 'object',
      properties: {
        certificates: {
          type: 'array',
          description: 'Certificados emitidos y anclados',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string', enum: ['ISSUED'] },
              credentialUuid: { type: 'string' },
              hash: { type: 'string' },
              anchorId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        },
        certificateAnchor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            rootHash: { type: 'string' },
            txHash: { type: 'string' },
            blockchain: { type: 'string', example: 'besu' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        nfts: {
          type: 'array',
          description: 'NFTs minados',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tokenId: { type: 'string' },
              certificateId: { type: 'string' },
              contractAddress: { type: 'string' },
              ownerAddress: { type: 'string' },
              metadataURI: { type: 'string' },
              status: { type: 'string', enum: ['MINTED'] }
            }
          }
        },
        nftAnchor: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            rootHash: { type: 'string' },
            txHash: { type: 'string' },
            blockchain: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        credentialJsons: {
          type: 'array',
          description: 'JSONs de cada certificado (Blockcerts para EdTech, Verifiable Credential estándar para otras verticales)',
          items: {
            type: 'object',
            properties: {
              certificateId: { type: 'string' },
              credentialUuid: { type: 'string' },
              blockcertsJson: { type: 'object', description: 'Solo para EdTech' },
              credentialJson: { type: 'object', description: 'Para otras verticales' },
              error: { type: 'string', description: 'Si hubo error al obtener el JSON' }
            }
          }
        },
        errors: {
          type: 'array',
          nullable: true,
          description: 'Errores durante el proceso (si los hay)',
          items: {
            type: 'object',
            properties: {
              certificateId: { type: 'string' },
              error: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Error en algún paso del proceso' })
  async issueAndAnchorNFTs(@Body() dto: IssueAndAnchorNFTDto) {
    try {
      return await this.nftService.issueAndAnchorNFTs(
        dto.templateId,
        dto.recipients,
        dto.ownerAddress, // Opcional
        dto.blockchain || 'besu'
      );
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error?.message || 'Error en el proceso completo: ' + String(error)
      );
    }
  }
}




