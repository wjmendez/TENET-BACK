import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Certificado Curso' })
  name: string;

  @ApiProperty({ example: 'Certificado de finalización', required: false })
  description?: string;

  @ApiProperty({
    example: { name: '{nombre} {apellido}', course: '{curso}', date: '{fecha}' },
    type: 'object',
    additionalProperties: true,
  })
  jsonLd: Record<string, any>;

  @ApiProperty({ example: ['nombre', 'apellido', 'curso', 'fecha'], type: [String] })
  variables: string[];

  @ApiProperty({ example: '/path/to/template/file', required: false })
  filePath?: string;
}
