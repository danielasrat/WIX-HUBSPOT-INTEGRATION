"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.hashObject = hashObject;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
function getEncryptionKey() {
    const value = process.env.TOKEN_ENCRYPTION_KEY;
    if (!value) {
        throw new Error("TOKEN_ENCRYPTION_KEY is required for secure token storage.");
    }
    const key = Buffer.from(value, "base64");
    if (key.length !== 32) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be base64 for a 32-byte key.");
    }
    return key;
}
function encryptSecret(plainText) {
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}
function decryptSecret(ciphertext) {
    const key = getEncryptionKey();
    const [ivPart, authTagPart, encryptedPart] = ciphertext.split(".");
    if (!ivPart || !authTagPart || !encryptedPart) {
        throw new Error("Invalid encrypted secret format.");
    }
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"));
    decipher.setAuthTag(Buffer.from(authTagPart, "base64"));
    const plain = Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, "base64")),
        decipher.final(),
    ]);
    return plain.toString("utf8");
}
function hashObject(payload) {
    const json = JSON.stringify(sortObject(payload));
    return crypto_1.default.createHash("sha256").update(json).digest("hex");
}
function sortObject(value) {
    if (Array.isArray(value)) {
        return value.map(sortObject);
    }
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
            acc[key] = sortObject(value[key]);
            return acc;
        }, {});
    }
    return value;
}
//# sourceMappingURL=crypto.js.map