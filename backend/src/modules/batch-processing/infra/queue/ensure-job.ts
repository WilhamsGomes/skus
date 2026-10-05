import type { Queue } from "bullmq";
import type { RepublishOutcome } from "../../application/ports/enrichment-job.publisher";

export async function ensureJob<T>(
  queue: Queue<T>,
  name: string,
  data: T,
  jobId: string,
): Promise<RepublishOutcome> {
  const job = await queue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === "failed") {
      await job.retry();
      return "retried";
    }
    if (state !== "completed") return "already_queued";
    await job.remove();
  }
  await (queue as Queue).add(name, data, { jobId });
  return "added";
}
