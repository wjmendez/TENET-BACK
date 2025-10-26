import { ApiProperty } from '@nestjs/swagger';

class RecipientDto {
  @ApiProperty({ example: 'Ana' })
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  apellido: string;

  @ApiProperty({ example: 'NestJS' })
  curso: string;

  @ApiProperty({ example: '2025-09-17' })
  fecha: string;
}

export class IssueBatchDto {
  @ApiProperty({ example: 'TEMPLATE_ID' })
  templateId: string;

  @ApiProperty({ type: [RecipientDto] })
  recipients: RecipientDto[];
}
