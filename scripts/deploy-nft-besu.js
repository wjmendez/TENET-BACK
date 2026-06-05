"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
dotenv.config();
var ethers_1 = require("ethers");
var CertificateNFT_json_1 = require("../artifacts/contracts/CertificateNFT.sol/CertificateNFT.json");
/**
 * Script para desplegar NFT en Besu usando una cuenta pre-fundada
 * Si tu wallet no tiene fondos, este script usará una cuenta pre-fundada conocida de Besu
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var rpcUrl, preFundedAddresses, preFundedKey, provider, deployerPrivateKey, usePreFunded, selectedAccount, wallet_1, balance_1, _i, preFundedAddresses_1, address, balance_2, _a, preFundedAddresses_2, address, balance_3, wallet, balance, initialOwner, CertificateNFTFactory, gasLimit, contract, contractAddress, deployedContract, nextTokenId, owner, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    rpcUrl = process.env.BESU_RPC_URL || 'http://localhost:8545';
                    preFundedAddresses = [
                        '0x627306090abaB3A6e1400e9345bC60c78a8BEf57',
                        '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
                    ];
                    preFundedKey = process.env.BESU_PRE_FUNDED_KEY;
                    provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
                    deployerPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
                    usePreFunded = false;
                    selectedAccount = null;
                    if (!deployerPrivateKey) return [3 /*break*/, 8];
                    wallet_1 = new ethers_1.ethers.Wallet(deployerPrivateKey, provider);
                    return [4 /*yield*/, provider.getBalance(wallet_1.address)];
                case 1:
                    balance_1 = _b.sent();
                    if (!(balance_1 > 0n)) return [3 /*break*/, 2];
                    console.log("✅ Using configured wallet with funds");
                    console.log("📍 Address:", wallet_1.address);
                    console.log("💰 Balance:", ethers_1.ethers.formatEther(balance_1), "ETH\n");
                    return [3 /*break*/, 7];
                case 2:
                    console.log("⚠️  Configured wallet has no funds");
                    console.log("🔍 Checking for pre-funded accounts in Besu...\n");
                    _i = 0, preFundedAddresses_1 = preFundedAddresses;
                    _b.label = 3;
                case 3:
                    if (!(_i < preFundedAddresses_1.length)) return [3 /*break*/, 6];
                    address = preFundedAddresses_1[_i];
                    return [4 /*yield*/, provider.getBalance(address)];
                case 4:
                    balance_2 = _b.sent();
                    if (balance_2 > 0n) {
                        console.log("\uD83D\uDCB0 Found pre-funded account: ".concat(address, " (").concat(ethers_1.ethers.formatEther(balance_2), " ETH)"));
                    }
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    // Si hay una clave pre-fundada configurada, usarla
                    if (preFundedKey) {
                        console.log("\n✅ Using BESU_PRE_FUNDED_KEY from .env");
                        deployerPrivateKey = preFundedKey;
                        usePreFunded = true;
                    }
                    else {
                        console.log("\n❌ No funds available and no BESU_PRE_FUNDED_KEY configured.");
                        console.log("\n💡 Solutions:");
                        console.log("1. Use MetaMask to transfer ETH:");
                        console.log("   - Connect MetaMask to Besu (Chain ID: 2025, RPC: http://localhost:8545)");
                        console.log("   - Import a pre-funded account if you have its private key");
                        console.log("   - Transfer 1-2 ETH to:", wallet_1.address);
                        console.log("\n2. Use a pre-funded account directly:");
                        console.log("   - Get the private key of a pre-funded account");
                        console.log("   - Set it in .env: BESU_PRE_FUNDED_KEY=<private_key>");
                        console.log("   - Or set it as: ETHEREUM_PRIVATE_KEY=<private_key>");
                        console.log("\n3. Check Besu configuration:");
                        console.log("   - Look for genesis.json or Besu config files");
                        console.log("   - Find pre-funded accounts and their private keys");
                        throw new Error("Please fund your wallet or configure BESU_PRE_FUNDED_KEY");
                    }
                    _b.label = 7;
                case 7: return [3 /*break*/, 14];
                case 8:
                    console.log("ℹ️  No ETHEREUM_PRIVATE_KEY configured");
                    if (!preFundedKey) return [3 /*break*/, 9];
                    console.log("✅ Using BESU_PRE_FUNDED_KEY from .env\n");
                    deployerPrivateKey = preFundedKey;
                    usePreFunded = true;
                    return [3 /*break*/, 14];
                case 9:
                    console.log("🔍 Checking for pre-funded accounts in Besu...\n");
                    _a = 0, preFundedAddresses_2 = preFundedAddresses;
                    _b.label = 10;
                case 10:
                    if (!(_a < preFundedAddresses_2.length)) return [3 /*break*/, 13];
                    address = preFundedAddresses_2[_a];
                    return [4 /*yield*/, provider.getBalance(address)];
                case 11:
                    balance_3 = _b.sent();
                    if (balance_3 > 0n) {
                        console.log("\uD83D\uDCB0 Found pre-funded account: ".concat(address, " (").concat(ethers_1.ethers.formatEther(balance_3), " ETH)"));
                    }
                    _b.label = 12;
                case 12:
                    _a++;
                    return [3 /*break*/, 10];
                case 13:
                    console.log("\n❌ No BESU_PRE_FUNDED_KEY configured.");
                    console.log("\n💡 Solutions:");
                    console.log("1. Set BESU_PRE_FUNDED_KEY in .env with a pre-funded account's private key");
                    console.log("2. Or set ETHEREUM_PRIVATE_KEY with a funded account");
                    console.log("3. Or use MetaMask to transfer ETH to your wallet");
                    throw new Error("Please configure ETHEREUM_PRIVATE_KEY or BESU_PRE_FUNDED_KEY");
                case 14:
                    wallet = new ethers_1.ethers.Wallet(deployerPrivateKey, provider);
                    return [4 /*yield*/, provider.getBalance(wallet.address)];
                case 15:
                    balance = _b.sent();
                    if (balance === 0n) {
                        throw new Error("No funds available. Please fund your wallet or use a pre-funded account.");
                    }
                    console.log("🚀 Deploying CertificateNFT contract to Besu...");
                    console.log("📡 RPC URL:", rpcUrl);
                    console.log("📍 Deployer address:", wallet.address);
                    console.log("💰 Balance:", ethers_1.ethers.formatEther(balance), "ETH");
                    initialOwner = process.env.NFT_OWNER_ADDRESS || wallet.address;
                    console.log("👤 Initial Owner:", initialOwner);
                    if (usePreFunded) {
                        console.log("\n⚠️  NOTE: Using pre-funded account for deployment.");
                        console.log("   The contract owner will be:", initialOwner);
                        console.log("   (You can change this by setting NFT_OWNER_ADDRESS in .env)");
                        console.log("   For production, use your own funded wallet.\n");
                    }
                    CertificateNFTFactory = new ethers_1.ContractFactory(CertificateNFT_json_1.default.abi, CertificateNFT_json_1.default.bytecode, wallet);
                    console.log("📝 Deploying contract...");
                    gasLimit = 5000000n;
                    console.log("⛽ Using gas limit:", gasLimit.toString());
                    return [4 /*yield*/, CertificateNFTFactory.deploy({
                            gasLimit: gasLimit
                        })];
                case 16:
                    contract = _b.sent();
                    console.log("⏳ Waiting for deployment transaction...");
                    return [4 /*yield*/, contract.waitForDeployment()];
                case 17:
                    _b.sent();
                    return [4 /*yield*/, contract.getAddress()];
                case 18:
                    contractAddress = _b.sent();
                    console.log("\n✅ CertificateNFT deployed successfully to Besu!");
                    console.log("📍 Contract Address:", contractAddress);
                    console.log("👤 Initial Owner:", initialOwner);
                    console.log("\n📋 Add this to your .env file:");
                    console.log("NFT_CONTRACT_ADDRESS=".concat(contractAddress));
                    _b.label = 19;
                case 19:
                    _b.trys.push([19, 22, , 23]);
                    deployedContract = new ethers_1.Contract(contractAddress, CertificateNFT_json_1.default.abi, wallet);
                    return [4 /*yield*/, deployedContract.nextTokenId()];
                case 20:
                    nextTokenId = _b.sent();
                    return [4 /*yield*/, deployedContract.owner()];
                case 21:
                    owner = _b.sent();
                    console.log("\n🔍 Verification:");
                    console.log("   Next Token ID:", nextTokenId.toString());
                    console.log("   Contract owner:", owner);
                    console.log("   ✅ Contract is working correctly!");
                    return [3 /*break*/, 23];
                case 22:
                    error_1 = _b.sent();
                    console.warn("⚠️  Could not verify contract:", error_1.message);
                    return [3 /*break*/, 23];
                case 23:
                    if (usePreFunded) {
                        console.log("\n💡 IMPORTANT: You used a pre-funded account for deployment.");
                        console.log("   For production, use your own wallet with funds.");
                        console.log("   The contract is deployed and ready to use!");
                    }
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error("❌ Deployment failed:", err);
    process.exitCode = 1;
});
