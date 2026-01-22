import { Redis } from "ioredis";

export const redisConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
};

// Optional helper if you need direct Redis client for counters
export const redisClient = new Redis(redisConnection);
