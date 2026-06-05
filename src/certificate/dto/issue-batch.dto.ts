import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para los datos del destinatario del certificado
 * 
 * Soporta múltiples formatos de nombres de campos para compatibilidad:
 * - studentName, nombre, name
 * - studentDid, email (para DID)
 * - courseName, curso, course
 * - date, fecha
 * - qrUrl (opcional, se genera automáticamente si no se proporciona)
 */
class RecipientDto {
  @ApiProperty({ 
    example: 'Juan',
    description: 'Nombre del estudiante (también acepta: nombre, name, studentName)',
    required: false
  })
  nombre?: string;

  @ApiProperty({ 
    example: 'Pérez',
    description: 'Apellido del estudiante',
    required: false
  })
  apellido?: string;

  @ApiProperty({ 
    example: 'Juan Pérez',
    description: 'Nombre completo del estudiante (alternativa a nombre/apellido)',
    required: false
  })
  name?: string;

  @ApiProperty({ 
    example: 'Juan Pérez',
    description: 'Nombre del estudiante (formato preferido)',
    required: false
  })
  studentName?: string;

  @ApiProperty({ 
    example: 'did:example:student123',
    description: 'DID (Decentralized Identifier) del estudiante. Si no se proporciona, se genera como mailto:email',
    required: false
  })
  studentDid?: string;

  @ApiProperty({ 
    example: 'juan.perez@example.com',
    description: 'Email del estudiante (requerido si no se proporciona studentDid)'
  })
  email: string;

  @ApiProperty({ 
    example: 'NestJS Avanzado',
    description: 'Nombre del curso (también acepta: curso, course, courseName)',
    required: false
  })
  curso?: string;

  @ApiProperty({ 
    example: 'NestJS Avanzado',
    description: 'Nombre del curso (formato preferido)',
    required: false
  })
  course?: string;

  @ApiProperty({ 
    example: 'NestJS Avanzado',
    description: 'Nombre del curso (formato preferido)',
    required: false
  })
  courseName?: string;

  @ApiProperty({ 
    example: '2025-09-17',
    description: 'Fecha de emisión del certificado (formato ISO 8601 o fecha simple)',
    required: false
  })
  fecha?: string;

  @ApiProperty({ 
    example: '2025-09-17T10:00:00Z',
    description: 'Fecha de emisión del certificado (formato ISO 8601)',
    required: false
  })
  date?: string;

  @ApiProperty({ 
    example: 'https://example.com/certificates/abc123',
    description: 'URL del QR code para verificación. Si no se proporciona, se genera automáticamente',
    required: false
  })
  qrUrl?: string;

  @ApiProperty({ 
    example: 'cert-123',
    description: 'ID opcional del certificado (usado para generar qrUrl si no se proporciona)',
    required: false
  })
  id?: string;
}

/**
 * DTO para emitir un lote de certificados
 * 
 * @example
 * {
 *   "templateId": "550e8400-e29b-41d4-a716-446655440000",
 *   "recipients": [
 *     {
 *       "studentName": "Juan Pérez",
 *       "email": "juan@example.com",
 *       "courseName": "NestJS Avanzado",
 *       "date": "2025-09-17"
 *     },
 *     {
 *       "studentName": "María García",
 *       "email": "maria@example.com",
 *       "courseName": "NestJS Avanzado",
 *       "date": "2025-09-17"
 *     }
 *   ]
 * }
 */
export class IssueBatchDto {
  @ApiProperty({ 
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la plantilla a usar para generar los certificados'
  })
  templateId: string;

  @ApiProperty({ 
    type: [RecipientDto],
    description: 'Lista de destinatarios para los cuales se emitirán certificados',
    example: [
      {
        studentName: 'Juan Pérez',
        email: 'juan@example.com',
        courseName: 'NestJS Avanzado',
        date: '2025-09-17'
      }
    ]
  })
  recipients: RecipientDto[];
}
