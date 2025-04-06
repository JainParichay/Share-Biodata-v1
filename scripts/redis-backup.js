import { createClient } from "redis";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Redis connection configuration
const redisConfig = {
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD,
};

// Create Redis client
const client = createClient(redisConfig);

// Handle Redis connection events
client.on("error", (err) => console.error("Redis Client Error", err));
client.on("connect", () => console.log("Connected to Redis"));

async function backupRedisData() {
  try {
    // Connect to Redis
    await client.connect();
    console.log("Connected to Redis successfully");

    // Get all keys
    const keys = await client.keys("*");
    console.log(`Found ${keys.length} keys in Redis`);

    // Create an object to store all data
    const redisData = {};

    // Fetch data for each key
    for (const key of keys) {
      try {
        // Get the type of the key
        const type = await client.type(key);

        let value;

        // Handle different data types
        switch (type) {
          case "string":
            value = await client.get(key);
            break;
          case "list":
            value = await client.lRange(key, 0, -1);
            break;
          case "set":
            value = await client.sMembers(key);
            break;
          case "hash":
            value = await client.hGetAll(key);
            break;
          case "zset":
            value = await client.zRange(key, 0, -1, { WITHSCORES: true });
            break;
          default:
            value = `Unsupported type: ${type}`;
        }

        redisData[key] = {
          type,
          value,
        };

        console.log(`Processed key: ${key} (${type})`);
      } catch (err) {
        console.error(`Error processing key ${key}:`, err);
        redisData[key] = {
          type: "error",
          error: err.message,
        };
      }
    }

    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = path.join(backupDir, `redis-backup-${timestamp}.json`);

    // Write data to file
    fs.writeFileSync(filename, JSON.stringify(redisData, null, 2));
    console.log(`Backup completed successfully. File saved to: ${filename}`);

    // Disconnect from Redis
    await client.disconnect();
    console.log("Disconnected from Redis");

    return filename;
  } catch (error) {
    console.error("Error during backup:", error);
    // Make sure to disconnect even if there's an error
    try {
      await client.disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting from Redis:", disconnectError);
    }
    throw error;
  }
}

// Execute the backup function
backupRedisData()
  .then((filename) => {
    console.log(`Backup completed. File saved to: ${filename}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Backup failed:", error);
    process.exit(1);
  });
