import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DriveService {
  constructor() {
    this.drive = null;
    this.credentials = JSON.parse(process.env.CREDENTIALS);
    this.credentials.private_key = this.credentials.private_key.replace(/\\n/g, "\n");
  }

  async getService() {
    if (this.drive) {
      return this.drive;
    }

    try {
      // Use GoogleAuth instead of JWT
      const auth = new google.auth.GoogleAuth({
        credentials: this.credentials,
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      });

      // Initialize the drive
      this.drive = google.drive({
        version: "v3",
        auth,
      });

      return this.drive;
    } catch (error) {
      console.error("Error initializing Google Drive service:", error);
      throw new Error("Failed to initialize Google Drive service");
    }
  }
}

// Export an instance of the DriveService class
export const driveService = new DriveService();
