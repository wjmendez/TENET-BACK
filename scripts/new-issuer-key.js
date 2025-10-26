import { Wallet } from "ethers";

const w = Wallet.createRandom();
console.log("PRIVATE:", w.privateKey);
console.log("PUBLIC_HEX:", w.publicKey.replace(/^0x/, ""));
console.log("ADDRESS:", await w.getAddress());
