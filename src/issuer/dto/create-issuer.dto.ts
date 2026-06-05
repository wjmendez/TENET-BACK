import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para crear un nuevo issuer con DID generado automáticamente
 * 
 * **IMPORTANTE:** El DID se genera AUTOMÁTICAMENTE en el backend según estándar W3C did:web.
 * NO es necesario proporcionar el campo `did` - solo envía `name` (y opcionalmente `url` y `logo`).
 * 
 * Al crear un issuer, el backend genera automáticamente:
 * - Un DID único según estándar did:web (W3C DID Core)
 *   Formato: did:web:DOMINIO:issuers:UUID
 * - Un par de claves criptográficas secp256k1
 * - Un documento DID (DID Document) según W3C DID Core
 */
export class CreateIssuerDto {
  @ApiProperty({
    example: 'Mi Organización',
    description: 'Nombre de la institución/emisor (requerido)'
  })
  name: string;

  @ApiProperty({
    example: 'https://example.com',
    required: false,
    description: 'URL del sitio web de la institución'
  })
  url?: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    required: false,
    description: 'URL del logo de la institución'
  })
  logo?: string;

  @ApiProperty({
    example: 'did:web:example.com:issuers:550e8400-e29b-41d4-a716-446655440000',
    required: false,
    description: 'DID personalizado (OPCIONAL - NO RECOMENDADO para registro inicial). IMPORTANTE: NO envíes este campo si estás registrando un issuer por primera vez. El backend genera automáticamente un DID único usando Veramo. Solo proporciona un DID si ya tienes uno existente y quieres usarlo. Formato del DID generado automáticamente: did:web:DOMINIO:issuers:UUID'
  })
  did?: string;
}

