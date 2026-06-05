# ✅ Contrato NFT Desplegado - Próximos Pasos

## 🎉 Contrato Desplegado Exitosamente

**Contract Address:** `0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0`  
**Network:** Besu (RPC: `<url-rpc-de-besu>`)  
**Owner:** `0x627306090abaB3A6e1400e9345bC60c78a8BEf57`

## ✅ Configuración Actualizada

El archivo `.env` ya tiene configurado:
```bash
NFT_CONTRACT_ADDRESS=0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0
BESU_RPC_URL=<url-rpc-de-besu>
BESU_PRE_FUNDED_KEY=<tu-clave-privada-en-.env>
PINATA_API_KEY=<tu-api-key-de-pinata>
PINATA_SECRET_KEY=<tu-secret-de-pinata>
```

## 🚀 Próximos Pasos para Probar NFTs

### 1. Verificar que el Backend esté corriendo

```bash
# Si no está corriendo, inícialo
npm run start:dev
```

### 2. Crear Vertical SportsTech (si no existe)

```bash
POST http://localhost:3100/verticals
Content-Type: application/json

{
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
}
```

### 3. Crear Issuer para SportsTech

```bash
POST http://localhost:3100/issuers
Content-Type: application/json

{
  "name": "Sports Organization",
  "url": "https://sports.example.com",
  "verticalId": "<verticalId_de_sportstech>"
}
```

**Guarda:** `issuerId` y `did` de la respuesta

### 4. Crear Template para SportsTech

```bash
POST http://localhost:3100/templates
Content-Type: application/json

{
  "name": "Medalla Deportiva NFT",
  "description": "Template para medallas deportivas",
  "issuerId": "<issuerId>",
  "verticalId": "<verticalId>",
  "jsonLd": {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/blockcerts/v3.1"
    ],
    "type": ["VerifiableCredential", "BlockcertsCredential"],
    "issuer": {
      "id": "{issuerDid}",
      "name": "{issuerName}"
    },
    "issuanceDate": "{{date}}",
    "credentialSubject": {
      "id": "mailto:{{email}}",
      "name": "{{athleteName}}",
      "achievement": {
        "type": "SportsAchievement",
        "name": "{{eventName}}"
      }
    }
  }
}
```

**Guarda:** `templateId` de la respuesta

### 5. Emitir, Anclar y Minar NFTs (Todo en Uno)

```bash
POST http://localhost:3100/nft/issue-and-anchor
Content-Type: application/json

{
  "templateId": "<templateId>",
  "recipients": [
    {
      "athleteName": "María González",
      "email": "maria@example.com",
      "eventName": "Maratón de Buenos Aires 2024",
      "achievementDescription": "Completó la maratón",
      "eventDate": "2024-01-15",
      "date": "2024-01-16T10:00:00Z",
      "ownerAddress": "0x627306090abaB3A6e1400e9345bC60c78a8BEf57"
    }
  ],
  "blockchain": "besu"
}
```

### 6. Verificar NFT Creado

```bash
# Obtener NFT por tokenId
GET http://localhost:3100/nft/token/1

# Obtener NFT por certificateId
GET http://localhost:3100/nft/certificate/<certificateId>

# Listar todos los NFTs
GET http://localhost:3100/nft
```

### 7. Verificar Anclaje de IPFS en Besu

```bash
# Verificar que el tokenURI está correctamente anclado
npx ts-node scripts/verify-nft-ipfs-anchoring.ts <tokenId>
```

## 📝 Checklist de Prueba

- [x] Contrato NFT desplegado en Besu
- [x] NFT_CONTRACT_ADDRESS configurado en .env
- [ ] Backend corriendo
- [ ] Vertical SportsTech creada
- [ ] Issuer creado
- [ ] Template creado
- [ ] NFT emitido y minado
- [ ] NFT verificado en el contrato
- [ ] IPFS metadata accesible

## 🔍 Verificación del Contrato

Puedes verificar el contrato en Besu usando:

```javascript
// Conectarse a Besu
const provider = new ethers.JsonRpcProvider('<url-rpc-de-besu>');
const contract = new ethers.Contract(
  '0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0',
  abi,
  provider
);

// Verificar funciones
await contract.nextTokenId(); // Debe retornar 1 (primer token disponible)
await contract.owner(); // Debe retornar 0x627306090abaB3A6e1400e9345bC60c78a8BEf57
```

## ⚠️ Notas Importantes

1. **Owner del Contrato**: El owner actual es la cuenta pre-fundada. Para producción, considera transferir la propiedad a una wallet que controles.

2. **Gas**: El contrato está configurado con un gas limit de 5M, suficiente para el despliegue y operaciones.

3. **IPFS**: Asegúrate de que Pinata esté configurado correctamente para subir metadata.

4. **Pruebas**: Puedes usar la cuenta pre-fundada (`0x627306090abaB3A6e1400e9345bC60c78a8BEf57`) como `ownerAddress` en los NFTs para pruebas.

## 🎯 Siguiente Paso

¡Ahora puedes proceder con las pruebas siguiendo la guía `GUIA_SPORTSTECH_NFT.md`!






