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

async function restoreRedisData(backupFile) {
  try {
    // Check if backup file exists
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    // Read and parse the backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, "utf8"));
    console.log(
      `Loaded backup data with ${Object.keys(backupData).length} keys`
    );

    // Connect to Redis
    await client.connect();
    console.log("Connected to Redis successfully");

    // Restore each key
    for (const [key, data] of Object.entries(backupData)) {
      try {
        const { type, value } = data;

        // Handle different data types
        switch (type) {
          case "string":
            await client.set(key, value);
            break;
          case "list":
            if (value.length > 0) {
              await client.del(key); // Clear existing list
              await client.lPush(key, value);
            }
            break;
          case "set":
            if (value.length > 0) {
              await client.del(key); // Clear existing set
              await client.sAdd(key, value);
            }
            break;
          case "hash":
            if (Object.keys(value).length > 0) {
              await client.del(key); // Clear existing hash
              await client.hSet(key, value);
            }
            break;
          case "zset":
            if (value.length > 0) {
              await client.del(key); // Clear existing zset
              // Convert array of [member, score] pairs to object
              const scoreMap = {};
              for (let i = 0; i < value.length; i += 2) {
                scoreMap[value[i]] = parseFloat(value[i + 1]);
              }
              await client.zAdd(key, scoreMap);
            }
            break;
          default:
            console.warn(`Skipping key ${key} with unsupported type: ${type}`);
        }

        console.log(`Restored key: ${key} (${type})`);
      } catch (err) {
        console.error(`Error restoring key ${key}:`, err);
      }
    }

    console.log("Restore completed successfully");

    // Disconnect from Redis
    await client.disconnect();
    console.log("Disconnected from Redis");
  } catch (error) {
    console.error("Error during restore:", error);
    // Make sure to disconnect even if there's an error
    try {
      await client.disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting from Redis:", disconnectError);
    }
    throw error;
  }
}

// Get backup file path from command line argument or use the most recent backup
function getBackupFile() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args[0];
  }

  // If no file specified, find the most recent backup
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    throw new Error("Backup directory not found");
  }

  const files = fs
    .readdirSync(backupDir)
    .filter(
      (file) => file.startsWith("redis-backup-") && file.endsWith(".json")
    )
    .map((file) => ({
      name: file,
      path: path.join(backupDir, file),
      time: fs.statSync(path.join(backupDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    throw new Error("No backup files found");
  }

  return files[0].path;
}

// Execute the restore function
try {
  const backupFile = getBackupFile();
  console.log(`Using backup file: ${backupFile}`);

  restoreRedisData(backupFile)
    .then(() => {
      console.log("Restore completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Restore failed:", error);
      process.exit(1);
    });
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
