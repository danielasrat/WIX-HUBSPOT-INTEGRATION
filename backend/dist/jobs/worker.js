"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const sync_service_1 = require("../services/sync.service");
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: null,
});
new bullmq_1.Worker("sync", async (job) => {
    await (0, sync_service_1.processSync)(job.data);
}, { connection });
//# sourceMappingURL=worker.js.map