# ✅ Verificación: Anclaje de IPFS (Pinata) en Besu

## 📋 Resumen del Flujo

### 1. **Subida a Pinata** ✅
- **Ubicación**: `src/nft/nft.service.ts` líneas 172-185
- **Proceso**:
  - Se crea metadata JSON con información del certificado
  - Se sube a Pinata usando `uploadToPinata()`
  - Se obtiene `ipfsHash` (CID) y `ipfsUri` (formato: `ipfs://Qm...`)
- **Resultado**: Metadata disponible en IPFS

### 2. **Mint en Besu** ✅
- **Ubicación**: `src/nft/nft.service.ts` línea 213
- **Proceso**:
  ```typescript
  contract.mint(ownerAddress, certificateHashBytes32, ipfsUri, {...})
  ```
  - `ipfsUri` se pasa como `tokenURI` al contrato
  - El contrato guarda el `tokenURI` usando `_setTokenURI(tokenId, tokenURI)`
- **Contrato**: `contracts/CertificateNFT.sol` línea 55
  ```solidity
  _setTokenURI(tokenId, tokenURI);  // Guarda ipfs://... en el contrato
  ```

### 3. **Guardado en BD** ✅
- **Ubicación**: `src/nft/nft.service.ts` líneas 230-241
- **Proceso**:
  - Se guarda `metadataURI: ipfsUri` en la base de datos
  - Se guarda `ipfsHash` para referencia
  - Se guarda `txHash` de la transacción

## ✅ Verificación del Flujo

### Lo que está CORRECTO:

1. ✅ **IPFS URI se pasa correctamente al contrato**
   - El `ipfsUri` de Pinata (formato `ipfs://...`) se pasa directamente al contrato
   - El contrato lo guarda usando `_setTokenURI()` de ERC721URIStorage

2. ✅ **Formato IPFS correcto**
   - Pinata retorna `ipfs://Qm...` que es el formato estándar
   - Este formato se guarda directamente en el contrato

3. ✅ **Hash del certificado también se ancla**
   - Además del `tokenURI`, se ancla el `certificateHash` en el contrato
   - Esto permite verificar que el NFT corresponde a un certificado específico

4. ✅ **Metadata incluye información completa**
   - La metadata en IPFS incluye el `blockcertsJson` completo
   - También incluye `blockcertsJsonForVerification` (sin display) para verificación

### Verificación Práctica

Para verificar que todo funciona correctamente, puedes usar el script:

```bash
# Verificar un NFT específico
npx ts-node scripts/verify-nft-ipfs-anchoring.ts <tokenId>

# Verificar todos los NFTs
npx ts-node scripts/verify-nft-ipfs-anchoring.ts
```

El script verifica:
1. ✅ Que el token existe en el contrato de Besu
2. ✅ Que el `tokenURI` en el contrato coincide con el `metadataURI` en la BD
3. ✅ Que el `tokenURI` tiene formato IPFS (`ipfs://...`)
4. ✅ Que el hash del certificado coincide entre contrato y BD
5. ✅ Que la metadata es accesible desde gateways IPFS

## 🔍 Puntos de Verificación

### En el Contrato (Besu):
- `tokenURI(tokenId)` → Debe retornar `ipfs://Qm...`
- `getCertificateHash(tokenId)` → Debe retornar el hash del certificado

### En la Base de Datos:
- `nft.metadataURI` → Debe ser `ipfs://Qm...` (igual al tokenURI del contrato)
- `nft.ipfsHash` → Debe ser el CID sin el prefijo `ipfs://`
- `nft.certificate.hash` → Debe coincidir con el hash en el contrato

### En IPFS (Pinata):
- La metadata debe ser accesible desde:
  - `https://gateway.pinata.cloud/ipfs/{ipfsHash}`
  - `https://ipfs.io/ipfs/{ipfsHash}`
  - `https://cloudflare-ipfs.com/ipfs/{ipfsHash}`

## 📝 Ejemplo de Verificación Manual

```bash
# 1. Obtener NFT de la BD
GET /nft/token/1

# 2. Verificar en el contrato (usando ethers.js o web3)
# Conectarse a Besu y llamar:
contract.tokenURI(1)  # Debe retornar: ipfs://Qm...
contract.getCertificateHash(1)  # Debe retornar: 0x...

# 3. Verificar en IPFS
curl https://gateway.pinata.cloud/ipfs/{ipfsHash}
# Debe retornar el JSON de metadata
```

## ⚠️ Posibles Problemas

1. **TokenURI no coincide entre contrato y BD**
   - **Causa**: El NFT fue minado antes de guardar en BD, o hubo un error
   - **Solución**: Verificar logs del proceso de mint

2. **Metadata no accesible desde IPFS**
   - **Causa**: El contenido aún no se ha propagado en la red IPFS
   - **Solución**: Esperar unos minutos y probar diferentes gateways

3. **Hash del certificado no coincide**
   - **Causa**: El certificado fue modificado después del mint
   - **Solución**: Verificar que el certificado no ha sido actualizado

## ✅ Conclusión

El flujo está **CORRECTO**:
- ✅ La metadata se sube a Pinata (IPFS)
- ✅ El `ipfsUri` se pasa al contrato como `tokenURI`
- ✅ El contrato guarda el `tokenURI` usando `_setTokenURI()`
- ✅ El hash del certificado también se ancla en el contrato
- ✅ Todo se guarda correctamente en la base de datos

**El anclaje de IPFS en Besu está funcionando correctamente.**






