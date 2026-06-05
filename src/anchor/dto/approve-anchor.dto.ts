import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString, IsIn } from 'class-validator';

export class ApproveAnchorDto {
  @ApiProperty({ example: ['CERT_ID_1', 'CERT_ID_2'], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  certificateIds: string[];

  @ApiProperty({ example: 'besu', description: 'Blockchain network: sepolia, besu, local, testnet' })
  @IsString()
  @IsIn(['sepolia', 'besu', 'local', 'testnet'])
  blockchain: string;
}
