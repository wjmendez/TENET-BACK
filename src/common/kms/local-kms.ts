import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519';

const MASTER_KEY_ENV = 'LOCAL_KMS_MASTER_KEY';
const KEY_VERSION = 1;
const KEY_ALGORITHM = 'Ed25519';
const KMS_TYPE = 'local';

export type LocalKmsKeyMaterial = {
  privateKeyHex: string;
  publicKeyHex: string;
  publicKeyJwk: {
    kty: 'OKP';
    crv: 'Ed25519';
    x: string;
    kid: string;
  };
  keyAlgorithm: string;
  keyVersion: number;
  kmsType: string;
};

function base64UrlEncode(input: Uint8Array): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

function requireMasterKey(): Buffer {
  const raw = process.env[MASTER_KEY_ENV];
  if (!raw) {
    throw new Error(`${MASTER_KEY_ENV} is required for local KMS`);
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`${MASTER_KEY_ENV} must be 32 bytes (base64-encoded)`);
  }
  return key;
}

export function encryptPrivateKey(privateKeyHex: string): string {
  const key = requireMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKeyHex, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

export function decryptPrivateKey(payload: string): string {
  const [version, ivB64, ciphertextB64, tagB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !ciphertextB64 || !tagB64) {
    throw new Error('Invalid encrypted key payload');
  }
  const key = requireMasterKey();
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function generateLocalEd25519KeyMaterial(did: string): LocalKmsKeyMaterial {
  const secretKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  const privateKeyHex = Buffer.concat([Buffer.from(secretKey), Buffer.from(publicKey)]).toString('hex');
  const publicKeyHex = Buffer.from(publicKey).toString('hex');

  return {
    privateKeyHex,
    publicKeyHex,
    publicKeyJwk: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: base64UrlEncode(publicKey),
      kid: `${did}#key-1`,
    },
    keyAlgorithm: KEY_ALGORITHM,
    keyVersion: KEY_VERSION,
    kmsType: KMS_TYPE,
  };
}

export function publicKeyHexFromJwk(jwk: { x: string }): string {
  return base64UrlDecode(jwk.x).toString('hex');
}
