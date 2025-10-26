import { Wallet } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const pk = process.env.ISSUER_PRIVATE_KEY || process.env.ETHEREUM_PRIVATE_KEY;
if (!pk) throw new Error("Falta ISSUER_PRIVATE_KEY o ETHEREUM_PRIVATE_KEY en .env");

const wallet = new Wallet(pk);

// Public key SIN el prefijo 0x
const publicKeyHex = wallet.signingKey.publicKey.replace(/^0x/, "");
console.log("PublicKeyHex:", publicKeyHex);

// Extraer x e y (32 bytes cada uno, después del 04)
const xHex = publicKeyHex.slice(2, 66); // 32 bytes
const yHex = publicKeyHex.slice(66, 130); // 32 bytes

const xBase64Url = Buffer.from(xHex, 'hex').toString('base64url');
const yBase64Url = Buffer.from(yHex, 'hex').toString('base64url');

console.log("x (base64url):", xBase64Url);
console.log("y (base64url):", yBase64Url);

// Para kid, puedes usar un hash o algo simple
const kid = Buffer.from(xHex + yHex, 'hex').toString('base64url').slice(0, 16);
console.log("kid (sugerido):", kid);
