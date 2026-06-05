import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para crear una plantilla de certificado
 * 
 * La plantilla puede incluir:
 * - Un jsonLd completo con estructura de VerifiableCredential (recomendado)
 *   El canvas se convierte automáticamente a displayHtml (estándar Blockcerts)
 * - Un canvas con diseño visual (opcional, solo para entrada)
 *   Si se proporciona sin jsonLd, se generará un jsonLd completo automáticamente
 *   Si se proporciona con jsonLd, se convertirá a displayHtml y se agregará al jsonLd
 *   El canvas NO se guarda como campo separado, se convierte a HTML en displayHtml
 * - Variables que se extraen automáticamente del jsonLd
 * 
 * Nota: displayHtml es el estándar Blockcerts para presentación visual y no afecta la verificación.
 * 
 * @example
 * {
 *   "name": "Certificado Moderno",
 *   "description": "Plantilla con diseño visual integrado",
 *   "jsonLd": {
 *     "@context": ["https://www.w3.org/2018/credentials/v1", "https://w3id.org/blockcerts/v3"],
 *     "type": ["VerifiableCredential", "BlockcertsCredential"],
 *     "issuer": {
 *       "id": "{issuerDid}",
 *       "name": "{issuerName}",
 *       "url": "{issuerUrl}",
 *       "image": "{issuerLogo}"
 *     },
 *     "issuanceDate": "{{date}}",
 *     "credentialSubject": {
 *       "id": "{{studentDid}}",
 *       "name": "{{studentName}}",
 *       "achievement": {
 *         "type": "CourseCompletion",
 *         "name": "{{courseName}}"
 *       }
 *     },
 *     "displayHtml": "<div>...</div>"
 *   }
 * }
 */
/**
 * Información del emisor (business) que se integrará en el jsonLd
 */
class IssuerInfoDto {
  @ApiProperty({
    example: 'did:example:123456',
    description: 'DID (Decentralized Identifier) único del emisor. Ej: did:example:123456, did:web:example.com, did:key:z6Mk...'
  })
  did: string;

  @ApiProperty({
    example: 'Mi Organización',
    description: 'Nombre del emisor'
  })
  name: string;

  @ApiProperty({
    example: 'https://example.com',
    required: false,
    description: 'URL del sitio web del emisor'
  })
  url?: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    required: false,
    description: 'URL del logo del emisor'
  })
  logo?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ 
    example: 'Certificado Moderno',
    description: 'Nombre de la plantilla'
  })
  name: string;

  @ApiProperty({ 
    example: 'Plantilla de certificado con diseño visual integrado', 
    required: false,
    description: 'Descripción opcional de la plantilla'
  })
  description?: string;

  @ApiProperty({
    type: IssuerInfoDto,
    required: false,
    description: `Información del emisor (business) que se integrará automáticamente en el jsonLd.
    
Si se proporciona, esta información se usará para reemplazar las variables del issuer en el jsonLd:
- {issuerDid} → business.did
- {issuerName} → business.name
- {issuerUrl} → business.url
- {issuerLogo} → business.logo

Si no se proporciona, se usarán las variables de entorno del sistema.`
  })
  business?: IssuerInfoDto;

  @ApiProperty({
    example: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/blockcerts/v3'
      ],
      type: ['VerifiableCredential', 'BlockcertsCredential'],
      issuer: {
        id: '{issuerDid}',
        name: '{issuerName}',
        url: '{issuerUrl}',
        image: '{issuerLogo}'
      },
      issuanceDate: '{{date}}',
      credentialSubject: {
        id: '{{studentDid}}',
        name: '{{studentName}}',
        achievement: {
          type: 'CourseCompletion',
          name: '{{courseName}}'
        },
        certificate: {
          version: '1.0',
          metadata: {
            title: 'Certificado Moderno',
            type: 'Certificate'
          }
        },
        displayHtml: '<div style="width: 1200px; height: 850px; background-color: #f0f9ff;">...</div>'
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: '{{date}}',
        verificationMethod: '{issuerDid}#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: '{{firmaDigital}}'
      }
    },
    type: 'object',
    additionalProperties: true,
    description: `Esquema JSON-LD completo de VerifiableCredential con variables.
    
Variables soportadas:
- Issuer: {issuerDid}, {issuerName}, {issuerUrl}, {issuerLogo}
- Recipient: {{studentName}}, {{studentDid}}, {{email}}, {{courseName}}, {{date}}, {{qrUrl}}
- Proof: {{firmaDigital}}

Formato de variables: Se soportan tanto {{variable}} como {variable}.
Si no se proporciona, se puede generar automáticamente desde el canvas.

Nota: El diseño visual del canvas se convierte automáticamente a displayHtml (estándar Blockcerts)
cuando se proporciona un canvas. displayHtml no afecta la verificación del certificado.`
  })
  jsonLd?: Record<string, any>;

  @ApiProperty({ 
    example: ['studentName', 'studentDid', 'courseName', 'date', 'qrUrl'], 
    type: [String],
    required: false,
    description: `Lista de variables usadas en la plantilla.
Si no se proporciona, se extraen automáticamente del jsonLd
buscando patrones {{variable}} o {variable}.`
  })
  variables?: string[];

  @ApiProperty({
    example: {
      version: '1.0',
      metadata: {
        title: 'Certificado Moderno',
        type: 'Certificate',
        createdAt: '2025-11-30T22:40:09.915Z',
        updatedAt: '2025-11-30T22:42:17.436Z'
      },
      canvas: {
        width: 1200,
        height: 850,
        backgroundColor: '#f0f9ff'
      },
      objects: [
        {
          id: 'recipient',
          type: 'text',
          text: '{{studentName}}',
          x: 219,
          y: 178,
          fontSize: 56,
          fontFamily: 'Manrope',
          fill: '#1e293b',
          align: 'center',
          fontStyle: 'bold',
          width: 900
        },
        {
          id: 'qr-code',
          type: 'qr',
          x: 1021,
          y: 670,
          width: 150,
          height: 150,
          qrData: '{{qrUrl}}',
          qrSize: 150
        }
      ]
    },
    type: 'object',
    additionalProperties: true,
    description: `Diseño visual del canvas (solo para entrada).
Si se proporciona sin jsonLd, se generará un jsonLd completo automáticamente.
Si se proporciona con jsonLd, se convertirá a HTML y se integrará en jsonLd.display.content.
El canvas NO se guarda como campo separado, solo se convierte a HTML.
Las variables en los objetos del canvas se procesan igual que en jsonLd.
Nota: Si se proporciona tanto 'html' como 'canvas', se priorizará 'html'.`
  })
  canvas?: Record<string, any>;

  @ApiProperty({
    example: '<div class="certificate-template" style="width: 1200px; height: 850px; background-color: #f0f9ff; position: relative; overflow: hidden;">...</div>',
    type: 'string',
    description: `HTML completo del template del certificado (solo para entrada).
Si se proporciona, se usará directamente en lugar de convertir desde canvas.
Se integrará en jsonLd.display.content (estándar W3C Verifiable Credentials).
El HTML NO se guarda como campo separado, solo dentro del jsonLd.
Las variables en el HTML se procesan igual que en jsonLd.
Nota: Si se proporciona tanto 'html' como 'canvas', se priorizará 'html'.`
  })
  html?: string;
}
