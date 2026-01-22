import { Router } from "express";
import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/emailQueue";
import { scheduleEmailsSchema } from "./emailSchemas";

export const emailRoutes = Router();

/**
 * POST /emails/schedule
 */
emailRoutes.post("/schedule", async (req, res) => {
  const parsed = scheduleEmailsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Invalid request body",
      errors: parsed.error.flatten(),
    });
  }

  const {
    userEmail,
    fromEmail,
    subject,
    body,
    startTime,
    delayBetweenMs,
    hourlyLimit,
    recipients,
  } = parsed.data;
  

  try {
    // Ensure user exists
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {},
      create: {
        email: userEmail,
        name: userEmail.split("@")[0],
        avatarUrl: "",
      },
    });

    const start = new Date(startTime);

    // Create EmailJob record
    const emailJob = await prisma.emailJob.create({
      data: {
        userId: user.id,
        fromEmail,
        subject,
        body,
        status: "scheduled",
        scheduledAt: start,
      },
    });

    // Create recipients + queue jobs
    for (let i = 0; i < recipients.length; i++) {
      const toEmail = recipients[i];
      const scheduledAt = new Date(start.getTime() + i * delayBetweenMs);

      const recipient = await prisma.emailRecipient.create({
        data: {
          emailJobId: emailJob.id,
          toEmail,
          scheduledAt,
          status: "scheduled",
        },
      });

      const delay = Math.max(0, scheduledAt.getTime() - Date.now());

      await emailQueue.add(
        "send-email",
        { recipientId: recipient.id, hourlyLimit },
        {
          delay,
          jobId: `recipient-${recipient.id}`, // ✅ prevents duplicates
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    }

    return res.json({
      ok: true,
      message: "Emails scheduled",
      emailJobId: emailJob.id,
      scheduledCount: recipients.length,
    });
  } catch (err: any) {
    console.log("SCHEDULE ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to schedule emails",
    });
  }
});

/**
 * GET /emails/scheduled?userEmail=...
 */
emailRoutes.get("/scheduled", async (req, res) => {
  const userEmail = req.query.userEmail as string | undefined;

  if (!userEmail) {
    return res.status(400).json({ ok: false, message: "userEmail is required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return res.json({ ok: true, data: [] });

    const data = await prisma.emailRecipient.findMany({
      where: {
        emailJob: { userId: user.id },
        status: { in: ["scheduled", "processing"] },
      },
      include: { emailJob: true },
      orderBy: { scheduledAt: "asc" },
    });

    return res.json({ ok: true, data });
  } catch (err) {
    console.log("FETCH SCHEDULED ERROR:", err);
    return res.status(500).json({ ok: false, message: "Failed to fetch" });
  }
});

/**
 * GET /emails/sent?userEmail=...
 */
emailRoutes.get("/sent", async (req, res) => {
  const userEmail = req.query.userEmail as string | undefined;

  if (!userEmail) {
    return res.status(400).json({ ok: false, message: "userEmail is required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return res.json({ ok: true, data: [] });

    const data = await prisma.emailRecipient.findMany({
      where: {
        emailJob: { userId: user.id },
        status: { in: ["sent", "failed"] },
      },
      include: { emailJob: true },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ ok: true, data });
  } catch (err) {
    console.log("FETCH SENT ERROR:", err);
    return res.status(500).json({ ok: false, message: "Failed to fetch" });
  }
});
