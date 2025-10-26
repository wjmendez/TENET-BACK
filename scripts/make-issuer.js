import fs from "node:fs";
import * as dotenv from "dotenv";

dotenv.config();

const APP_URL = process.env.APP_URL;
const NAME = process.env.ISSUER_NAME || "Mi Institución";
const PUB = process.env.ISSUER_PUBLIC_KEY_HEX;

if (!APP_URL || !PUB) {
  throw new Error("Faltan APP_URL o ISSUER_PUBLIC_KEY_HEX en .env");
}

const issuer = {
  id: `${APP_URL}/issuer.json`,
  name: NAME,
  type: ["Issuer"],
  url: APP_URL,
  publicKey: [
    {
      id: `${APP_URL}/issuer.json#key-1`,
      type: "Secp256k1VerificationKey2018",
      publicKeyHex: PUB
    }
  ],
  revocationList: `${APP_URL}/revocationList.json`
};

// asegúrate de tener una carpeta 'public'
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/issuer.json", JSON.stringify(issuer, null, 2));
console.log("issuer.json generado en public/issuer.json");
