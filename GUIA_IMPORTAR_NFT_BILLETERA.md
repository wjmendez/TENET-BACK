# 🎫 Guía: Cómo Importar NFT a tu Billetera (MetaMask)

Esta guía te explica cómo importar los NFTs de certificados a tu billetera MetaMask (o cualquier billetera compatible con ERC-721).

## 📋 Información Necesaria

Para importar un NFT necesitas:
1. **Dirección del Contrato NFT** (`contractAddress`)
2. **Token ID** del NFT (`tokenId`)
3. **Chain ID** de la red (para Besu: `1337`)

## 🔍 Paso 1: Obtener la Información del NFT

Después de ejecutar el endpoint `/nft/issue-and-anchor`, la respuesta incluye la información de los NFTs minados:

```json
{
  "nfts": [
    {
      "id": "...",
      "tokenId": "1",
      "certificateId": "...",
      "contractAddress": "0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0",
      "ownerAddress": "0x627306090abaB3A6e1400e9345bC60c78a8BEf57",
      "metadataURI": "ipfs://Qm...",
      "status": "MINTED"
    }
  ]
}
```

**Guarda:**
- `tokenId`: El ID del token (ej: "1", "2", etc.)
- `contractAddress`: La dirección del contrato (ej: `0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0`)

### Alternativa: Obtener NFT por Token ID

Si ya tienes el `tokenId`, puedes obtener la información completa:

```bash
GET http://localhost:3100/nft/token/{tokenId}
```

Ejemplo:
```bash
curl http://localhost:3100/nft/token/1
```

### Obtener NFTs por Propietario

Si quieres ver todos los NFTs de una dirección:

```bash
GET http://localhost:3100/nft/owner/{address}
```

Ejemplo:
```bash
curl http://localhost:3100/nft/owner/0x627306090abaB3A6e1400e9345bC60c78a8BEf57
```

## 🔗 Paso 2: Configurar la Red Besu en MetaMask

Si aún no has agregado la red Besu a MetaMask:

1. Abre MetaMask
2. Haz clic en el menú de redes (arriba a la izquierda)
3. Haz clic en "Add Network" o "Agregar red"
4. Haz clic en "Add a network manually" o "Agregar una red manualmente"
5. Completa los siguientes datos:

```
Network Name: Besu Local
RPC URL: <url-rpc-de-besu>
Chain ID: 1337
Currency Symbol: ETH
Block Explorer URL: (dejar vacío)
```

6. Haz clic en "Save" o "Guardar"

**Nota:** El RPC URL puede cambiar si estás usando Cloudflare Tunnel. Verifica tu `BESU_RPC_URL` en el archivo `.env`.

## 📥 Paso 3: Importar el NFT en MetaMask

### Método 1: Importar Manualmente

1. Abre MetaMask
2. Asegúrate de estar conectado a la red Besu (Chain ID: 1337)
3. Asegúrate de estar usando la cuenta que recibió el NFT (`ownerAddress`)
4. Ve a la pestaña "NFTs" o "NFT" en MetaMask
5. Haz clic en "Import NFT" o "Importar NFT"
6. Completa los campos:
   - **Contract Address**: `0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0`
   - **Token ID**: El tokenId que obtuviste (ej: `1`)
7. Haz clic en "Import" o "Importar"

### Método 2: Usar el Enlace Directo

Puedes usar este formato de URL para abrir directamente en MetaMask:

```
https://metamask.app.link/dapp/[CONTRACT_ADDRESS]/[TOKEN_ID]
```

Ejemplo:
```
https://metamask.app.link/dapp/0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0/1
```

### Método 3: Desde el Explorador de Bloques

Si tienes un explorador de bloques configurado para Besu, puedes:
1. Ir a la página del contrato
2. Buscar el token por ID
3. Usar la opción "View in MetaMask" si está disponible

## ✅ Verificar que el NFT se Importó Correctamente

Después de importar, deberías ver:
- El NFT en la pestaña "NFTs" de MetaMask
- La imagen del certificado (si está disponible en IPFS)
- El nombre: "Certificate: [Nombre del Atleta]"
- Los atributos del certificado

## 🔍 Verificar Metadata del NFT

El NFT incluye metadata completa en IPFS. Puedes verla usando:

```bash
# Obtener la metadata URI del NFT
curl http://localhost:3100/nft/token/1 | jq '.metadataURI'

# Acceder a la metadata desde IPFS (usando gateway de Pinata)
# Reemplaza {ipfsHash} con el hash de IPFS
curl https://gateway.pinata.cloud/ipfs/{ipfsHash}
```

## 🎨 Ver la Imagen del NFT

La imagen del NFT está disponible en:
- **IPFS Gateway**: `https://gateway.pinata.cloud/ipfs/{imageIpfsHash}`
- **Metadata URI**: Incluida en el campo `image` de la metadata

## 📝 Información de Red Besu

- **Network Name**: Besu Local
- **Chain ID**: 1337
- **RPC URL**: (Verifica tu `BESU_RPC_URL` en `.env`)
- **Currency Symbol**: ETH
- **Block Explorer**: (Opcional, si tienes uno configurado)

## 🐛 Solución de Problemas

### El NFT no aparece después de importar

1. Verifica que estás en la red correcta (Besu, Chain ID: 1337)
2. Verifica que estás usando la cuenta correcta (`ownerAddress`)
3. Verifica que el `tokenId` es correcto
4. Verifica que el `contractAddress` es correcto: `0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0`

### Error: "Unable to locate NFT"

1. Verifica que el NFT fue minado correctamente:
   ```bash
   curl http://localhost:3100/nft/token/{tokenId}
   ```
2. Verifica que el contrato está desplegado en la red Besu
3. Verifica que la red Besu está funcionando correctamente

### La imagen no se muestra

1. Verifica que la metadata URI es accesible:
   ```bash
   curl {metadataURI}
   ```
2. Verifica que el gateway de IPFS está funcionando
3. Intenta usar otro gateway de IPFS (ej: `https://ipfs.io/ipfs/{hash}`)

## 📚 Recursos Adicionales

- **Obtener NFT por Token ID**: `GET /nft/token/{tokenId}`
- **Obtener NFT por Certificate ID**: `GET /nft/certificate/{certificateId}`
- **Listar NFTs de un Propietario**: `GET /nft/owner/{address}`
- **Transferir NFT**: `POST /nft/transfer`

## 🔐 Seguridad

- **Nunca compartas tu clave privada**
- **Verifica siempre la dirección del contrato antes de importar**
- **Usa solo redes de confianza para desarrollo**
- **En producción, usa redes públicas verificadas (Mainnet, Sepolia, etc.)**





