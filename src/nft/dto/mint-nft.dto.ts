import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEthereumAddress } from 'class-validator';

export class MintNFTDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del certificado a tokenizar'
  })
  @IsString()
  @IsNotEmpty()
  certificateId: string;

  @ApiProperty({
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Dirección Ethereum del propietario del NFT'
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  ownerAddress: string;
}




