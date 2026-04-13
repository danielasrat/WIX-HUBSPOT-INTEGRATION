import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processSync } from "../services/sync.service";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

new Worker(
  "sync",
  async (job) => {
    await processSync(job.data);
  },
  { connection }
);