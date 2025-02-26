import { createClient } from "redis";

class RedisClient {
  constructor() {
    this.client = null;
  }

  async initRedis() {
    if (this.client) return this.client;

    this.client = createClient({
      username: "default",
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    });

    this.client.on("error", (err) => console.log("Redis Client Error", err));

    try {
      await this.client.connect();
      console.log("Redis connected");
      return this.client;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  getRedisClient() {
    if (!this.client) {
      throw new Error("Redis client not initialized");
    }
    return this.client;
  }
}

// Export a singleton instance
export const redisClient = new RedisClient();

// Initialize Redis client
redisClient.initRedis();
