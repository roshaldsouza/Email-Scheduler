import { Worker, Job, Queue } from "bullmq";
import { prisma } from "../config/prisma";
import { sendMail } from "../services/mailer";
import { bullConnection, counterRedis } from "../config/redis";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 5);
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || 2000);
const MAX_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || 50);

// Create queue instance for re-scheduling
const emailQueue = new Queue("emailQueue", {
  connection: bullConnection,
});

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

  const count = await counterRedis.incr(key);

  if (count === 1) {
    await counterRedis.expire(key, 60 * 60);
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
      console.log("⚠️ Missing recipientId in job:", job.id);
      return;
    }

    const recipient = await prisma.emailRecipient.findUnique({
      where: { id: recipientId },
      include: { emailJob: true },
    });

    if (!recipient) {
      console.log("⚠️ Recipient not found:", recipientId);
      return;
    }

    // ✅ idempotency
    if (recipient.status === "sent") {
      console.log("🟡 Already sent, skipping:", recipient.toEmail);
      return;
    }

    const fromEmail = recipient.emailJob.fromEmail;
    const limit = hourlyLimit ?? MAX_PER_HOUR;

    // Hourly limit check (Redis counter)
    const { allowed, count } = await allowSendThisHour(fromEmail, limit);

    if (!allowed) {
      const delayMs = msUntilNextHourUTC() + 1000;

      console.log(
        `⏳ RATE LIMIT HIT (${count}/${limit}) sender=${fromEmail} -> reschedule in ${Math.round(
          delayMs / 1000
        )}s`
      );

      // Decrement the counter since we're not actually sending
      await counterRedis.decr(getHourWindowKey(fromEmail));

      await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: {
          status: "scheduled",
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });

      // Re-add to queue with delay
      await emailQueue.add(
        "send-email",
        { recipientId, hourlyLimit },
        {
          jobId: `recipient-${recipientId}`, // Same jobId pattern as initial scheduling
          delay: delayMs,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      console.log(`✅ Rescheduled ${recipient.toEmail} for ${new Date(Date.now() + delayMs).toLocaleTimeString()}`);
      
      // Complete this job successfully
      return;
    }

    // mark processing
    await prisma.emailRecipient.update({
      where: { id: recipientId },
      data: { status: "processing" },
    });

    try {
      console.log(`📩 Sending -> ${recipient.toEmail} (${count}/${limit})`);

      const result = await sendMail({
        from: fromEmail,
        to: recipient.toEmail,
        subject: recipient.emailJob.subject,
        html: recipient.emailJob.body,
      });

      console.log(`📧 Email sent! Preview: ${result.previewUrl}`);

      const updated = await prisma.emailRecipient.update({
        where: { id: recipientId },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });

      console.log(`✅ SENT -> ${recipient.toEmail} | DB Status: ${updated.status}`);
    } catch (err) {
      console.log(`❌ FAILED -> ${recipient.toEmail}`, err);

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

    // min delay between sends (throttling)
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

emailWorker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});