import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../config/prisma";
import { sendMail } from "../services/mailer";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 5);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || 2000);
const MAX_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || 50);

// Redis instance ONLY for counters (rate limiting)
const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

// BullMQ connection object
const bullConnection = {
  host: "localhost",
  port: 6379,
};

// ---------- Redis Helpers ----------
function getHourWindowKey(fromEmail: string) {
  const now = new Date();
  const hourKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
  return `rate:${fromEmail}:${hourKey}`;
}

function msUntilNextHourUTC() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(now.getUTCHours() + 1);
  return nextHour.getTime() - now.getTime();
}

async function allowSendThisHour(fromEmail: string, limit: number) {
  const key = getHourWindowKey(fromEmail);

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60 * 60);
  }

  return { allowed: count <= limit, count };
}

// ---------- Worker ----------
export const emailWorker = new Worker(
  "emailQueue",
  async (job: Job) => {
    const { recipientId, hourlyLimit } = job.data as {
      recipientId: string;
      hourlyLimit?: number;
    };

    if (!recipientId) {
      console.log("⚠️ Job missing recipientId:", job.id);
      return;
    }

    const recipient = await prisma.emailRecipient.findUnique({
      where: { id: recipientId },
      include: { emailJob: true },
    });

    if (!recipient) {
      console.log(`⚠️ Recipient not found: ${recipientId}`);
      return;
    }

    // idempotency
    if (recipient.status === "sent") {
      console.log(`🟡 Already sent (skip): recipient=${recipientId}`);
      return;
    }

    const fromEmail = recipient.emailJob.fromEmail;
    const limit = hourlyLimit ?? MAX_PER_HOUR;

    console.log(
      `📌 Processing job=${job.id} recipient=${recipient.toEmail} sender=${fromEmail}`
    );

    await prisma.emailRecipient.update({
      where: { id: recipientId },
      data: { status: "processing" },
    });

    // Hourly limit check
    const { allowed, count } = await allowSendThisHour(fromEmail, limit);

    if (!allowed) {
      const delayMs = msUntilNextHourUTC() + 1000;
      const nextRun = new Date(Date.now() + delayMs).toLocaleString();

      console.log(
        `⏳ RATE LIMIT HIT (${count}/${limit}) sender=${fromEmail} -> rescheduling recipient=${recipient.toEmail} at ${nextRun}`
      );

      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: {
          status: "scheduled",
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });

      await job.moveToDelayed(Date.now() + delayMs);
      return;
    }

    // Send email
    try {
      console.log(
        `📩 Sending email -> to=${recipient.toEmail} | subject="${recipient.emailJob.subject}"`
      );

      await sendMail({
        from: fromEmail,
        to: recipient.toEmail,
        subject: recipient.emailJob.subject,
        html: recipient.emailJob.body,
      });

      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });

      console.log(`✅ SENT SUCCESS -> ${recipient.toEmail}`);
    } catch (err) {
      console.log(`❌ SEND FAILED -> ${recipient.toEmail}`, err);

      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: { status: "failed" },
      });

      throw err;
    }
  },
  {
    connection: bullConnection,
    concurrency: CONCURRENCY,

    // throttle: min delay between sends (safe across workers)
    limiter: {
      max: 1,
      duration: MIN_DELAY_MS,
    },
  }
);

emailWorker.on("completed", (job) => {
  console.log(`🎉 Job completed: ${job.id}`);
});

emailWorker.on("failed", (job, err) => {
  console.log(`💥 Job failed: ${job?.id}`, err.message);
});
