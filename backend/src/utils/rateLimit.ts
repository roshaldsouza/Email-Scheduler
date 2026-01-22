import { redisClient } from "../config/redis";

export async function canSendEmailNow(sender: string, hourlyLimit: number) {
  const now = new Date();
  const hourKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;

  const key = `rate:${sender}:${hourKey}`;

  const current = await redisClient.incr(key);

  // set expiry only on first increment
  if (current === 1) {
    await redisClient.expire(key, 3700); // ~1 hour + buffer
  }

  if (current > hourlyLimit) {
    return { allowed: false, key, current };
  }

  return { allowed: true, key, current };
}

export function msUntilNextHourUTC() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(now.getUTCHours() + 1);
  return nextHour.getTime() - now.getTime();
}
