import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty, IsEthereumAddress, IsIn, IsOptional } from 'class-validator';

export class IssueAndAnchorNFTDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la plantilla de certificado'
  })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({
    example: [
      {
        studentName: 'Javier Salvatierra',
        studentDid: 'mailto:javiersalvatierra44@gmail.com',
        email: 'javiersalvatierra44@gmail.com',
        courseName: 'Blockchain Fundamentals',
        date: '2025-12-08T12:00:00Z'
      }
    ],
    description: 'Lista de destinatarios para los certificados',
    type: 'array'
  })
  @IsArray()
  @ArrayNotEmpty()
  recipients: any[];

  @ApiProperty({
    example: '0x627306090abaB3A6e1400e9345bC60c78a8BEf57',
    description: 'Dirección Ethereum del propietario de los NFTs. Si no se proporciona, se usará NFT_OWNER_ADDRESS del .env o la dirección del issuer. También puede especificarse por recipient usando el campo "ownerAddress" o "walletAddress".',
    required: false
  })
  @IsEthereumAddress()
  @IsOptional()
  ownerAddress?: string;

  @ApiProperty({
    example: 'besu',
    description: 'Red blockchain para anclar: besu, sepolia, local, mocknet',
    enum: ['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet'],
    required: false,
    default: 'besu'
  })
  @IsString()
  @IsIn(['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet'])
  @IsOptional()
  blockchain?: string;
}

