import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNumber, IsObject, IsOptional } from 'class-validator';

export class CreateSmartMedalDto {
  @ApiProperty({
    description: 'ID de la vertical (SportsTech)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  verticalId: string;

  @ApiProperty({
    description: 'ID del template para el Smart Medal',
    example: 'template-id-123',
  })
  @IsString()
  templateId: string;

  @ApiProperty({
    description: 'DID de Veramo del usuario que emite (requerido)',
    example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  issuerDid: string;

  @ApiProperty({
    description: 'Datos del evento deportivo',
    example: {
      eventName: 'Maratón de Buenos Aires 2024',
      participantName: 'Juan Pérez',
      participantEmail: 'juan.perez@example.com',
      eventId: 'maraton-ba-2024',
      participantId: 'participant-123',
      thresholds: {
        gold: 7200, // 2 horas en segundos
        silver: 9000, // 2.5 horas
        bronze: 10800, // 3 horas
      },
      timingApiUrl: 'https://timing-api.example.com',
    },
  })
  @IsObject()
  eventData: {
    eventName: string;
    participantName: string;
    participantEmail: string;
    eventId: string;
    participantId: string;
    thresholds: {
      gold: number;
      silver: number;
      bronze: number;
    };
    timingApiUrl?: string;
  };
}

