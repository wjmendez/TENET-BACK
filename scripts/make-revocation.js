import fs from "node:fs";
import * as dotenv from "dotenv";

dotenv.config();

const APP_URL = process.env.APP_URL;
if (!APP_URL) throw new Error("Falta APP_URL");

const rev = {
  id: `${APP_URL}/revocationList.json`,
  type: "RevocationList",
  issuer: `${APP_URL}/issuer.json`,
  revokedAssertions: []
};

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/revocationList.json", JSON.stringify(rev, null, 2));
console.log("revocationList.json generado en public/revocationList.json");
