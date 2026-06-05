// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateNFT
 * @dev Contrato ERC-721 para tokenizar certificados Blockcerts
 * Cada certificado puede ser convertido en un NFT único
 */
contract CertificateNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1; // Empezar desde 1
    
    // Mapeo de tokenId a hash del certificado (para verificación)
    mapping(uint256 => bytes32) private _certificateHashes;
    
    // Mapeo de hash de certificado a tokenId (para evitar duplicados)
    mapping(bytes32 => uint256) private _hashToTokenId;
    
    // Eventos
    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed to,
        bytes32 indexed certificateHash,
        string tokenURI
    );
    
    constructor() ERC721("Certificate NFT", "CERT") Ownable() {
        // Owner is set to msg.sender (deployer)
        // Ownership can be transferred after deployment using transferOwnership()
    }
    
    /**
     * @dev Mina un nuevo NFT para un certificado
     * @param to Dirección del propietario del NFT
     * @param certificateHash Hash SHA-256 del certificado (para verificación)
     * @param tokenURI URI de metadata (IPFS)
     * @return tokenId ID del token minado
     */
    function mint(
        address to,
        bytes32 certificateHash,
        string memory tokenURI
    ) public onlyOwner returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(certificateHash != bytes32(0), "Certificate hash cannot be zero");
        require(_hashToTokenId[certificateHash] == 0, "Certificate already minted");
        
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _certificateHashes[tokenId] = certificateHash;
        _hashToTokenId[certificateHash] = tokenId;
        
        emit CertificateMinted(tokenId, to, certificateHash, tokenURI);
        
        return tokenId;
    }
    
    /**
     * @dev Verifica que un token corresponde a un hash de certificado
     * @param tokenId ID del token
     * @param certificateHash Hash del certificado a verificar
     * @return true si el hash coincide
     */
    function verifyCertificate(uint256 tokenId, bytes32 certificateHash) 
        public 
        view 
        returns (bool) 
    {
        try this.ownerOf(tokenId) returns (address) {
            // Token existe
        } catch {
            return false; // Token no existe
        }
        return _certificateHashes[tokenId] == certificateHash;
    }
    
    /**
     * @dev Obtiene el hash del certificado asociado a un token
     * @param tokenId ID del token
     * @return hash del certificado
     */
    function getCertificateHash(uint256 tokenId) 
        public 
        view 
        returns (bytes32) 
    {
        // Verificar que el token existe (ownerOf revertirá si no existe)
        ownerOf(tokenId);
        return _certificateHashes[tokenId];
    }
    
    /**
     * @dev Obtiene el tokenId asociado a un hash de certificado
     * @param certificateHash Hash del certificado
     * @return tokenId o 0 si no existe
     */
    function getTokenIdByHash(bytes32 certificateHash) 
        public 
        view 
        returns (uint256) 
    {
        return _hashToTokenId[certificateHash];
    }
    
    /**
     * @dev Quema un token (solo el propietario o el owner del contrato)
     * @param tokenId ID del token a quemar
     */
    function burn(uint256 tokenId) public {
        address tokenOwner = ownerOf(tokenId);
        require(
            tokenOwner == msg.sender || owner() == msg.sender,
            "Not authorized to burn"
        );
        
        bytes32 certHash = _certificateHashes[tokenId];
        delete _hashToTokenId[certHash];
        delete _certificateHashes[tokenId];
        
        _burn(tokenId);
    }
    
    /**
     * @dev Obtiene el siguiente tokenId disponible
     * @return siguiente tokenId
     */
    function nextTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
}

