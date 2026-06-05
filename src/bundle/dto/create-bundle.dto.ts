import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, IsEmail } from 'class-validator';

export class CreateBundleDto {
  @ApiProperty({
    description: 'ID de la vertical (EdTech)',
    example: 'd738b078-bfda-4584-bd26-edc0c408b290',
  })
  @IsString()
  verticalId: string;

  @ApiProperty({
    description: 'Identificador del destinatario (email, DID, etc.)',
    example: 'estudiante@universidad.edu',
  })
  @IsString()
  recipientId: string;

  @ApiProperty({
    description: 'IDs de los templates para cada credencial del bundle',
    example: {
      diploma: 'template-id-1',
      analitico: 'template-id-2',
      cartaRecomendacion: 'template-id-3',
    },
  })
  @IsObject()
  templateIds: {
    diploma: string;
    analitico: string;
    cartaRecomendacion?: string;
  };

  @ApiProperty({
    description: 'Datos del destinatario para todas las credenciales',
    example: {
      name: 'Juan Pérez',
      email: 'juan.perez@universidad.edu',
      studentId: '12345',
      graduationDate: '2024-12-15',
      degree: 'Ingeniería en Sistemas',
      gpa: '8.5',
    },
  })
  @IsObject()
  recipientData: {
    name: string;
    email: string;
    [key: string]: any;
  };

  @ApiProperty({
    description: 'DID de Veramo del usuario que emite (requerido)',
    example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  issuerDid: string;
}

