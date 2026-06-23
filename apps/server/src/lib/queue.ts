import { Queue } from "bullmq";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

export const connection = {
  host: redisHost,
  port: redisPort,
};

export const documentQueue = new Queue("document-indexing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true, // Clean up completed jobs
    removeOnFail: false,   // Keep failed jobs for status checking
  },
});
