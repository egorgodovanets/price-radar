import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';

/**
 * Pub/sub over Redis, so an event published by one BFF instance reaches
 * WebSocket clients connected to any instance.
 * Two connections: a Redis connection in subscriber mode cannot publish.
 */
export function createRedisPubSub(redisUrl: string): RedisPubSub {
  return new RedisPubSub({
    publisher: new Redis(redisUrl),
    subscriber: new Redis(redisUrl),
  });
}
