import fetch from "node-fetch";
import process from "process";

const URL = "https://biodata.impressment.in";
const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

async function pingWebsite() {
  try {
    const response = await fetch(URL);
    const timestamp = new Date().toLocaleString();

    if (response.ok) {
      console.log(
        `[${timestamp}] Successfully pinged website (Status: ${response.status})`
      );
    } else {
      console.error(
        `[${timestamp}] Failed to ping website (Status: ${response.status})`
      );
    }
  } catch (error) {
    console.error(
      `[${new Date().toLocaleString()}] Error pinging website:`,
      error.message
    );
  }

  // Schedule next ping at random interval
  const nextInterval = Math.floor(
    Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1) + MIN_INTERVAL
  );
  const nextPingMinutes = (nextInterval / 60000).toFixed(1);

  console.log(`Next ping scheduled in ${nextPingMinutes} minutes`);
  setTimeout(pingWebsite, nextInterval);
}

// Start the first ping
console.log("Starting website keep-alive script...");
pingWebsite();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nGracefully shutting down...");
  process.exit(0);
});
