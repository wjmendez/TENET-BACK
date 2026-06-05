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
var ethers_1 = require("ethers");
var dotenv = require("dotenv");
dotenv.config();
/**
 * Script para generar una nueva clave privada y wallet
 * Útil si no tienes acceso a la clave privada de la cuenta pre-fundada
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var wallet, rpcUrl, provider, balance, balanceEth, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83D\uDD11 Generando nueva clave privada y wallet...\n");
                    wallet = ethers_1.ethers.Wallet.createRandom();
                    console.log("\u2705 Nueva wallet generada:\n");
                    console.log("\uD83D\uDCCD Address: ".concat(wallet.address));
                    console.log("\uD83D\uDD11 Private Key: ".concat(wallet.privateKey));
                    console.log("   (64 caracteres hex, lista para usar en .env)\n");
                    rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL;
                    if (!rpcUrl) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
                    return [4 /*yield*/, provider.getBalance(wallet.address)];
                case 2:
                    balance = _a.sent();
                    balanceEth = Number(balance) / 1e18;
                    console.log("\uD83D\uDCB0 Balance en ".concat(rpcUrl, ": ").concat(balanceEth.toFixed(6), " ETH\n"));
                    if (balance === 0n) {
                        console.log("\u26A0\uFE0F  Esta nueva wallet no tiene fondos.\n");
                        console.log("\uD83D\uDCA1 Para usar esta wallet:");
                        console.log("   1. Agrega esta l\u00EDnea a tu .env:");
                        console.log("      ETHEREUM_PRIVATE_KEY=".concat(wallet.privateKey.slice(2), "\n"));
                        console.log("   2. Transfiere ETH desde la cuenta pre-fundada:");
                        console.log("      - Address pre-fundada: 0x44d192c0080b0644cb5c648ced6c5373979f748b");
                        console.log("      - Nuevo wallet: ".concat(wallet.address));
                        console.log("      - Usa MetaMask o un script de transferencia\n");
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.log("\u26A0\uFE0F  No se pudo verificar balance: ".concat(err_1.message, "\n"));
                    return [3 /*break*/, 4];
                case 4:
                    console.log("\uD83D\uDCCB Para usar esta wallet, agrega a tu .env:");
                    console.log("   ETHEREUM_PRIVATE_KEY=".concat(wallet.privateKey.slice(2), "\n"));
                    console.log("\u26A0\uFE0F  IMPORTANTE: Guarda esta clave privada de forma segura!");
                    console.log("   Si la pierdes, no podr\u00E1s acceder a esta wallet.\n");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
