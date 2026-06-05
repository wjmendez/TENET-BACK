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
 * Script para validar y verificar la clave privada configurada
 */
function validatePrivateKeyFormat(privateKey) {
    if (!privateKey || privateKey.length === 0) {
        return { valid: false, error: 'Private key is empty' };
    }
    var normalized = privateKey.trim();
    // Remover 0x si está presente
    if (normalized.startsWith('0x') || normalized.startsWith('0X')) {
        normalized = normalized.slice(2);
    }
    // Validar que sea hexadecimal
    if (!/^[0-9a-fA-F]+$/.test(normalized)) {
        return {
            valid: false,
            error: "Private key contains invalid characters. Only hexadecimal characters (0-9, a-f, A-F) are allowed."
        };
    }
    // Validar longitud (debe ser 64 caracteres = 32 bytes)
    if (normalized.length !== 64) {
        return {
            valid: false,
            error: "Invalid private key length. Expected 64 hex characters (32 bytes), got ".concat(normalized.length, " characters.")
        };
    }
    return { valid: true, normalized: '0x' + normalized.toLowerCase() };
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var privateKey, validation, wallet, rpcUrl, provider, balance, balanceEth, err_1, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    privateKey = process.env.ETHEREUM_PRIVATE_KEY;
                    if (!privateKey) {
                        console.log("\u274C ETHEREUM_PRIVATE_KEY no est\u00E1 configurada en .env\n");
                        console.log("\uD83D\uDCA1 Agrega tu clave privada al archivo .env:");
                        console.log("   ETHEREUM_PRIVATE_KEY=tu_clave_privada_64_caracteres_hex\n");
                        process.exit(1);
                    }
                    console.log("\uD83D\uDD0D Validando clave privada...\n");
                    console.log("\uD83D\uDCDD Clave privada (primeros/last 10 chars): ".concat(privateKey.substring(0, 10), "...").concat(privateKey.substring(privateKey.length - 10)));
                    console.log("\uD83D\uDCCF Longitud: ".concat(privateKey.length, " caracteres\n"));
                    validation = validatePrivateKeyFormat(privateKey);
                    if (!validation.valid) {
                        console.log("\u274C Clave privada inv\u00E1lida: ".concat(validation.error, "\n"));
                        console.log("\uD83D\uDCA1 La clave privada debe ser:");
                        console.log("   - 64 caracteres hexadecimales (0-9, a-f, A-F)");
                        console.log("   - Con o sin prefijo 0x");
                        console.log("   - Sin espacios, saltos de l\u00EDnea u otros caracteres especiales\n");
                        console.log("\uD83D\uDCCB Ejemplo de formato correcto:");
                        console.log("   ETHEREUM_PRIVATE_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n");
                        process.exit(1);
                    }
                    console.log("\u2705 Formato de clave privada v\u00E1lido\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    wallet = new ethers_1.ethers.Wallet(validation.normalized);
                    console.log("\u2705 Clave privada es v\u00E1lida para ethers.js");
                    console.log("\uD83D\uDCCD Wallet address: ".concat(wallet.address, "\n"));
                    rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL;
                    if (!rpcUrl) return [3 /*break*/, 6];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
                    return [4 /*yield*/, provider.getBalance(wallet.address)];
                case 3:
                    balance = _a.sent();
                    balanceEth = Number(balance) / 1e18;
                    console.log("\uD83D\uDCB0 Balance en ".concat(rpcUrl, ": ").concat(balanceEth.toFixed(6), " ETH\n"));
                    if (balance === 0n) {
                        console.log("\u26A0\uFE0F  Este wallet no tiene fondos. Necesitas fondos para enviar transacciones.\n");
                    }
                    else {
                        console.log("\u2705 Este wallet tiene fondos suficientes.\n");
                    }
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    console.log("\u26A0\uFE0F  No se pudo verificar balance: ".concat(err_1.message, "\n"));
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 7];
                case 6:
                    console.log("\uD83D\uDCA1 Para verificar el balance, configura BESU_RPC_URL o ETHEREUM_RPC_URL\n");
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_2 = _a.sent();
                    console.log("\u274C Error al crear wallet: ".concat(err_2.message, "\n"));
                    console.log("\uD83D\uDCA1 La clave privada parece tener el formato correcto pero no es v\u00E1lida para ethers.js\n");
                    process.exit(1);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
