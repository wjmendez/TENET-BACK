import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString, IsIn } from 'class-validator';

export class AnchorNFTDto {
  @ApiProperty({ 
    example: ['cert-123-uuid', 'cert-456-uuid'], 
    description: 'IDs de certificados cuyos NFTs se anclarán. Los NFTs deben estar en estado MINTED.',
    type: [String]
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  certificateIds: string[];

  @ApiProperty({ 
    example: 'besu', 
    description: 'Red blockchain para anclar: besu, sepolia, local, mocknet',
    enum: ['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet']
  })
  @IsString()
  @IsIn(['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet'])
  blockchain: string;
}

