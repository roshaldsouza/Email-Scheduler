import { z } from "zod";

export const scheduleEmailsSchema = z.object({
  userEmail: z.string().min(1, "User email is required"),
  fromEmail: z.string().min(1, "From email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  startTime: z.string().min(1, "Start time is required"),
  delayBetweenMs: z.number().positive("Delay must be positive"),
  hourlyLimit: z.number().min(0, "Hourly limit must be 0 or greater"),
  recipients: z.array(z.string().min(1)).min(1, "At least one recipient is required"),
});