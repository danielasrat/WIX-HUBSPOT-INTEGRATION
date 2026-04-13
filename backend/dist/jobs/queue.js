"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncQueue = getSyncQueue;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
let syncQueue = null;
function getSyncQueue() {
    if (!syncQueue) {
        const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
        const connection = new ioredis_1.default(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: null,
        });
        syncQueue = new bullmq_1.Queue("sync", { connection });
    }
    return syncQueue;
}
//# sourceMappingURL=queue.js.map