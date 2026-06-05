import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

export class AnchorBundleDto {
  @ApiProperty({
    description: 'Blockchain a usar para anclar',
    example: 'besu',
    enum: ['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet'],
  })
  @IsString()
  @IsIn(['besu', 'sepolia', 'eth-sepolia', 'local', 'mocknet', 'testnet'])
  blockchain: string;
}

