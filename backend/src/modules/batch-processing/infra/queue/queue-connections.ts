import Redis from "ioredis";

export function createProducerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 300,
  });
}

export function createWorkerConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}
