import { Queue } from "bullmq";
import IORedis from "ioredis";

let syncQueue: Queue | null = null;

export function getSyncQueue() {
	if (!syncQueue) {
		const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
		const connection = new IORedis(redisUrl, {
			lazyConnect: true,
			maxRetriesPerRequest: null,
		});
		syncQueue = new Queue("sync", { connection });
	}

	return syncQueue;
}