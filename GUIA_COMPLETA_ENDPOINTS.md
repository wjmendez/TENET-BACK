# 📚 Guía Completa de Endpoints - Cert Backend API

Esta guía te enseñará cómo usar todos y cada uno de los endpoints del sistema para comenzar con las pruebas.

## 🚀 Inicio Rápido

**Base URL:** `http://localhost:3100`  
**Swagger UI:** `http://localhost:3100/docs`  
**Health Check:** `GET /` → Retorna "Hello World!"

---

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#1-configuración-inicial)
2. [Gestión de Verticals](#2-gestión-de-verticals)
3. [Gestión de Issuers (DIDs)](#3-gestión-de-issuers-dids)
4. [Gestión de Templates](#4-gestión-de-templates)
5. [Gestión de Credential Types](#5-gestión-de-credential-types)
6. [Emisión de Credenciales](#6-emisión-de-credenciales)
7. [Anclaje a Blockchain](#7-anclaje-a-blockchain)
8. [Bundles (EdTech)](#8-bundles-edtech)
9. [Smart Medals (SportsTech)](#9-smart-medals-sportstech)
10. [Endpoints Blockcerts](#10-endpoints-blockcerts)

---

## 1. Configuración Inicial

### 1.1 Health Check
```bash
GET /
```
**Respuesta:**
```json
"Hello World!"
```

---

## 2. Gestión de Verticals

Las verticales representan diferentes dominios de negocio (EdTech, SportsTech, etc.).

### 2.1 Crear Vertical
```bash
POST /verticals
Content-Type: application/json

{
  "name": "EdTech",
  "slug": "edtech",
  "description": "Educación - Certificados académicos",
  "config": {
    "blockchain": "besu",
    "privacyLevel": "public",
    "didMethod": "did:web",
    "features": ["bundle", "open_badges"]
  },
  "isActive": true
}
```

**Ejemplo para SportsTech:**
```json
{
  "name": "SportsTech",
  "slug": "sportstech",
  "description": "Deportes - Medallas y certificados deportivos",
  "config": {
    "blockchain": "besu",
    "privacyLevel": "public",
    "didMethod": "did:web",
    "features": ["smart-medal", "nft"]
  },
  "isActive": true
}
```

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "EdTech",
  "slug": "edtech",
  "description": "Educación - Certificados académicos",
  "config": { ... },
  "isActive": true,
  "createdAt": "2024-01-25T12:00:00Z"
}
```

### 2.2 Listar Verticals
```bash
GET /verticals
GET /verticals?all=true  # Incluye inactivas
```

### 2.3 Obtener Vertical por Slug
```bash
GET /verticals/edtech
```

### 2.4 Actualizar Configuración de Vertical
```bash
PUT /verticals/{id}/config
Content-Type: application/json

{
  "blockchain": "sepolia",
  "privacyLevel": "public",
  "features": ["bundle", "open_badges", "nft"]
}
```

### 2.5 Activar/Desactivar Vertical
```bash
PUT /verticals/{id}/active
Content-Type: application/json

{
  "isActive": false
}
```

---

## 3. Gestión de Issuers (DIDs)

Los issuers son las instituciones que emiten certificados. Cada issuer tiene un DID único.

### 3.1 Crear Issuer (DID se genera automáticamente)
```bash
POST /issuers
Content-Type: application/json

{
  "name": "Universidad Ejemplo",
  "url": "https://universidad-ejemplo.com",
  "logo": "https://universidad-ejemplo.com/logo.png"
}
```

**⚠️ IMPORTANTE:** El campo `did` es **opcional**. Si no lo proporcionas, el sistema genera automáticamente un DID único usando Veramo.

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "did": "did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440000",
  "name": "Universidad Ejemplo",
  "url": "https://universidad-ejemplo.com",
  "logo": "https://universidad-ejemplo.com/logo.png",
  "publicKeyJwk": { ... },
  "createdAt": "2024-01-25T12:00:00Z"
}
```

**Guarda el `did`** - lo necesitarás para emitir certificados.

### 3.2 Listar Issuers
```bash
GET /issuers
```

### 3.3 Obtener Issuer por ID
```bash
GET /issuers/{id}
```

### 3.4 Obtener DID Document (W3C DID Core)
```bash
GET /issuers/{id}/did.json
```

**Respuesta:** Documento DID completo según estándar W3C DID Core.

### 3.5 Obtener Issuer Profile (Blockcerts)
```bash
GET /issuers/{id}/issuer.json
```

**Respuesta:** Perfil del issuer en formato Blockcerts.

### 3.6 Obtener Revocation List
```bash
GET /issuers/{id}/revocationList.json
```

---

## 4. Gestión de Templates

Los templates definen el diseño y estructura de los certificados.

### 4.1 Crear Template (Método Recomendado: JSON-LD Completo)

```bash
POST /templates
Content-Type: application/json

{
  "name": "Diploma Universitario",
  "description": "Template para diplomas universitarios",
  "jsonLd": {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/blockcerts/v3.1",
      {
        "display": "https://w3id.org/blockcerts#display",
        "displayHtml": "https://w3id.org/blockcerts#displayHtml"
      }
    ],
    "type": ["VerifiableCredential", "BlockcertsCredential"],
    "issuer": {
      "id": "{issuerDid}",
      "name": "{issuerName}"
    },
    "issuanceDate": "{{date}}",
    "credentialSubject": {
      "id": "mailto:{{email}}",
      "name": "{{studentName}}",
      "courseName": "{{courseName}}",
      "certificate": {
        "design": {
          "type": "canvas",
          "elements": [
            {
              "type": "text",
              "content": "CERTIFICADO DE LOGRO",
              "x": 600,
              "y": 100,
              "fontSize": 48,
              "fontWeight": "bold",
              "color": "#0369a1"
            },
            {
              "type": "text",
              "content": "Se otorga a",
              "x": 600,
              "y": 200,
              "fontSize": 20,
              "color": "#64748b"
            },
            {
              "type": "text",
              "content": "{{studentName}}",
              "x": 600,
              "y": 300,
              "fontSize": 56,
              "fontWeight": "bold",
              "color": "#1e293b"
            },
            {
              "type": "text",
              "content": "Por completar exitosamente el curso",
              "x": 600,
              "y": 400,
              "fontSize": 24,
              "color": "#475569"
            },
            {
              "type": "text",
              "content": "{{courseName}}",
              "x": 600,
              "y": 470,
              "fontSize": 32,
              "fontWeight": "bold",
              "color": "#0369a1"
            }
          ]
        }
      }
    },
    "display": {
      "contentMediaType": "text/html",
      "content": "<div>...</div>"
    }
  }
}
```

**Variables soportadas:**
- **Issuer:** `{issuerDid}`, `{issuerName}`, `{issuerUrl}`, `{issuerLogo}`
- **Recipient:** `{{studentName}}`, `{{email}}`, `{{courseName}}`, `{{date}}`, `{{qrUrl}}`

### 4.2 Crear Template (Método Simple: Solo Canvas)

```bash
POST /templates
Content-Type: application/json

{
  "name": "Diploma Simple",
  "description": "Template simple con canvas",
  "canvas": {
    "type": "canvas",
    "elements": [
      {
        "type": "text",
        "content": "CERTIFICADO",
        "x": 600,
        "y": 100,
        "fontSize": 48,
        "fontWeight": "bold"
      },
      {
        "type": "text",
        "content": "{{studentName}}",
        "x": 600,
        "y": 300,
        "fontSize": 56
      }
    ]
  }
}
```

El sistema genera automáticamente el JSON-LD completo.

### 4.3 Listar Templates
```bash
GET /templates
```

### 4.4 Obtener Template por ID
```bash
GET /templates/{id}
```

### 4.5 Eliminar Template
```bash
DELETE /templates/{id}
```

---

## 5. Gestión de Credential Types

Los credential types definen tipos de credenciales para cada vertical.

### 5.1 Crear Credential Type
```bash
POST /credential-types
Content-Type: application/json

{
  "verticalId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Diploma",
  "type": "VC_STATIC",
  "schema": {
    "type": "object",
    "properties": {
      "studentName": { "type": "string" },
      "courseName": { "type": "string" },
      "email": { "type": "string", "format": "email" }
    },
    "required": ["studentName", "courseName", "email"]
  },
  "displayConfig": {
    "template": "diploma-template",
    "colors": {
      "primary": "#0369a1",
      "secondary": "#64748b"
    }
  },
  "isActive": true
}
```

**Tipos disponibles:**
- `VC_STATIC`: Verifiable Credential estático
- `VC_DYNAMIC`: Verifiable Credential dinámico
- `NFT_STATIC`: NFT estático
- `NFT_DYNAMIC`: NFT dinámico (Smart Medal)
- `BUNDLE`: Bundle de credenciales

### 5.2 Listar Credential Types
```bash
GET /credential-types
GET /credential-types?verticalId={id}
GET /credential-types?all=true
```

### 5.3 Obtener Credential Type por ID
```bash
GET /credential-types/{id}
```

### 5.4 Actualizar Credential Type
```bash
PUT /credential-types/{id}
Content-Type: application/json

{
  "name": "Diploma Actualizado",
  "schema": { ... }
}
```

---

## 6. Emisión de Credenciales

### 6.1 Emitir Credencial (Endpoint Principal)
```bash
POST /credentials/issue
Content-Type: application/json

{
  "verticalId": "550e8400-e29b-41d4-a716-446655440000",
  "templateId": "550e8400-e29b-41d4-a716-446655440001",
  "issuerDid": "did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440002",
  "recipientData": {
    "studentName": "Juan Pérez",
    "email": "juan@example.com",
    "courseName": "Ingeniería de Software"
  }
}
```

**Respuesta:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "templateId": "550e8400-e29b-41d4-a716-446655440001",
    "verticalId": "550e8400-e29b-41d4-a716-446655440000",
    "issuerDid": "did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440002",
    "status": "PENDING",
    "credentialUuid": "urn:uuid:...",
    "createdAt": "2024-01-25T12:00:00Z"
  }
]
```

**⚠️ IMPORTANTE:**
- El certificado se crea con estado `PENDING`
- Está firmado con Veramo (proof de Veramo)
- Para EdTech: Necesita anclaje para agregar MerkleProof2019
- Para otras verticales: Solo necesita anclaje si quieres anclarlo a blockchain

### 6.2 Listar Credenciales
```bash
GET /credentials
GET /credentials?verticalId={id}
```

### 6.3 Obtener Credencial en Formato Blockcerts (Solo EdTech)
```bash
GET /credentials/{id}/blockcerts
```

**Respuesta:** Credencial completa con MerkleProof2019 (requiere anclaje previo).

---

## 7. Anclaje a Blockchain

El anclaje agrega el MerkleProof2019 y ancla el certificado a blockchain.

### 7.1 Anclar Certificados
```bash
POST /anchors/approve
Content-Type: application/json

{
  "certificateIds": [
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004"
  ],
  "blockchain": "besu"
}
```

**Blockchains soportadas:**
- `besu`: Red Besu local o remota
- `sepolia`: Testnet de Ethereum Sepolia
- `mocknet`: Red mock (solo pruebas)

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "rootHash": "0x1234...abcd",
  "txHash": "0x5678...efgh",
  "blockchain": "besu",
  "status": "CONFIRMED",
  "certificates": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "status": "ISSUED",
      "hash": "abc123...",
      "merkleProof": { ... }
    }
  ],
  "createdAt": "2024-01-25T12:00:00Z"
}
```

**⚠️ IMPORTANTE:**
- Solo certificados con estado `PENDING` pueden ser anclados
- Máximo 100 certificados por lote
- Para EdTech: Genera MerkleProof2019 automáticamente
- Para otras verticales: Solo ancla el root (no genera MerkleProof2019)

### 7.2 Listar Anclajes
```bash
GET /anchors
```

---

## 8. Bundles (EdTech)

Los bundles agrupan múltiples credenciales (Diploma, Analítico, Carta de Recomendación).

### 8.1 Crear Bundle
```bash
POST /verticals/edtech/bundles
Content-Type: application/json

{
  "recipientId": "student-123",
  "templateIds": {
    "diploma": "550e8400-e29b-41d4-a716-446655440001",
    "analitico": "550e8400-e29b-41d4-a716-446655440002",
    "cartaRecomendacion": "550e8400-e29b-41d4-a716-446655440003"
  },
  "recipientData": {
    "studentName": "Juan Pérez",
    "email": "juan@example.com",
    "courseName": "Ingeniería de Software",
    "graduationDate": "2024-01-25",
    "gpa": "3.8"
  },
  "issuerDid": "did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440002"
}
```

**⚠️ REQUISITOS:**
- La vertical debe tener `features: ["bundle"]` habilitado
- El slug en la URL determina la vertical automáticamente

### 8.2 Obtener Bundle
```bash
GET /verticals/edtech/bundles/{id}
```

### 8.3 Anclar Bundle
```bash
POST /verticals/edtech/bundles/{id}/anchor
Content-Type: application/json

{
  "blockchain": "besu"
}
```

### 8.4 Verificar Bundle
```bash
GET /verticals/edtech/bundles/{id}/verify
```

---

## 9. Smart Medals (SportsTech)

Los Smart Medals son NFTs dinámicos que cambian según datos externos (tiempos de carrera).

### 9.1 Crear Smart Medal
```bash
POST /verticals/sportstech/smart-medals
Content-Type: application/json

{
  "templateId": "550e8400-e29b-41d4-a716-446655440001",
  "issuerDid": "did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440002",
  "eventData": {
    "eventName": "Maratón de Buenos Aires",
    "participantName": "María González",
    "participantEmail": "maria@example.com",
    "eventId": "marathon-ba-2024",
    "participantId": "runner-123",
    "thresholds": {
      "gold": 120,    // minutos
      "silver": 150,
      "bronze": 180
    },
    "timingApiUrl": "https://timing-api.example.com/events/marathon-ba-2024/participants/runner-123"
  }
}
```

**⚠️ REQUISITOS:**
- La vertical debe tener `features: ["smart-medal"]` habilitado
- El timingApiUrl debe retornar JSON con `time` (en minutos)

### 9.2 Actualizar Smart Medal desde Timing
```bash
POST /verticals/sportstech/smart-medals/{id}/update
```

Consulta el sistema de timing y actualiza la medalla según el tiempo.

### 9.3 Obtener Estado del Smart Medal
```bash
GET /verticals/sportstech/smart-medals/{id}/status
```

**Respuesta:**
```json
{
  "medalType": "gold",
  "time": 115,
  "thresholds": { ... },
  "lastUpdate": "2024-01-25T12:00:00Z"
}
```

### 9.4 Obtener Historial de Actualizaciones
```bash
GET /verticals/sportstech/smart-medals/{id}/history
```

---

## 10. Endpoints Blockcerts

Endpoints estándar de Blockcerts para verificación.

### 10.1 Obtener Credencial (Estándar Blockcerts)
```bash
GET /credentials/{id}
```

Retorna la credencial en formato Blockcerts completo (solo EdTech con anclaje).

### 10.2 Listar Credenciales de una Vertical
```bash
GET /verticals/{slug}/credentials
GET /verticals/{slug}/credentials?status=ISSUED
```

### 10.3 Obtener Credencial de una Vertical
```bash
GET /verticals/{slug}/credentials/{id}
```

---

## 🔄 Flujo Completo de Prueba

### Paso 1: Crear Vertical
```bash
POST /verticals
{
  "name": "EdTech",
  "slug": "edtech",
  "config": { "features": ["bundle"] }
}
```
**Guarda:** `verticalId`

### Paso 2: Crear Issuer
```bash
POST /issuers
{
  "name": "Mi Universidad",
  "url": "https://universidad.com"
}
```
**Guarda:** `issuerDid`

### Paso 3: Crear Template
```bash
POST /templates
{
  "name": "Diploma",
  "jsonLd": { ... }
}
```
**Guarda:** `templateId`

### Paso 4: Emitir Credencial
```bash
POST /credentials/issue
{
  "verticalId": "...",
  "templateId": "...",
  "issuerDid": "...",
  "recipientData": {
    "studentName": "Juan Pérez",
    "email": "juan@example.com",
    "courseName": "Ingeniería"
  }
}
```
**Guarda:** `certificateId`

### Paso 5: Anclar Certificado
```bash
POST /anchors/approve
{
  "certificateIds": ["..."],
  "blockchain": "besu"
}
```

### Paso 6: Obtener Certificado Blockcerts
```bash
GET /credentials/{certificateId}/blockcerts
```

---

## 📝 Notas Importantes

1. **DIDs:** Se generan automáticamente, no necesitas proporcionarlos al crear issuers
2. **Variables:** Usa `{{variable}}` para datos del recipient y `{variable}` para datos del issuer
3. **Features:** Las features de verticales (`bundle`, `smart-medal`) deben estar habilitadas en `config.features`
4. **Estados:** Los certificados pasan por `PENDING` → `ISSUED` (después del anclaje)
5. **Blockchains:** Usa `besu` para desarrollo local, `sepolia` para pruebas en testnet

---

## 🐛 Troubleshooting

### Error: "Vertical not found or feature not enabled"
- Verifica que la vertical existe: `GET /verticals/{slug}`
- Verifica que tiene la feature habilitada: `config.features` debe incluir la feature requerida

### Error: "DID not found in Veramo"
- El DID se recrea automáticamente al consultarlo
- Si persiste, verifica que el issuer existe: `GET /issuers/{id}`

### Error: "Certificate not anchored yet"
- Debes anclar el certificado primero: `POST /anchors/approve`
- Solo certificados con estado `ISSUED` pueden retornarse en formato Blockcerts

---

## 📚 Recursos Adicionales

- **Swagger UI:** `http://localhost:3100/docs`
- **Blockcerts Verifier:** `http://localhost:3100/verifier.html`
- **Documentación W3C DID Core:** https://www.w3.org/TR/did-core/
- **Documentación Blockcerts:** https://www.blockcerts.org/

---

¡Listo para comenzar! 🚀







