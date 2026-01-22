import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL missing in .env");

// Parse the Redis URL to extract components
const url = new URL(redisUrl);
const host = url.hostname;
const port = parseInt(url.port) || 6379;
const password = url.password;

console.log(`🔗 Connecting to Redis at ${host}:${port}`);

// for counters / custom redis ops
export const counterRedis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  connectTimeout: 10000, // 10 second timeout
});

// for BullMQ Queue + Worker connection - use parsed values
export const bullConnection = {
  host,
  port,
  password,
  tls: {}, // ✅ important for Upstash (rediss)
  maxRetriesPerRequest: null,
};