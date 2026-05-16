import { Queue } from 'bullmq';
import crypto from 'crypto';
import { config } from '../config';

const redisUrl = new URL(config.redis.url);
export const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379', 10),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
};

export const resumeQueue = new Queue('resume-analysis', { connection: redisConnection });
export const evaluationQueue = new Queue('answer-evaluation', { connection: redisConnection });
export const reportQueue = new Queue('report-generation', { connection: redisConnection });
export const deadLetterQueue = new Queue('dead-letter', { connection: redisConnection });

export async function addResumeJob(data: { resumeId: string; fileUrl: string; fileName: string }) {
  return resumeQueue.add('analyze', data, {
    jobId: `resume-${data.resumeId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addEvaluationJob(data: { answerId: string; question: string; transcript: string; idealAnswer?: string | null }) {
  // Idempotent per (answerId, transcript). Allows re-scoring if transcript changes,
  // while preventing duplicate enqueues for identical content.
  const transcriptHash = crypto
    .createHash('sha1')
    .update(data.transcript || '', 'utf8')
    .digest('hex')
    .slice(0, 12);

  return evaluationQueue.add('evaluate', data, {
    jobId: `eval-${data.answerId}-${transcriptHash}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addReportJob(data: { interviewId: string }) {
  return reportQueue.add('generate', data, {
    jobId: `report-${data.interviewId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}
