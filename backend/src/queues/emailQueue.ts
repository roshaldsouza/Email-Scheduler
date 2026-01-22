import { Queue } from "bullmq";
import { bullConnection } from "../config/redis";

export const emailQueue = new Queue("emailQueue", {
  connection: bullConnection,
});
