import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis client configuration
 */
const redisClient: RedisClientType = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<RedisClientType> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  return redisClient;
}

/**
 * Publish message to Redis channel
 */
export async function publishToQueue(
  channel: string,
  message: object
): Promise<void> {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
  }
  await client.publish(channel, JSON.stringify(message));
}

