import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private redisClient: Redis;
  private readonly LIMIT = 5;
  private readonly DURATION = 60;

  constructor() { }

  async onModuleInit() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
    });

    this.redisClient.on("error", (err) =>
      this.logger.error(`Redis Client Error: ${err.message}`, err.stack),
    );

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Redis connection timed out"));
        }, this.redisClient.options.connectTimeout || 10000);

        if (this.redisClient.status === "ready") {
          this.logger.log("Connected to Redis");
          resolve();
        }

        this.redisClient.on("connect", () => {
          clearTimeout(timeout);
          this.logger.log("Connected to Redis");
          resolve();
        });

        this.redisClient.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown Redis connection error";
      this.logger.error(
        `Failed to connect to Redis during init: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.status !== "end") {
      try {
        await this.redisClient.quit();
        this.logger.log("Disconnected from Redis");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.logger.error(
          `Error disconnecting from Redis: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async isRateLimited(ipAddress: string): Promise<boolean> {
    if (!this.redisClient || this.redisClient.status !== "ready") {
      this.logger.error(
        "Redis client not ready, allowing request (failing open).",
      );
      return false;
    }

    const key = `rate-limit:${ipAddress}`;
    const now = Date.now();
    const windowStart = now - this.DURATION * 1000;

    try {
      const pipeline = this.redisClient.multi();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      pipeline.zcard(key);
      pipeline.expire(key, this.DURATION);

      const results = await pipeline.exec();

      if (!results) {
        this.logger.error("Redis pipeline command failed to execute.");
        return false;
      }

      let errorInPipeline = false;
      results.forEach(([err], index) => {
        if (err) {
          this.logger.error(`Redis pipeline error at step ${index}:`, err);
          errorInPipeline = true;
        }
      });

      if (errorInPipeline) {
        return false;
      }

      const countResult = results[2];
      if (countResult[0]) {
        this.logger.error(
          "Redis zcard command failed within pipeline:",
          countResult[0],
        );
        return false;
      }

      const count = countResult[1] as number;
      return count > this.LIMIT;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error executing rate limit check for ${ipAddress}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
