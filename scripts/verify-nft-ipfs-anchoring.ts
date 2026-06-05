/**
 * Script para verificar que los NFTs tienen correctamente anclado el tokenURI de IPFS en Besu
 * 
 * Este script:
 * 1. Obtiene un NFT de la base de datos
 * 2. Verifica que el tokenURI en el contrato de Besu coincide con el ipfsUri almacenado
 * 3. Verifica que el tokenURI es accesible desde IPFS
 * 4. Compara el hash del certificado en el contrato con el hash almacenado
 */

import { PrismaClient } from '@prisma/client';
import { JsonRpcProvider, Contract } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

/**
 * Carga el ABI del contrato CertificateNFT
 */
function loadContractABI(): any {
  const artifactPath = path.join(
    __dirname,
    '../artifacts/contracts/CertificateNFT.sol/CertificateNFT.json'
  );
  
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return artifact.abi;
  }
  
  // Fallback ABI
  return [
    'function tokenURI(uint256 tokenId) external view returns (string)',
    'function getCertificateHash(uint256 tokenId) external view returns (bytes32)',
    'function ownerOf(uint256 tokenId) external view returns (address)',
  ];
}

/**
 * Verifica que el tokenURI de un NFT está correctamente anclado en Besu
 */
async function verifyNFTIPFSAnchoring(tokenId: string) {
  console.log(`\n=== Verificando NFT Token ID: ${tokenId} ===\n`);
  
  // 1. Obtener NFT de la base de datos
  const nft = await prisma.nFT.findUnique({
    where: { tokenId },
    include: { certificate: true },
  });
  
  if (!nft) {
    console.error(`❌ NFT con tokenId ${tokenId} no encontrado en la base de datos`);
    return;
  }
  
  console.log('1. Información del NFT en BD:');
  console.log(`   - Token ID: ${nft.tokenId}`);
  console.log(`   - Contract Address: ${nft.contractAddress}`);
  console.log(`   - Owner Address: ${nft.ownerAddress}`);
  console.log(`   - IPFS Hash: ${nft.ipfsHash || 'NO DEFINIDO'}`);
  console.log(`   - Metadata URI: ${nft.metadataURI || 'NO DEFINIDO'}`);
  console.log(`   - Status: ${nft.status}`);
  console.log(`   - TX Hash: ${nft.txHash || 'NO DEFINIDO'}`);
  
  // 2. Conectar al contrato en Besu
  const contractAddress = nft.contractAddress;
  const rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';
  
  console.log(`\n2. Conectando a Besu:`);
  console.log(`   - RPC URL: ${rpcUrl}`);
  console.log(`   - Contract Address: ${contractAddress}`);
  
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const abi = loadContractABI();
    const contract = new Contract(contractAddress, abi, provider);
    
    // 3. Verificar que el token existe en el contrato
    console.log(`\n3. Verificando token en el contrato...`);
    let ownerAddress: string;
    try {
      ownerAddress = await contract.ownerOf(tokenId);
      console.log(`   ✅ Token existe en el contrato`);
      console.log(`   - Owner en contrato: ${ownerAddress}`);
      console.log(`   - Owner en BD: ${nft.ownerAddress}`);
      
      if (ownerAddress.toLowerCase() !== nft.ownerAddress.toLowerCase()) {
        console.log(`   ⚠️  ADVERTENCIA: El owner en el contrato no coincide con el de la BD`);
      } else {
        console.log(`   ✅ Owner coincide`);
      }
    } catch (error: any) {
      console.error(`   ❌ ERROR: Token no existe en el contrato: ${error.message}`);
      return;
    }
    
    // 4. Obtener tokenURI del contrato
    console.log(`\n4. Verificando tokenURI en el contrato...`);
    let contractTokenURI: string;
    try {
      contractTokenURI = await contract.tokenURI(tokenId);
      console.log(`   ✅ tokenURI obtenido del contrato`);
      console.log(`   - tokenURI en contrato: ${contractTokenURI}`);
      console.log(`   - metadataURI en BD: ${nft.metadataURI || 'NO DEFINIDO'}`);
      
      if (!nft.metadataURI) {
        console.log(`   ⚠️  ADVERTENCIA: No hay metadataURI en la BD para comparar`);
      } else if (contractTokenURI !== nft.metadataURI) {
        console.log(`   ❌ ERROR: El tokenURI en el contrato NO coincide con el metadataURI en la BD`);
        console.log(`      Contrato: ${contractTokenURI}`);
        console.log(`      BD:       ${nft.metadataURI}`);
      } else {
        console.log(`   ✅ tokenURI coincide entre contrato y BD`);
      }
      
      // Verificar formato IPFS
      if (contractTokenURI.startsWith('ipfs://')) {
        console.log(`   ✅ tokenURI tiene formato IPFS correcto (ipfs://...)`);
        const ipfsHash = contractTokenURI.replace('ipfs://', '');
        console.log(`   - IPFS Hash: ${ipfsHash}`);
        
        if (nft.ipfsHash && ipfsHash !== nft.ipfsHash) {
          console.log(`   ⚠️  ADVERTENCIA: El hash IPFS en el contrato no coincide con el de la BD`);
          console.log(`      Contrato: ${ipfsHash}`);
          console.log(`      BD:       ${nft.ipfsHash}`);
        } else if (nft.ipfsHash) {
          console.log(`   ✅ IPFS Hash coincide`);
        }
      } else {
        console.log(`   ⚠️  ADVERTENCIA: tokenURI no tiene formato IPFS (esperado: ipfs://...)`);
      }
    } catch (error: any) {
      console.error(`   ❌ ERROR al obtener tokenURI: ${error.message}`);
      return;
    }
    
    // 5. Verificar hash del certificado
    console.log(`\n5. Verificando hash del certificado...`);
    try {
      const contractCertHash = await contract.getCertificateHash(tokenId);
      const contractCertHashHex = contractCertHash.replace('0x', '');
      console.log(`   ✅ Hash del certificado obtenido del contrato`);
      console.log(`   - Hash en contrato: 0x${contractCertHashHex}`);
      
      if (nft.certificate.hash) {
        const dbCertHash = nft.certificate.hash.replace('0x', '').toLowerCase();
        const contractCertHashLower = contractCertHashHex.toLowerCase();
        
        console.log(`   - Hash en BD:      0x${dbCertHash}`);
        
        if (contractCertHashLower !== dbCertHash) {
          console.log(`   ❌ ERROR: El hash del certificado NO coincide`);
        } else {
          console.log(`   ✅ Hash del certificado coincide`);
        }
      } else {
        console.log(`   ⚠️  ADVERTENCIA: No hay hash del certificado en la BD para comparar`);
      }
    } catch (error: any) {
      console.error(`   ❌ ERROR al obtener hash del certificado: ${error.message}`);
    }
    
    // 6. Verificar accesibilidad de IPFS
    if (contractTokenURI.startsWith('ipfs://')) {
      console.log(`\n6. Verificando accesibilidad de IPFS...`);
      const ipfsHash = contractTokenURI.replace('ipfs://', '');
      const gatewayUrls = [
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
      ];
      
      let accessible = false;
      for (const gatewayUrl of gatewayUrls) {
        try {
          const response = await fetch(gatewayUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          if (response.ok) {
            console.log(`   ✅ Metadata accesible desde: ${gatewayUrl}`);
            accessible = true;
            
            // Intentar obtener el contenido para verificar
            try {
              const contentResponse = await fetch(gatewayUrl);
              if (contentResponse.ok) {
                const metadata = await contentResponse.json();
                console.log(`   ✅ Metadata JSON válido obtenido`);
                console.log(`   - Name: ${metadata.name || 'N/A'}`);
                console.log(`   - Description: ${metadata.description?.substring(0, 50) || 'N/A'}...`);
                if (metadata.certificate?.hash) {
                  console.log(`   - Certificate Hash en metadata: ${metadata.certificate.hash}`);
                }
              }
            } catch (error: any) {
              console.log(`   ⚠️  No se pudo obtener el contenido JSON: ${error.message}`);
            }
            break;
          }
        } catch (error: any) {
          // Continuar con el siguiente gateway
        }
      }
      
      if (!accessible) {
        console.log(`   ⚠️  ADVERTENCIA: No se pudo acceder a la metadata desde ningún gateway IPFS`);
        console.log(`   - Esto puede ser normal si el contenido aún no se ha propagado`);
      }
    }
    
    // 7. Resumen
    console.log(`\n=== RESUMEN ===`);
    console.log(`✅ Token existe en el contrato`);
    console.log(`${contractTokenURI.startsWith('ipfs://') ? '✅' : '⚠️ '} tokenURI tiene formato IPFS`);
    console.log(`${contractTokenURI === nft.metadataURI ? '✅' : '❌'} tokenURI coincide con BD`);
    console.log(`${nft.ipfsHash && contractTokenURI.includes(nft.ipfsHash) ? '✅' : '⚠️ '} IPFS Hash coincide`);
    
  } catch (error: any) {
    console.error(`\n❌ ERROR general: ${error.message}`);
    console.error(error.stack);
  }
}

/**
 * Verifica todos los NFTs minados
 */
async function verifyAllNFTs() {
  console.log(`\n=== Verificando todos los NFTs minados ===\n`);
  
  const nfts = await prisma.nFT.findMany({
    where: { status: 'MINTED' },
    include: { certificate: true },
    orderBy: { createdAt: 'desc' },
    take: 10, // Limitar a los últimos 10
  });
  
  if (nfts.length === 0) {
    console.log('No hay NFTs minados en la base de datos');
    return;
  }
  
  console.log(`Encontrados ${nfts.length} NFTs. Verificando...\n`);
  
  for (const nft of nfts) {
    await verifyNFTIPFSAnchoring(nft.tokenId);
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Ejecutar
const tokenId = process.argv[2];

if (tokenId) {
  verifyNFTIPFSAnchoring(tokenId)
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error(error);
      prisma.$disconnect();
      process.exit(1);
    });
} else {
  verifyAllNFTs()
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error(error);
      prisma.$disconnect();
      process.exit(1);
    });
}






