# 🏆 Guía Completa: NFTs para SportsTech

Esta guía te enseñará cómo crear y anclar NFTs para la vertical SportsTech paso a paso.

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#1-requisitos-previos)
2. [Paso 1: Verificar/Crear Vertical SportsTech](#2-paso-1-verificarcrear-vertical-sportstech)
3. [Paso 2: Crear Issuer para SportsTech](#3-paso-2-crear-issuer-para-sportstech)
4. [Paso 3: Crear Template para SportsTech](#4-paso-3-crear-template-para-sportstech)
5. [Paso 4: Emitir, Anclar y Minar NFTs (Todo en Uno)](#5-paso-4-emitir-anclar-y-minar-nfts-todo-en-uno)
6. [Paso 5: Verificar NFTs Creados](#6-paso-5-verificar-nfts-creados)
7. [Flujo Alternativo: Paso a Paso](#7-flujo-alternativo-paso-a-paso)

---

## 1. Requisitos Previos

### Variables de Entorno Necesarias

Asegúrate de tener configurado en tu `.env`:

```bash
# Blockchain
BESU_RPC_URL=http://localhost:8545
ETHEREUM_PRIVATE_KEY=0x...  # Clave privada para firmar transacciones

# NFT Contract
NFT_CONTRACT_ADDRESS=0x...  # Dirección del contrato CertificateNFT desplegado

# IPFS (Pinata)
PINATA_API_KEY=tu_api_key
PINATA_SECRET_KEY=tu_secret_key

# NFT Owner (opcional, se puede especificar por request)
NFT_OWNER_ADDRESS=0x...  # Dirección que recibirá los NFTs por defecto
```

### Contrato NFT Desplegado

El contrato `CertificateNFT` debe estar desplegado en la blockchain. Si no lo tienes, puedes desplegarlo usando:

```bash
# Verificar si existe el script de despliegue
ls scripts/deploy-nft*.ts
```

---

## 2. Paso 1: Verificar/Crear Vertical SportsTech

### 2.1 Verificar si existe SportsTech

```bash
GET /verticals/sportstech
```

Si no existe, créala:

```bash
POST /verticals
Content-Type: application/json

{
  "name": "SportsTech",
  "slug": "sportstech",
  "description": "Deportes - Medallas y certificados deportivos",
  "config": {
    "blockchain": "besu",
    "privacyLevel": "public",
    "didMethod": "did:web",
    "features": ["nft", "smart-medal"]
  },
  "isActive": true
}
```

**Guarda:** `verticalId` de la respuesta

---

## 3. Paso 2: Crear Issuer para SportsTech

### 3.1 Crear Issuer

```bash
POST /issuers
Content-Type: application/json

{
  "name": "Sports Organization",
  "url": "https://sports.example.com",
  "logo": "https://sports.example.com/logo.png",
  "verticalId": "<verticalId_de_sportstech>"
}
```

**Guarda:** 
- `issuerId` de la respuesta
- `did` de la respuesta (ej: `did:web:localhost:3100:issuers:550e8400-e29b-41d4-a716-446655440000`)

---

## 4. Paso 3: Crear Template para SportsTech

### 4.1 Template Básico para Deportes

El template es similar a EdTech pero puede incluir campos específicos de deportes:

```bash
POST /templates
Content-Type: application/json

{
  "name": "Medalla Deportiva NFT",
  "description": "Template para medallas deportivas convertidas en NFT",
  "issuerId": "<issuerId>",
  "verticalId": "<verticalId_de_sportstech>",
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
      "name": "{issuerName}",
      "url": "{issuerUrl}",
      "image": "{issuerLogo}"
    },
    "issuanceDate": "{{date}}",
    "credentialSubject": {
      "id": "mailto:{{email}}",
      "name": "{{athleteName}}",
      "achievement": {
        "type": "SportsAchievement",
        "name": "{{eventName}}",
        "description": "{{achievementDescription}}",
        "eventDate": "{{eventDate}}",
        "position": "{{position}}",
        "category": "{{category}}"
      },
      "certificate": {
        "version": "1.0",
        "metadata": {
          "event": "{{eventName}}",
          "sport": "{{sportType}}",
          "category": "{{category}}"
        }
      }
    },
    "display": {
      "contentMediaType": "text/html",
      "content": "<div style=\"width: 100%; min-height: 850px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; color: white; text-align: center;\"><h1 style=\"font-size: 48px; margin-bottom: 20px;\">🏆 MEDALLA DEPORTIVA</h1><h2 style=\"font-size: 36px; margin-bottom: 30px;\">{{athleteName}}</h2><p style=\"font-size: 24px; margin-bottom: 20px;\">{{eventName}}</p><p style=\"font-size: 20px;\">{{achievementDescription}}</p><p style=\"font-size: 18px; margin-top: 30px;\">Fecha: {{eventDate}}</p></div>"
    }
  }
}
```

**Variables del Template:**
- `{issuerDid}`, `{issuerName}`, `{issuerUrl}`, `{issuerLogo}` - Datos del issuer
- `{{athleteName}}` - Nombre del atleta
- `{{email}}` - Email del atleta
- `{{eventName}}` - Nombre del evento
- `{{achievementDescription}}` - Descripción del logro
- `{{eventDate}}` - Fecha del evento
- `{{position}}` - Posición/ranking
- `{{category}}` - Categoría del evento
- `{{sportType}}` - Tipo de deporte
- `{{date}}` - Fecha de emisión

**Guarda:** `templateId` de la respuesta

---

## 5. Paso 4: Emitir, Anclar y Minar NFTs (Todo en Uno)

### 5.1 Endpoint Completo: `/nft/issue-and-anchor`

Este endpoint hace todo el proceso en una sola llamada:
1. ✅ Emite certificados usando el template
2. ✅ Ancla los certificados a blockchain
3. ✅ Mina NFTs para cada certificado
4. ✅ Ancla los NFTs a blockchain

```bash
POST /nft/issue-and-anchor
Content-Type: application/json

{
  "templateId": "<templateId>",
  "recipients": [
    {
      "athleteName": "María González",
      "email": "maria@example.com",
      "eventName": "Maratón de Buenos Aires 2024",
      "achievementDescription": "Completó la maratón en 3h 45min",
      "eventDate": "2024-01-15",
      "position": "1",
      "category": "Femenino 30-40",
      "sportType": "Running",
      "date": "2024-01-16T10:00:00Z",
      "ownerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"  // Opcional: dirección del propietario del NFT
    },
    {
      "athleteName": "Juan Pérez",
      "email": "juan@example.com",
      "eventName": "Maratón de Buenos Aires 2024",
      "achievementDescription": "Completó la maratón en 4h 10min",
      "eventDate": "2024-01-15",
      "position": "2",
      "category": "Masculino 30-40",
      "sportType": "Running",
      "date": "2024-01-16T10:00:00Z",
      "ownerAddress": "0x627306090abaB3A6e1400e9345bC60c78a8BEf57"  // Cada recipient puede tener su propia dirección
    }
  ],
  "ownerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",  // Opcional: dirección por defecto para todos los NFTs
  "blockchain": "besu"  // Opcional: besu, sepolia, local, testnet
}
```

**Respuesta:**

```json
{
  "certificates": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "status": "ISSUED",
      "credentialUuid": "uuid-del-certificado",
      "hash": "abc123...",
      "anchorId": "anchor-id-1",
      "createdAt": "2024-01-16T10:00:00Z"
    }
  ],
  "certificateAnchor": {
    "id": "anchor-id-1",
    "rootHash": "0x1234...abcd",
    "txHash": "0x5678...efgh",
    "blockchain": "besu",
    "status": "CONFIRMED",
    "createdAt": "2024-01-16T10:00:00Z"
  },
  "nfts": [
    {
      "id": "nft-id-1",
      "tokenId": "1",
      "certificateId": "550e8400-e29b-41d4-a716-446655440001",
      "contractAddress": "0x...",
      "ownerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "metadataURI": "ipfs://Qm...",
      "ipfsHash": "Qm...",
      "txHash": "0x...",
      "status": "MINTED"
    }
  ],
  "nftAnchor": {
    "id": "nft-anchor-id-1",
    "rootHash": "0x9876...dcba",
    "txHash": "0x5432...hgfe",
    "blockchain": "besu",
    "status": "CONFIRMED",
    "createdAt": "2024-01-16T10:00:00Z"
  },
  "blockcertsJsons": [
    {
      "certificateId": "550e8400-e29b-41d4-a716-446655440001",
      "credentialUuid": "uuid-del-certificado",
      "blockcertsJson": { ... }
    }
  ],
  "errors": null  // O array de errores si hubo alguno
}
```

**Guarda:**
- `certificateIds` de los certificados creados
- `tokenIds` de los NFTs minados
- `txHash` de las transacciones de anclaje

---

## 6. Paso 5: Verificar NFTs Creados

### 6.1 Obtener NFT por Token ID

```bash
GET /nft/token/{tokenId}
```

**Ejemplo:**
```bash
GET /nft/token/1
```

### 6.2 Obtener NFT por Certificate ID

```bash
GET /nft/certificate/{certificateId}
```

### 6.3 Listar NFTs de un Propietario

```bash
GET /nft/owner/{address}
```

**Ejemplo:**
```bash
GET /nft/owner/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### 6.4 Listar Todos los NFTs

```bash
GET /nft
```

---

## 7. Flujo Alternativo: Paso a Paso

Si prefieres hacer el proceso paso a paso en lugar de usar `/nft/issue-and-anchor`:

### 7.1 Emitir Certificados

```bash
POST /certificates/issue-batch
Content-Type: application/json

{
  "templateId": "<templateId>",
  "recipients": [
    {
      "athleteName": "María González",
      "email": "maria@example.com",
      "eventName": "Maratón de Buenos Aires 2024",
      ...
    }
  ],
  "issuerDid": "<issuerDid>"
}
```

**Guarda:** `certificateIds` de la respuesta

### 7.2 Anclar Certificados

```bash
POST /anchors/approve
Content-Type: application/json

{
  "certificateIds": ["<certificateId1>", "<certificateId2>"],
  "blockchain": "besu"
}
```

**Guarda:** `anchorId` y `txHash` de la respuesta

### 7.3 Minar NFTs

```bash
POST /nft/mint
Content-Type: application/json

{
  "certificateId": "<certificateId>",
  "ownerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

Repite este paso para cada certificado, o crea un script que lo haga en batch.

**Guarda:** `tokenId` de cada NFT

### 7.4 Anclar NFTs

```bash
POST /nft/anchor
Content-Type: application/json

{
  "certificateIds": ["<certificateId1>", "<certificateId2>"],
  "blockchain": "besu"
}
```

**Guarda:** `anchorId` y `txHash` de la respuesta

---

## 📝 Ejemplo Completo de Script

Aquí tienes un ejemplo completo usando `curl`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3100"

# 1. Verificar/Crear Vertical SportsTech
echo "1. Creando/Verificando Vertical SportsTech..."
VERTICAL_RESPONSE=$(curl -s -X POST "$BASE_URL/verticals" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SportsTech",
    "slug": "sportstech",
    "description": "Deportes - Medallas y certificados deportivos",
    "config": {
      "blockchain": "besu",
      "privacyLevel": "public",
      "didMethod": "did:web",
      "features": ["nft"]
    },
    "isActive": true
  }')
VERTICAL_ID=$(echo $VERTICAL_RESPONSE | jq -r '.id')
echo "Vertical ID: $VERTICAL_ID"

# 2. Crear Issuer
echo "2. Creando Issuer..."
ISSUER_RESPONSE=$(curl -s -X POST "$BASE_URL/issuers" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Sports Organization\",
    \"url\": \"https://sports.example.com\",
    \"verticalId\": \"$VERTICAL_ID\"
  }")
ISSUER_ID=$(echo $ISSUER_RESPONSE | jq -r '.id')
ISSUER_DID=$(echo $ISSUER_RESPONSE | jq -r '.did')
echo "Issuer ID: $ISSUER_ID"
echo "Issuer DID: $ISSUER_DID"

# 3. Crear Template
echo "3. Creando Template..."
TEMPLATE_RESPONSE=$(curl -s -X POST "$BASE_URL/templates" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Medalla Deportiva NFT\",
    \"description\": \"Template para medallas deportivas\",
    \"issuerId\": \"$ISSUER_ID\",
    \"verticalId\": \"$VERTICAL_ID\",
    \"jsonLd\": {
      \"@context\": [
        \"https://www.w3.org/2018/credentials/v1\",
        \"https://w3id.org/blockcerts/v3.1\"
      ],
      \"type\": [\"VerifiableCredential\", \"BlockcertsCredential\"],
      \"issuer\": {
        \"id\": \"{issuerDid}\",
        \"name\": \"{issuerName}\"
      },
      \"issuanceDate\": \"{{date}}\",
      \"credentialSubject\": {
        \"id\": \"mailto:{{email}}\",
        \"name\": \"{{athleteName}}\",
        \"achievement\": {
          \"type\": \"SportsAchievement\",
          \"name\": \"{{eventName}}\"
        }
      }
    }
  }")
TEMPLATE_ID=$(echo $TEMPLATE_RESPONSE | jq -r '.id')
echo "Template ID: $TEMPLATE_ID"

# 4. Emitir, Anclar y Minar NFTs
echo "4. Emitiendo, anclando y minando NFTs..."
NFT_RESPONSE=$(curl -s -X POST "$BASE_URL/nft/issue-and-anchor" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\",
    \"recipients\": [
      {
        \"athleteName\": \"María González\",
        \"email\": \"maria@example.com\",
        \"eventName\": \"Maratón de Buenos Aires 2024\",
        \"achievementDescription\": \"Completó la maratón\",
        \"eventDate\": \"2024-01-15\",
        \"date\": \"2024-01-16T10:00:00Z\",
        \"ownerAddress\": \"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\"
      }
    ],
    \"blockchain\": \"besu\"
  }")

echo "Respuesta completa:"
echo $NFT_RESPONSE | jq '.'

# Extraer información importante
TOKEN_IDS=$(echo $NFT_RESPONSE | jq -r '.nfts[].tokenId')
echo "Token IDs creados: $TOKEN_IDS"
```

---

## ⚠️ Notas Importantes

1. **Owner Address**: Puedes especificar `ownerAddress` a nivel global o por cada recipient. Si no se especifica, se usa `NFT_OWNER_ADDRESS` del `.env`.

2. **Blockchain**: Por defecto usa `besu` (local), pero puedes usar `sepolia` para testnet de Ethereum.

3. **Metadata IPFS**: Los NFTs suben automáticamente su metadata a IPFS usando Pinata. Asegúrate de tener las credenciales configuradas.

4. **Verificación**: Los NFTs pueden verificarse usando el `tokenId` o el `certificateId` asociado.

5. **Transferencia**: Los NFTs pueden transferirse usando `/nft/transfer` después de ser minados.

---

## 🔗 Endpoints Relacionados

- `GET /nft` - Listar todos los NFTs
- `GET /nft/token/:tokenId` - Obtener NFT por token ID
- `GET /nft/certificate/:certificateId` - Obtener NFT por certificate ID
- `GET /nft/owner/:address` - Listar NFTs de un propietario
- `POST /nft/transfer` - Transferir NFT a otra dirección
- `POST /nft/anchor` - Anclar NFTs (si no usaste issue-and-anchor)

---

## ✅ Checklist de Prueba

- [ ] Vertical SportsTech creada/verificada
- [ ] Issuer creado para SportsTech
- [ ] Template creado con campos de deportes
- [ ] Variables de entorno configuradas (NFT_CONTRACT_ADDRESS, PINATA, etc.)
- [ ] Contrato NFT desplegado en blockchain
- [ ] NFTs emitidos y anclados usando `/nft/issue-and-anchor`
- [ ] NFTs verificados usando `/nft/token/:tokenId`
- [ ] Metadata visible en IPFS

---

¡Listo! Ahora puedes crear NFTs para SportsTech. 🏆






