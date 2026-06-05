import { JsonRpcProvider, Wallet, Contract, Network } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carga el ABI del contrato CertificateNFT
 */
function loadContractABI(): any {
  // Buscar el ABI compilado en artifacts
  const artifactPath = path.join(
    __dirname,
    '../../artifacts/contracts/CertificateNFT.sol/CertificateNFT.json'
  );
  
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return artifact.abi;
  }
  
  // Si no existe, retornar ABI básico de ERC721 (fallback)
  return [
    'function mint(address to, bytes32 certificateHash, string memory tokenURI) external returns (uint256)',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'function tokenURI(uint256 tokenId) external view returns (string)',
    'function getCertificateHash(uint256 tokenId) external view returns (bytes32)',
    'function getTokenIdByHash(bytes32 certificateHash) external view returns (uint256)',
    'function nextTokenId() external view returns (uint256)',
    'function transferFrom(address from, address to, uint256 tokenId) external',
  ];
}

/**
 * Conecta al contrato CertificateNFT
 */
export async function getNFTContract(
  contractAddress: string,
  rpcUrl: string,
  privateKey: string
): Promise<Contract> {
  // Crear una red estática sin soporte para ENS
  const staticNetworkConfig: any = {
    name: 'besu-local',
    chainId: 1337, // ChainId común para redes locales (Besu)
    ensAddress: null, // Deshabilita la resolución de ENS
  };
  
  // Crear la red estática desde la configuración
  const staticNetwork = Network.from(staticNetworkConfig);
  (staticNetwork as any).ensAddress = null;
  
  // Crear provider con la red estática
  const provider = new JsonRpcProvider(rpcUrl, staticNetwork, {
    staticNetwork: staticNetwork,
  });
  
  // Sobrescribir métodos de ENS para que retornen null inmediatamente
  // sin intentar resolver. Usar 'as any' porque estos métodos pueden no estar en el tipo
  (provider as any).getEnsAddress = async (name: string) => {
    // Bloquear todas las llamadas a ENS retornando null inmediatamente
    return null;
  };
  
  (provider as any).resolveName = async (name: string) => {
    // Si es una dirección hexadecimal, normalizarla y retornarla directamente
    if (name && name.startsWith('0x') && name.length === 42) {
      // Usar getAddress para normalizar la dirección (checksum)
      try {
        const { getAddress } = await import('ethers');
        return getAddress(name);
      } catch {
        return name.toLowerCase();
      }
    }
    // Si no, retornar null (no intentar resolver ENS)
    return null;
  };
  
  // También sobrescribir _getAddress para que normalice direcciones sin intentar resolver ENS
  (provider as any)._getAddress = async (address: string) => {
    // Si es una dirección hexadecimal, normalizarla y retornarla
    if (address && address.startsWith('0x') && address.length === 42) {
      try {
        const { getAddress } = await import('ethers');
        return getAddress(address);
      } catch {
        return address.toLowerCase();
      }
    }
    // Si no, intentar resolver (pero esto no debería pasar si normalizamos antes)
    return address;
  };
  
  const wallet = new Wallet(privateKey, provider);
  const abi = loadContractABI();
  
  return new Contract(contractAddress, abi, wallet);
}

/**
 * Sube metadata a Pinata IPFS
 */
export async function uploadToPinata(
  metadata: any,
  pinataApiKey: string,
  pinataSecretKey: string
): Promise<{ ipfsHash: string; ipfsUri: string }> {
  const pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
  
  const response = await fetch(pinataUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretKey,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: `certificate-${metadata.certificate?.id || 'unknown'}`,
      },
      pinataOptions: {
        cidVersion: 1,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} ${error}`);
  }

  const result = await response.json() as { IpfsHash: string };
  const ipfsHash = result.IpfsHash;
  const ipfsUri = `ipfs://${ipfsHash}`;

  return { ipfsHash, ipfsUri };
}

/**
 * Convierte un hash hex a bytes32
 */
export function hexToBytes32(hex: string): string {
  // Remover 0x si existe
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  
  // Asegurar que tenga 64 caracteres (32 bytes)
  if (cleanHex.length !== 64) {
    throw new Error(`Hash must be 32 bytes (64 hex chars), got ${cleanHex.length}`);
  }
  
  return '0x' + cleanHex.toLowerCase();
}

/**
 * Obtiene el gateway de IPFS para una URI
 */
export function getIPFSGatewayUrl(ipfsUri: string, gateway: string = 'https://gateway.pinata.cloud/ipfs/'): string {
  if (!ipfsUri.startsWith('ipfs://')) {
    return ipfsUri;
  }
  
  const hash = ipfsUri.replace('ipfs://', '');
  return `${gateway}${hash}`;
}

/**
 * Convierte HTML del certificado a SVG para usar como imagen del NFT
 * Esto permite que MetaMask y otros visores muestren el certificado como imagen
 */
export function htmlToSvg(html: string, width: number = 1200, height: number = 850): string {
  // Escapar el HTML para incluirlo en SVG
  const escapedHtml = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Crear SVG con foreignObject para renderizar HTML
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px; margin: 0; padding: 0;">
      ${html}
    </div>
  </foreignObject>
</svg>`;

  return svg;
}

/**
 * Sube una imagen (SVG, PNG, etc.) a Pinata IPFS
 * Usa FormData y Blob nativos de Node.js 18+
 */
export async function uploadImageToPinata(
  imageData: string | Buffer,
  imageType: 'svg' | 'png' | 'jpg' = 'svg',
  pinataApiKey: string,
  pinataSecretKey: string,
  filename?: string
): Promise<{ ipfsHash: string; ipfsUri: string }> {
  const pinataUrl = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  
  // Determinar content type
  const contentType = imageType === 'svg' 
    ? 'image/svg+xml' 
    : imageType === 'png' 
    ? 'image/png' 
    : 'image/jpeg';

  // Node.js 18+ tiene FormData y Blob nativos
  const formData = new FormData();
  
  // Convertir datos a formato compatible para Blob
  // Usar casting para evitar problemas de tipos con Buffer
  const blobParts: any[] = [];
  if (typeof imageData === 'string') {
    blobParts.push(imageData);
  } else if (Buffer.isBuffer(imageData)) {
    // Convertir Buffer a ArrayBuffer para compatibilidad
    blobParts.push(imageData.buffer.slice(imageData.byteOffset, imageData.byteOffset + imageData.byteLength));
  } else {
    blobParts.push(imageData);
  }
  
  const blob = new Blob(blobParts, { type: contentType });
  
  formData.append('file', blob, filename || `certificate.${imageType}`);
  
  formData.append('pinataOptions', JSON.stringify({
    cidVersion: 1,
  }));
  
  formData.append('pinataMetadata', JSON.stringify({
    name: filename || `certificate-image-${Date.now()}.${imageType}`,
  }));

  const response = await fetch(pinataUrl, {
    method: 'POST',
    headers: {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataSecretKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinata image upload failed: ${response.status} ${error}`);
  }

  const result = await response.json() as { IpfsHash: string };
  const ipfsHash = result.IpfsHash;
  const ipfsUri = `ipfs://${ipfsHash}`;

  return { ipfsHash, ipfsUri };
}




