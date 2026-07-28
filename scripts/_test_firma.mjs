// Test script to verify Cecabank signature calculation
import crypto from "crypto";

// Hardcoded from WC settings
const clave = "5FWN052M";
const merchantId = "086524428".padStart(9, "0");
const acquirerBin = "0000554027".padStart(10, "0");
const terminalId = "00000003".padStart(8, "0");
const numOper = "0728141145"; // From the last test
const importe = "7575"; // 75.75 EUR in cents
const tipoMoneda = "978";
const exponente = "2";
const cifrado = "SHA1";
const urlOk = "https://esenciadebelleza.es/checkout/confirmacion?num_oper=0728141145&resultado=ok";
const urlNok = "https://esenciadebelleza.es/checkout/confirmacion?num_oper=0728141145&resultado=ko";

// Current signature calculation
const raw = clave + [merchantId, acquirerBin, terminalId, numOper, importe, tipoMoneda, exponente, cifrado, urlOk, urlNok].join("");
const firma = crypto.createHash("sha1").update(raw, "utf8").digest("hex");

console.log("=== Current Signature Calculation ===");
console.log("clave:", clave);
console.log("merchantId:", merchantId);
console.log("acquirerBin:", acquirerBin);
console.log("terminalId:", terminalId);
console.log("numOper:", numOper);
console.log("importe:", importe);
console.log("tipoMoneda:", tipoMoneda);
console.log("exponente:", exponente);
console.log("cifrado:", cifrado);
console.log("urlOk:", urlOk);
console.log("urlNok:", urlNok);
console.log("raw:", raw);
console.log("firma:", firma);
console.log("firma length:", firma.length);

// Try alternative: without URL params (just base URL)
const urlOkBase = "https://esenciadebelleza.es/checkout/confirmacion";
const urlNokBase = "https://esenciadebelleza.es/checkout/confirmacion";
const raw2 = clave + [merchantId, acquirerBin, terminalId, numOper, importe, tipoMoneda, exponente, cifrado, urlOkBase, urlNokBase].join("");
const firma2 = crypto.createHash("sha1").update(raw2, "utf8").digest("hex");
console.log("\n=== Alternative (no URL params) ===");
console.log("firma:", firma2);

// Try: importe padded to 12 digits
const importePadded = importe.padStart(12, "0");
const raw3 = clave + [merchantId, acquirerBin, terminalId, numOper, importePadded, tipoMoneda, exponente, cifrado, urlOk, urlNok].join("");
const firma3 = crypto.createHash("sha1").update(raw3, "utf8").digest("hex");
console.log("\n=== Alternative (importe padded to 12) ===");
console.log("importePadded:", importePadded);
console.log("firma:", firma3);
