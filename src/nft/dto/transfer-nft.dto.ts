import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEthereumAddress } from 'class-validator';

export class TransferNFTDto {
  @ApiProperty({
    example: '123',
    description: 'Token ID del NFT a transferir'
  })
  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @ApiProperty({
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    description: 'Dirección Ethereum del nuevo propietario'
  })
  @IsEthereumAddress()
  @IsNotEmpty()
  to: string;
}




