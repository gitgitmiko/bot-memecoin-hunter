import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient: RedisClientType = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export async function initRedis(): Promise<RedisClientType> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

export function getRedisClient(): RedisClientType {
  return redisClient;
}

