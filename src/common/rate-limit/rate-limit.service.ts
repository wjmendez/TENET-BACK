import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number;
};

type MemoryEntry = {
  count: number;
  expiresAt: number;
};

@Injectable()
export class RateLimitService {
  private redis?: Redis;
  private readonly memory = new Map<string, MemoryEntry>();
  private redisReady = false;
  private redisFailed = false;

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const reset = Math.floor(now / 1000 / windowSeconds + 1) * windowSeconds;

    if (limit <= 0) {
      return { allowed: true, remaining: 0, limit, reset };
    }

    const redisResult = await this.consumeRedis(key, limit, windowSeconds);
    if (redisResult) {
      return redisResult;
    }

    return this.consumeMemory(key, limit, windowSeconds, now, reset);
  }

  private async consumeRedis(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult | null> {
    const client = this.getRedis();
    if (!client) {
      return null;
    }

    try {
      if (!this.redisReady) {
        await client.connect();
        this.redisReady = true;
      }

      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSeconds);
      }
      const remaining = Math.max(0, limit - count);
      return {
        allowed: count <= limit,
        remaining,
        limit,
        reset: Math.floor(Date.now() / 1000 / windowSeconds + 1) * windowSeconds,
      };
    } catch {
      this.redisFailed = true;
      return null;
    }
  }

  private consumeMemory(
    key: string,
    limit: number,
    windowSeconds: number,
    now: number,
    reset: number,
  ): RateLimitResult {
    const expiresAt = now + windowSeconds * 1000;
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt });
      return { allowed: true, remaining: limit - 1, limit, reset };
    }

    entry.count += 1;
    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count <= limit,
      remaining,
      limit,
      reset,
    };
  }

  private getRedis(): Redis | null {
    if (this.redisFailed) {
      return null;
    }

    if (this.redis) {
      return this.redis;
    }

    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT || 6379);
    if (!host) {
      return null;
    }

    this.redis = new Redis({
      host,
      port,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    return this.redis;
  }
}
