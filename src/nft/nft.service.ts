import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CertificateStatus, NFTStatus, AnchorStatus } from '@prisma/client';
import { getNFTContract, uploadToPinata, hexToBytes32, getIPFSGatewayUrl, htmlToSvg, uploadImageToPinata } from './nft.util.js';
import { CertificateService } from '../certificate/certificate.service.js';
import { AnchorService } from '../anchor/anchor.service.js';
import {
  sha256Canonical,
  buildMerkleWithDirectionalPaths,
  strip0x,
  ensure0x,
  resolveAnchorEncoding,
  buildBlinkAnchor
} from '../anchor/anchor.service.js';
import { anchorToSepolia } from '../certificate/eth-anchor-anchorcontract.util.js';
import { Encoder } from '@vaultie/lds-merkle-proof-2019';
import * as crypto from 'crypto';
import pino from 'pino';
import { getTenantId } from '../common/tenant/tenant-context.js';
import { prisma } from '../common/prisma/prisma.js';

const logger = pino({ name: 'NFTService' });

const METADATA_HISTORY_WHITELIST = new Set([
  'eventId',
  'medalTier',
  'score',
  'rank',
  'timestamp',
  'txHash',
  'ipfsHash',
  'proof',
  'status',
  'version',
]);

@Injectable()
export class NFTService {
  constructor(
    private certificateService: CertificateService,
    private anchorService: AnchorService
  ) {}

  /**
   * Mina un NFT para un certificado
   */
  async mintNFT(certificateId: string, ownerAddress: string) {
    const tenantId = getTenantId();
    // 1. Verificar que el certificado existe y está emitido
    const certificate = await prisma.certificate.findFirst({
      where: { id: certificateId, tenantId },
      include: { template: true },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificate ${certificateId} not found`);
    }

    if (certificate.status !== CertificateStatus.ISSUED) {
      throw new BadRequestException(
        `Certificate must be ISSUED before minting NFT. Current status: ${certificate.status}`
      );
    }

    // 2. Verificar que no tiene NFT ya
    const existingNFT = await prisma.nFT.findFirst({
      where: { certificateId, tenantId },
    });

    if (existingNFT) {
      throw new BadRequestException(`Certificate ${certificateId} already has an NFT (tokenId: ${existingNFT.tokenId})`);
    }

    // 3. Validar configuración
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';
    
    // Para minar, necesitamos la clave del owner del contrato
    // Prioridad: NFT_PRIVATE_KEY > BESU_PRE_FUNDED_KEY (si está configurada) > ETHEREUM_PRIVATE_KEY
    let privateKey = process.env.NFT_PRIVATE_KEY;
    if (!privateKey) {
      // Si hay BESU_PRE_FUNDED_KEY configurada, usarla (es la clave del owner del contrato en Besu)
      if (process.env.BESU_PRE_FUNDED_KEY) {
        privateKey = process.env.BESU_PRE_FUNDED_KEY;
        logger.info({ source: 'BESU_PRE_FUNDED_KEY' }, 'Usando BESU_PRE_FUNDED_KEY para minar NFT');
      } else {
        privateKey = process.env.ETHEREUM_PRIVATE_KEY;
        logger.info({ source: 'ETHEREUM_PRIVATE_KEY' }, 'Usando ETHEREUM_PRIVATE_KEY para minar NFT');
      }
    } else {
      logger.info({ source: 'NFT_PRIVATE_KEY' }, 'Usando NFT_PRIVATE_KEY para minar NFT');
    }
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    if (!contractAddress) {
      throw new BadRequestException('NFT_CONTRACT_ADDRESS not configured');
    }

    if (!privateKey) {
      throw new BadRequestException('NFT_PRIVATE_KEY or ETHEREUM_PRIVATE_KEY not configured');
    }

    if (!pinataApiKey || !pinataSecretKey) {
      throw new BadRequestException('PINATA_API_KEY and PINATA_SECRET_KEY must be configured');
    }

    // 4. Obtener la vertical del certificado para determinar el formato
    const vertical = certificate.verticalId
      ? await prisma.vertical.findFirst({ where: { id: certificate.verticalId, tenantId } })
      : null;
    
    const isEdTech = vertical?.slug === 'edtech';

    // 5. Calcular hash del certificado
    const certificateHash = await sha256Canonical(certificate.data);
    const certificateHashHex = certificateHash.toString('hex');
    const certificateHashBytes32 = hexToBytes32(certificateHashHex);

    // 6. Obtener JSON del certificado según la vertical
    let credentialJson: any;
    let credentialJsonForVerification: any;
    
    if (isEdTech) {
      // EdTech usa Blockcerts con MerkleProof2019
      credentialJson = await this.certificateService.getBlockcertsJson(certificateId);
      // Crear una copia sin display para verificación
      credentialJsonForVerification = JSON.parse(JSON.stringify(credentialJson));
      if (credentialJsonForVerification.display) {
        delete credentialJsonForVerification.display;
      }
      if (credentialJsonForVerification.displayHtml) {
        delete credentialJsonForVerification.displayHtml;
      }
    } else {
      // Otras verticales usan Verifiable Credential estándar (firmado por Veramo)
      credentialJson = certificate.data as any;
      credentialJsonForVerification = JSON.parse(JSON.stringify(credentialJson));
      // Remover campos de visualización si existen
      if (credentialJsonForVerification.display) {
        delete credentialJsonForVerification.display;
      }
      if (credentialJsonForVerification.displayHtml) {
        delete credentialJsonForVerification.displayHtml;
      }
    }

    // 7. Convertir HTML del certificado a SVG y subirlo a IPFS como imagen
    let imageIpfsUri: string | undefined;
    let imageIpfsHash: string | undefined;
    
    try {
      const displayHtml = credentialJson.displayHtml || credentialJson.display?.content || '';
      if (displayHtml) {
        const svg = htmlToSvg(displayHtml, 1200, 850);
        const imageResult = await uploadImageToPinata(
          svg,
          'svg',
          pinataApiKey,
          pinataSecretKey,
          `certificate-${certificateId}.svg`
        );
        imageIpfsUri = imageResult.ipfsUri;
        imageIpfsHash = imageResult.ipfsHash;
        logger.info({ certificateId, imageIpfsHash }, 'Imagen SVG del certificado subida a IPFS');
      }
    } catch (error: any) {
      logger.warn({ certificateId, error: error.message }, 'No se pudo generar imagen SVG, usando URL del certificado como fallback');
    }

    // 8. Extraer información del certificado según el formato
    const recipientName = credentialJson.credentialSubject?.name || 
                         credentialJson.credentialSubject?.athleteName ||
                         'Unknown';
    const issuerName = credentialJson.issuer?.name || 
                      (typeof credentialJson.issuer === 'string' ? credentialJson.issuer : 'Unknown Issuer');
    const issuanceDate = credentialJson.issuanceDate || credentialJson.issued || '';
    const credentialId = credentialJson.id || certificate.credentialUuid || certificateId;
    
    // URL de verificación según la vertical
    const verificationUrl = isEdTech
      ? `${appUrl}/certificates/${certificate.credentialUuid || certificateId}/blockcerts`
      : `${appUrl}/certificates/${certificate.credentialUuid || certificateId}`;

    // 9. Crear metadata para el NFT
    const metadata = {
      name: `Certificate: ${recipientName}`,
      description: isEdTech 
        ? `Blockcerts Verifiable Credential issued by ${issuerName}`
        : `Verifiable Credential issued by ${issuerName}`,
      // Usar imagen IPFS si está disponible, sino usar URL del certificado como fallback
      image: imageIpfsUri 
        ? `https://gateway.pinata.cloud/ipfs/${imageIpfsHash}` 
        : verificationUrl,
      external_url: verificationUrl,
      attributes: [
        {
          trait_type: 'Issuer',
          value: issuerName,
        },
        {
          trait_type: 'Recipient',
          value: recipientName,
        },
        {
          trait_type: 'Issue Date',
          value: issuanceDate,
        },
        {
          trait_type: 'Certificate ID',
          value: credentialId,
        },
      ],
      certificate: {
        id: credentialId,
        hash: certificateHashHex,
        verificationUrl: verificationUrl,
        credentialJson: credentialJson, // Con display para visualización
        credentialJsonForVerification: credentialJsonForVerification, // Sin display para verificación
      },
    };

    // 9. Subir metadata a Pinata
    logger.info({ certificateId }, 'Uploading metadata to Pinata...');
    let ipfsHash: string;
    let ipfsUri: string;

    try {
      const pinataResult = await uploadToPinata(metadata, pinataApiKey, pinataSecretKey);
      ipfsHash = pinataResult.ipfsHash;
      ipfsUri = pinataResult.ipfsUri;
      logger.info({ certificateId, ipfsHash, ipfsUri }, 'Metadata uploaded to Pinata');
    } catch (error: any) {
      logger.error({ certificateId, error: error.message }, 'Failed to upload to Pinata');
      throw new BadRequestException(`Failed to upload metadata to IPFS: ${error.message}`);
    }

    // 10. Conectar al contrato y minar NFT
    logger.info({ certificateId, ownerAddress, contractAddress }, 'Minting NFT...');
    let tokenId: string;
    let txHash: string;

    try {
      const contract = await getNFTContract(contractAddress, rpcUrl, privateKey);
      
      // Verificar que la wallet que está minando es el owner del contrato
      // El contract ya tiene el provider configurado correctamente, así que podemos usarlo directamente
      const contractOwner = await contract.owner();
      
      // Obtener el provider del contract para crear la wallet
      const contractProvider = contract.runner?.provider;
      if (!contractProvider) {
        throw new BadRequestException('Contract provider not available');
      }
      
      const { ethers } = await import('ethers');
      const wallet = new ethers.Wallet(privateKey, contractProvider as any);
      
      if (wallet.address.toLowerCase() !== contractOwner.toLowerCase()) {
        throw new BadRequestException(
          `La wallet usada (${wallet.address}) no es el owner del contrato (${contractOwner}). ` +
          `Usa NFT_PRIVATE_KEY con la clave del owner o configura BESU_PRE_FUNDED_KEY si es Besu.`
        );
      }
      
      // Obtener siguiente tokenId
      const nextId = await contract.nextTokenId();
      tokenId = nextId.toString();

      // Normalizar la dirección antes de pasarla al contrato
      // Usar isAddress para validar - es más flexible que validar longitud manualmente
      const { ethers: ethersLib } = await import('ethers');
      let normalizedOwnerAddress: string;
      
      // Convertir a string y validar formato básico
      const addressStr: string = String(ownerAddress || '');
      if (!addressStr || !addressStr.startsWith('0x')) {
        throw new BadRequestException(`Invalid owner address format: ${addressStr}. Must start with 0x`);
      }
      
      // Usar isAddress de ethers que valida correctamente el formato
      // Esto es más confiable que validar longitud manualmente
      if (!ethersLib.isAddress(addressStr)) {
        throw new BadRequestException(`Invalid owner address: ${addressStr}. Not a valid Ethereum address`);
      }
      
      // Normalizar a minúsculas primero, luego intentar checksum
      // Si el checksum falla, usar la dirección en minúsculas
      try {
        normalizedOwnerAddress = ethersLib.getAddress(addressStr.toLowerCase());
      } catch (error: any) {
        // Si getAddress falla, usar la dirección en minúsculas directamente
        // Esto puede pasar si la dirección tiene un checksum incorrecto
        logger.warn({ ownerAddress: addressStr, error: error.message }, 'Could not compute checksum, using lowercase address');
        normalizedOwnerAddress = addressStr.toLowerCase();
      }
      
      logger.info({ original: addressStr, normalized: normalizedOwnerAddress }, 'Address normalized');

      // Minar el NFT
      const tx = await contract.mint(normalizedOwnerAddress, certificateHashBytes32, ipfsUri, {
        gasLimit: 300000n,
      });

      logger.info({ certificateId, txHash: tx.hash }, 'NFT mint transaction sent');
      
      // Esperar confirmación
      const receipt = await tx.wait();
      txHash = receipt.hash;

      logger.info({ certificateId, tokenId, txHash }, 'NFT minted successfully');
    } catch (error: any) {
      logger.error({ certificateId, error: error.message }, 'Failed to mint NFT');
      throw new BadRequestException(`Failed to mint NFT: ${error.message}`);
    }

    // 10. Guardar NFT en la base de datos
    const nft = await prisma.nFT.create({
      data: {
        tenantId,
        tokenId,
        certificateId,
        contractAddress,
        ownerAddress,
        metadataURI: ipfsUri,
        ipfsHash,
        txHash,
        status: NFTStatus.MINTED,
      },
    });

    return {
      ...nft,
      metadata,
      ipfsGatewayUrl: getIPFSGatewayUrl(ipfsUri),
    };
  }

  /**
   * Obtiene información de un NFT por tokenId
   */
  async getNFTByTokenId(tokenId: string) {
    const tenantId = getTenantId();
    const nft = await prisma.nFT.findFirst({
      where: { tokenId, tenantId },
      include: { certificate: { include: { template: true } } },
    });

    if (!nft) {
      throw new NotFoundException(`NFT with tokenId ${tokenId} not found`);
    }

    return nft;
  }

  /**
   * Obtiene NFT asociado a un certificado
   */
  async getNFTByCertificateId(certificateId: string) {
    const tenantId = getTenantId();
    const nft = await prisma.nFT.findFirst({
      where: { certificateId, tenantId },
      include: { certificate: { include: { template: true } } },
    });

    if (!nft) {
      throw new NotFoundException(`No NFT found for certificate ${certificateId}`);
    }

    return nft;
  }

  /**
   * Lista NFTs de un propietario
   */
  async getNFTsByOwner(ownerAddress: string) {
    const tenantId = getTenantId();
    return prisma.nFT.findMany({
      where: { ownerAddress: ownerAddress.toLowerCase(), tenantId },
      include: { certificate: { include: { template: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Actualiza metadata de un NFT en IPFS
   * Útil para NFTs dinámicos como Smart Medal
   * 
   * @param tokenId Token ID del NFT
   * @param newMetadata Nueva metadata a subir
   * @returns Nueva metadata URI y hash
   */
  async updateNFTMetadata(tokenId: string, newMetadata: any): Promise<{ ipfsHash: string; ipfsUri: string }> {
    const tenantId = getTenantId();
    const nft = await prisma.nFT.findFirst({
      where: { tokenId, tenantId },
      include: { certificate: true },
    });

    if (!nft) {
      throw new NotFoundException(`NFT with tokenId ${tokenId} not found`);
    }

    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;

    if (!pinataApiKey || !pinataSecretKey) {
      throw new BadRequestException('PINATA_API_KEY and PINATA_SECRET_KEY must be configured');
    }

    // Guardar metadata anterior en historial
    const previousMetadata = nft.metadataHistory
      ? (nft.metadataHistory as any[])
      : [];
    const sanitizedHistory = this.sanitizeMetadataHistory(previousMetadata, tokenId);
    
    // Obtener metadata actual desde IPFS si existe
    if (nft.metadataURI) {
      try {
        const gatewayUrl = getIPFSGatewayUrl(nft.metadataURI);
        const response = await fetch(gatewayUrl);
        if (response.ok) {
          const currentMetadata = await response.json();
          const sanitizedEntry = this.buildSanitizedHistoryEntry(
            {
              timestamp: new Date().toISOString(),
              metadata: currentMetadata,
              ipfsHash: nft.ipfsHash,
              ipfsUri: nft.metadataURI,
            },
            tokenId,
          );
          sanitizedHistory.push(sanitizedEntry);
        }
      } catch (error) {
        // Si no se puede obtener, continuar sin historial anterior
        logger.warn({ tokenId, error }, 'Could not fetch current metadata from IPFS');
      }
    }

    // Subir nueva metadata a Pinata
    logger.info({ tokenId }, 'Uploading updated metadata to Pinata...');
    const { uploadToPinata } = await import('./nft.util.js');
    const pinataResult = await uploadToPinata(newMetadata, pinataApiKey, pinataSecretKey);

    // Actualizar NFT en BD con nueva metadata
    await prisma.nFT.update({
      where: { tokenId },
      data: {
        tenantId,
        metadataURI: pinataResult.ipfsUri,
        ipfsHash: pinataResult.ipfsHash,
        metadataHistory: sanitizedHistory,
      },
    });

    logger.info({ tokenId, ipfsHash: pinataResult.ipfsHash }, 'NFT metadata updated successfully');

    return {
      ipfsHash: pinataResult.ipfsHash,
      ipfsUri: pinataResult.ipfsUri,
    };
  }

  private sanitizeMetadataHistory(history: any[], tokenId: string) {
    if (!Array.isArray(history)) {
      return [];
    }

    return history.map((entry) => this.buildSanitizedHistoryEntry(entry, tokenId));
  }

  private buildSanitizedHistoryEntry(entry: any, tokenId: string) {
    if (!entry || typeof entry !== 'object') {
      return {};
    }

    const baseEntry: Record<string, any> = {
      timestamp: entry.timestamp,
      ipfsHash: entry.ipfsHash,
      ipfsUri: entry.ipfsUri,
    };

    const { sanitized, removedKeys } = this.filterMetadataForHistory(entry.metadata);
    if (removedKeys.length) {
      logger.warn({ tokenId, removedKeys }, 'Removed non-whitelisted keys from metadataHistory');
    }
    if (sanitized && Object.keys(sanitized).length) {
      baseEntry.metadata = sanitized;
    }

    return baseEntry;
  }

  private filterMetadataForHistory(metadata: unknown): { sanitized: Record<string, any> | null; removedKeys: string[] } {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { sanitized: null, removedKeys: [] };
    }

    const sanitized: Record<string, any> = {};
    const removedKeys: string[] = [];

    for (const [key, value] of Object.entries(metadata)) {
      if (METADATA_HISTORY_WHITELIST.has(key)) {
        sanitized[key] = value;
      } else {
        removedKeys.push(key);
      }
    }

    return { sanitized, removedKeys };
  }

  /**
   * Transfiere un NFT a otra dirección
   */
  async transferNFT(tokenId: string, to: string) {
    const tenantId = getTenantId();
    // 1. Verificar que el NFT existe
    const nft = await prisma.nFT.findFirst({
      where: { tokenId, tenantId },
    });

    if (!nft) {
      throw new NotFoundException(`NFT with tokenId ${tokenId} not found`);
    }

    if (nft.status !== NFTStatus.MINTED) {
      throw new BadRequestException(`NFT is not in MINTED status (current: ${nft.status})`);
    }

    // 2. Validar configuración
    const privateKey = process.env.NFT_PRIVATE_KEY || process.env.ETHEREUM_PRIVATE_KEY;
    const rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';

    if (!privateKey) {
      throw new BadRequestException('NFT_PRIVATE_KEY or ETHEREUM_PRIVATE_KEY not configured');
    }

    // 3. Conectar al contrato y transferir
    try {
      const contract = await getNFTContract(nft.contractAddress, rpcUrl, privateKey);
      
      // Obtener el propietario actual del contrato
      const currentOwner = await contract.ownerOf(tokenId);
      
      // Transferir
      const tx = await contract.transferFrom(currentOwner, to, tokenId, {
        gasLimit: 200000n,
      });

      logger.info({ tokenId, from: currentOwner, to, txHash: tx.hash }, 'NFT transfer transaction sent');
      
      // Esperar confirmación
      const receipt = await tx.wait();
      const txHash = receipt.hash;

      // 4. Actualizar en BD
      const updatedNFT = await prisma.nFT.update({
        where: { tokenId },
        data: {
          tenantId,
          ownerAddress: to.toLowerCase(),
          status: NFTStatus.TRANSFERRED,
          txHash,
        },
      });

      logger.info({ tokenId, txHash }, 'NFT transferred successfully');

      return updatedNFT;
    } catch (error: any) {
      logger.error({ tokenId, error: error.message }, 'Failed to transfer NFT');
      throw new BadRequestException(`Failed to transfer NFT: ${error.message}`);
    }
  }

  /**
   * Lista todos los NFTs
   */
  async findAll() {
    const tenantId = getTenantId();
    return prisma.nFT.findMany({
      where: { tenantId },
      include: { certificate: { include: { template: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ancla múltiples NFTs a blockchain usando Merkle tree
   * Similar al proceso de anclaje de certificados
   */
  async anchorNFTs(certificateIds: string[], blockchain: string) {
    const tenantId = getTenantId();
    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      throw new BadRequestException('certificateIds no puede estar vacío');
    }

    const chunkSize = 100;
    const anchors: Awaited<ReturnType<typeof prisma.anchor.create>>[] = [];

    for (let i = 0; i < certificateIds.length; i += chunkSize) {
      const chunkIds = certificateIds.slice(i, i + chunkSize);

      // 1) Cargar NFTs MINTED asociados a los certificados
      const nfts = await prisma.nFT.findMany({
        where: {
          certificateId: { in: chunkIds },
          status: NFTStatus.MINTED,
          tenantId,
        },
        include: { certificate: true }
      });

      if (nfts.length === 0) {
        logger.warn({ chunkIds }, 'No hay NFTs MINTED en este chunk');
        continue;
      }

      if (nfts.length !== chunkIds.length) {
        const foundIds = nfts.map(n => n.certificateId);
        const missingIds = chunkIds.filter(id => !foundIds.includes(id));
        logger.warn({ missingIds }, 'Algunos certificados no tienen NFTs minados');
      }

      // 2) Calcular hashes de los NFTs usando el hash del certificado asociado
      // El hash del certificado ya está calculado y guardado en certificate.hash
      const leaves: Buffer[] = [];
      const nftHashes: string[] = [];

      for (const nft of nfts) {
        // Usar el hash del certificado como hoja del Merkle tree
        // Si no existe, calcularlo desde el certificado
        let certHash: string;
        
        if (nft.certificate.hash) {
          certHash = nft.certificate.hash;
        } else {
          // Calcular hash del certificado si no existe
          const certHashBuffer = await sha256Canonical(nft.certificate.data);
          certHash = certHashBuffer.toString('hex');
        }

        // Crear hash específico del NFT: SHA256(tokenId + contractAddress + certHash)
        const nftData = `${nft.tokenId}:${nft.contractAddress}:${certHash}`;
        const nftHashBuffer = crypto.createHash('sha256').update(nftData).digest();
        const nftHash = nftHashBuffer.toString('hex');
        
        leaves.push(nftHashBuffer);
        nftHashes.push(nftHash);
      }

      // 3) Construir Merkle tree
      const t0 = Date.now();
      const { root, proofByLeafHex } = buildMerkleWithDirectionalPaths(leaves);
      const t1 = Date.now();
      
      if (!root) {
        throw new BadRequestException('Merkle root vacío');
      }

      logger.info(
        {
          numLeaves: leaves.length,
          root,
          buildTimeMs: t1 - t0,
        },
        'Merkle tree de NFTs construido'
      );

      // 4) Anclar root a blockchain
      let txHash: string;
      const normalizedBlockchain = (blockchain || '').toLowerCase();
      
      if (normalizedBlockchain === 'sepolia' || normalizedBlockchain === 'besu' || normalizedBlockchain === 'local') {
        if (!process.env.ETHEREUM_PRIVATE_KEY) {
          throw new BadRequestException('ETHEREUM_PRIVATE_KEY no está configurada');
        }

        try {
          const rpcUrl = normalizedBlockchain === 'besu' || normalizedBlockchain === 'local'
            ? (process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545')
            : (process.env.ETHEREUM_RPC_URL || (() => {
              throw new BadRequestException('ETHEREUM_RPC_URL no está configurada');
            })());

          logger.info({ rpcUrl, blockchain: normalizedBlockchain }, 'Anclando NFTs a blockchain');

          const isLocalNetwork = normalizedBlockchain === 'besu' || normalizedBlockchain === 'local';
          txHash = await anchorToSepolia({
            merkleRoot: root,
            privateKey: process.env.ETHEREUM_PRIVATE_KEY,
            rpcUrl: rpcUrl,
            dataSinkAddress: process.env.ETHEREUM_DATA_SINK,
            waitForConfirmations: isLocalNetwork ? 0 : 1,
          });
          
          logger.info({ txHash, blockchain: normalizedBlockchain }, 'Transacción de anclaje de NFTs enviada');
        } catch (err: any) {
          logger.error({ err: err?.message, blockchain: normalizedBlockchain }, 'Fallo anclando NFTs');
          throw new BadRequestException(`Error al anclar NFTs: ${err?.message || err}`);
        }
      } else {
        txHash = `0xmock${Date.now().toString(16)}${root.slice(0, 8)}`;
      }

      // 5) Persistir Anchor y actualizar NFTs con proof
      const appUrl = process.env.APP_URL;
      const normalizedRoot = strip0x(root);
      const normalizedTx = strip0x(txHash);

      const createdAnchor = await prisma.anchor.create({
        data: {
          tenantId,
          rootHash: normalizedRoot,
          txHash: normalizedTx,
          blockchain: `NFT_${blockchain}`,
          status: AnchorStatus.CONFIRMED,
          nfts: { connect: nfts.map((n) => ({ id: n.id })) },
        },
      });

      await Promise.all(
        nfts.map((nft, idx) => {
          const leafHex = nftHashes[idx];
          const path = proofByLeafHex[leafHex] || [];

          // Codificar proof en Base58
          const txWithPrefix = ensure0x(normalizedTx);
          const { chain: chainKey, network: networkKey } = resolveAnchorEncoding(blockchain);
          const txHex = strip0x(txWithPrefix);
          const proofData = {
            merkleRoot: normalizedRoot,
            targetHash: leafHex,
            anchors: [buildBlinkAnchor(chainKey, networkKey, txHex)],
            path,
          };
          const encoder = new Encoder(proofData);
          const proofValueBase58 = encoder.encode().toString();

          // Estructura de proof para NFTs
          const proofPayload: any = {
            type: 'MerkleProof2019',
            created: new Date().toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: `${appUrl}/issuer.json#key-1`,
            merkleRoot: normalizedRoot,
            targetHash: leafHex,
            proofValue: proofValueBase58,
            anchors: [
              {
                type: normalizedBlockchain === 'besu' || normalizedBlockchain === 'local'
                  ? 'ETHEREUM_BESU'
                  : 'ETHEREUM_SEPOLIA',
                sourceId: txWithPrefix,
                value: txWithPrefix,
              },
            ],
          };

          return prisma.nFT.update({
            where: { id: nft.id },
            data: {
              tenantId,
              hash: leafHex,
              merkleProof: proofPayload,
              anchorId: undefined, // la relación se establece con connect arriba
            },
          });
        }),
      );

      anchors.push(createdAnchor);
    }

    if (anchors.length === 0) {
      throw new BadRequestException('No se creó ningún anclaje; revisa IDs/estados de NFTs.');
    }
    
    return anchors.length === 1 ? anchors[0] : anchors;
  }

  /**
   * Emite certificados, los ancla, mina NFTs y los ancla en un solo proceso
   * Flujo completo: Issue → Anchor Certificate → Mint NFT → Anchor NFT
   */
  async issueAndAnchorNFTs(
    templateId: string,
    recipients: any[],
    ownerAddress?: string,
    blockchain: string = 'besu'
  ) {
    logger.info({ templateId, recipientsCount: recipients.length, ownerAddress, blockchain }, 'Iniciando proceso completo: emitir, anclar certificados, minar NFTs y anclar NFTs');

    // 1. Emitir certificados
    logger.info({ templateId }, 'Paso 1: Emitiendo certificados...');
    const certificates = await this.certificateService.issueBatch(templateId, recipients);
    const certificateIds = certificates.map(cert => cert.id);
    logger.info({ certificateIds: certificateIds.length }, 'Certificados emitidos');

    // 2. Anclar certificados a blockchain
    logger.info({ certificateIds: certificateIds.length, blockchain }, 'Paso 2: Anclando certificados a blockchain...');
    const certificateAnchor = await this.anchorService.approveAndAnchor(certificateIds, blockchain);
    const anchorResult = Array.isArray(certificateAnchor) ? certificateAnchor[0] : certificateAnchor;
    logger.info({ anchorId: anchorResult.id, txHash: anchorResult.txHash }, 'Certificados anclados');

    // 3. Minar NFTs para cada certificado
    // Determinar ownerAddress por defecto si no se proporciona
    const defaultOwnerAddress = ownerAddress || 
      process.env.NFT_OWNER_ADDRESS || 
      process.env.ISSUER_BLOCKCHAIN_ADDRESS ||
      (() => {
        throw new BadRequestException(
          'ownerAddress es requerido. Proporciónalo en el body o configura NFT_OWNER_ADDRESS o ISSUER_BLOCKCHAIN_ADDRESS en .env'
        );
      })();

    logger.info({ certificateIds: certificateIds.length, defaultOwnerAddress }, 'Paso 3: Minando NFTs...');
    const nfts: Array<{ certificateId: string; tokenId: string; [key: string]: any }> = [];
    const errors: Array<{ certificateId: string; error: string }> = [];

    // Obtener certificados para mapear con recipients y obtener ownerAddress específico si existe
    const tenantId = getTenantId();
    const certificatesWithRecipients = await Promise.all(
      certificateIds.map(async (certId, index) => {
        const cert = await prisma.certificate.findFirst({
          where: { id: certId, tenantId },
        });
        if (!cert) {
          throw new NotFoundException(`Certificate ${certId} not found`);
        }
        const recipient = recipients[index];
        // Permitir ownerAddress por recipient o usar el default
        const recipientOwnerAddress = recipient?.ownerAddress || 
                                      recipient?.walletAddress || 
                                      defaultOwnerAddress;
        return { cert, recipient, ownerAddress: recipientOwnerAddress };
      })
    );

    for (const { cert, ownerAddress: nftOwnerAddress } of certificatesWithRecipients) {
      try {
        const nft = await this.mintNFT(cert.id, nftOwnerAddress);
        nfts.push(nft);
        logger.info({ certificateId: cert.id, tokenId: nft.tokenId, ownerAddress: nftOwnerAddress }, 'NFT minado exitosamente');
      } catch (error: any) {
        logger.error({ certificateId: cert.id, error: error.message }, 'Error al minar NFT');
        errors.push({ certificateId: cert.id, error: error.message });
      }
    }

    if (nfts.length === 0) {
      throw new BadRequestException(
        `No se pudo minar ningún NFT. Errores: ${JSON.stringify(errors)}`
      );
    }

    logger.info({ nftsMinted: nfts.length, errors: errors.length }, 'NFTs minados');

    // 4. Anclar NFTs a blockchain
    const nftCertificateIds = nfts.map(nft => nft.certificateId);
    logger.info({ nftCertificateIds: nftCertificateIds.length, blockchain }, 'Paso 4: Anclando NFTs a blockchain...');
    
    let nftAnchor;
    try {
      nftAnchor = await this.anchorNFTs(nftCertificateIds, blockchain);
      const anchorTxHash = Array.isArray(nftAnchor) ? nftAnchor[0]?.txHash : nftAnchor?.txHash;
      logger.info({ anchorId: Array.isArray(nftAnchor) ? nftAnchor[0]?.id : nftAnchor?.id, txHash: anchorTxHash }, 'NFTs anclados');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error al anclar NFTs');
      // No fallar completamente si el anclaje de NFTs falla, los NFTs ya están minados
      throw new BadRequestException(
        `NFTs minados exitosamente pero falló el anclaje: ${error.message}`
      );
    }

    const certificateAnchorTxHash = anchorResult?.txHash || '';
    const nftAnchorTxHash = Array.isArray(nftAnchor) 
      ? nftAnchor[0]?.txHash 
      : nftAnchor?.txHash;

    // Obtener los certificados actualizados con el anclaje
    const updatedCertificates = await Promise.all(
      certificateIds.map(certId => 
        this.certificateService.findOne(certId)
      )
    );

    // Obtener los JSONs de cada certificado anclado (Blockcerts para EdTech, VC estándar para otras verticales)
    const credentialJsons = await Promise.all(
      updatedCertificates.map(async (cert) => {
        try {
          // Obtener la vertical del certificado
          const certVertical = cert.verticalId
            ? await prisma.vertical.findFirst({ where: { id: cert.verticalId, tenantId } })
            : null;
          
          const isEdTech = certVertical?.slug === 'edtech';
          
          if (isEdTech) {
            // EdTech: usar getBlockcertsJson
            const blockcertsJson = await this.certificateService.getBlockcertsJson(cert.id);
            return {
              certificateId: cert.id,
              credentialUuid: cert.credentialUuid,
              blockcertsJson
            };
          } else {
            // Otras verticales: usar el data directamente (VC firmado por Veramo)
            return {
              certificateId: cert.id,
              credentialUuid: cert.credentialUuid,
              credentialJson: cert.data
            };
          }
        } catch (error: any) {
          return {
            certificateId: cert.id,
            credentialUuid: cert.credentialUuid,
            error: error.message || 'No se pudo obtener el JSON del certificado'
          };
        }
      })
    );

    return {
      certificates: updatedCertificates,
      certificateAnchor: anchorResult,
      nfts: nfts,
      nftAnchor: Array.isArray(nftAnchor) ? nftAnchor[0] : nftAnchor,
      credentialJsons: credentialJsons, // Renombrado de blockcertsJsons para reflejar que puede contener diferentes formatos
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}




