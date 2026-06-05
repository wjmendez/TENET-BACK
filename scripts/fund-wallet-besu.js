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
/**
 * Script específico para Besu: Busca cuentas con fondos y transfiere ETH
 * a tu wallet para poder desplegar contratos
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var rpcUrl, privateKey, amount, provider, wallet, currentBalance, currentBalanceEth, commonPreFundedAddresses, fundedAccount, fundedBalance, _i, commonPreFundedAddresses_1, address, balance, balanceEth, error_1, txHash, newBalance, newBalanceEth, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rpcUrl = process.env.BESU_RPC_URL || 'http://localhost:8545';
                    privateKey = process.env.ETHEREUM_PRIVATE_KEY;
                    amount = process.env.FUND_AMOUNT || '10';
                    if (!privateKey) {
                        throw new Error("ETHEREUM_PRIVATE_KEY must be set in environment variables");
                    }
                    console.log("💰 Funding wallet for Besu deployment\n");
                    console.log("📡 RPC URL:", rpcUrl);
                    provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
                    wallet = new ethers_1.ethers.Wallet(privateKey, provider);
                    console.log("📍 Target wallet:", wallet.address);
                    return [4 /*yield*/, provider.getBalance(wallet.address)];
                case 1:
                    currentBalance = _a.sent();
                    currentBalanceEth = ethers_1.ethers.formatEther(currentBalance);
                    console.log("💰 Current balance:", currentBalanceEth, "ETH\n");
                    if (currentBalance !== 0n) {
                        console.log("✅ Wallet already has funds. Ready to deploy!");
                        return [2 /*return*/];
                    }
                    console.log("🔍 Searching for accounts with funds in Besu...\n");
                    commonPreFundedAddresses = [
                        '0x627306090abaB3A6e1400e9345bC60c78a8BEf57', // Cuenta común en Besu
                        '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
                        '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef',
                        '0x821aEa9a577a9b44299B9c15c88cf3087F3b5544',
                        '0x0d1d4e623D10F9FBA5Db95830F7d3839406C6AF2',
                    ];
                    fundedAccount = null;
                    fundedBalance = 0n;
                    _i = 0, commonPreFundedAddresses_1 = commonPreFundedAddresses;
                    _a.label = 2;
                case 2:
                    if (!(_i < commonPreFundedAddresses_1.length)) return [3 /*break*/, 7];
                    address = commonPreFundedAddresses_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, provider.getBalance(address)];
                case 4:
                    balance = _a.sent();
                    if (balance > 0n) {
                        balanceEth = ethers_1.ethers.formatEther(balance);
                        console.log("\u2705 Found funded account: ".concat(address, " (").concat(balanceEth, " ETH)"));
                        if (balance > fundedBalance) {
                            fundedAccount = address;
                            fundedBalance = balance;
                        }
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    if (!fundedAccount) {
                        console.log("\n❌ No pre-funded accounts found automatically.");
                        console.log("\n💡 Solutions for Besu:");
                        console.log("\n1. **Use MetaMask (Easiest):**");
                        console.log("   - Connect MetaMask to Besu (Chain ID: 2025)");
                        console.log("   - Import a pre-funded account if you have its private key");
                        console.log("   - Transfer ETH to:", wallet.address);
                        console.log("\n2. **Find pre-funded account in Besu config:**");
                        console.log("   - Check Besu genesis.json or config files");
                        console.log("   - Look for 'alloc' section with pre-funded accounts");
                        console.log("   - Use that account's private key as ETHEREUM_PRIVATE_KEY");
                        console.log("\n3. **Use a known pre-funded account:**");
                        console.log("   - If you know a pre-funded account's private key,");
                        console.log("   - Set it as ETHEREUM_PRIVATE_KEY in .env");
                        console.log("   - Then deploy the contract");
                        console.log("\n4. **Check Besu logs:**");
                        console.log("   - Besu logs may show pre-funded accounts");
                        console.log("   - Or check docker-compose if Besu runs in Docker");
                        return [2 /*return*/];
                    }
                    console.log("\n\uD83D\uDCE6 Using funded account: ".concat(fundedAccount));
                    console.log("\uD83D\uDCB0 Balance: ".concat(ethers_1.ethers.formatEther(fundedBalance), " ETH"));
                    // Intentar transferir usando eth_sendTransaction
                    // Esto requiere que la cuenta esté desbloqueada en Besu
                    console.log("\n🔄 Attempting to transfer ETH...");
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 12, , 13]);
                    return [4 /*yield*/, provider.send("eth_sendTransaction", [{
                                from: fundedAccount,
                                to: wallet.address,
                                value: ethers_1.ethers.parseEther(amount).toString(),
                                gas: "0x5208", // 21000
                            }])];
                case 9:
                    txHash = _a.sent();
                    console.log("\n✅ Transfer sent!");
                    console.log("📝 Transaction hash:", txHash);
                    console.log("⏳ Waiting for confirmation...");
                    // Esperar confirmación
                    return [4 /*yield*/, provider.waitForTransaction(txHash)];
                case 10:
                    // Esperar confirmación
                    _a.sent();
                    return [4 /*yield*/, provider.getBalance(wallet.address)];
                case 11:
                    newBalance = _a.sent();
                    newBalanceEth = ethers_1.ethers.formatEther(newBalance);
                    console.log("\n✅ Transfer confirmed!");
                    console.log("💰 New balance:", newBalanceEth, "ETH");
                    console.log("\n🚀 Ready to deploy NFT contract!");
                    return [3 /*break*/, 13];
                case 12:
                    error_2 = _a.sent();
                    console.error("\n❌ Transfer failed:", error_2.message);
                    console.log("\n💡 The account is not unlocked in Besu.");
                    console.log("\n📋 Manual steps:");
                    console.log("1. Get the private key of:", fundedAccount);
                    console.log("2. Use MetaMask:");
                    console.log("   - Connect to Besu (Chain ID: 2025)");
                    console.log("   - Import account with private key");
                    console.log("   - Transfer ETH to:", wallet.address);
                    console.log("\n3. Or update .env to use the pre-funded account:");
                    console.log("   ETHEREUM_PRIVATE_KEY=<private_key_of_pre_funded_account>");
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error("❌ Script failed:", err);
    process.exitCode = 1;
});
