import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DriveService {
  constructor() {
    const str = process.env.CREDENTIALS;
    this.drive = null;
    console.log(str);
    console.log(str.replace("\\n", "\n").replace('\"', '"'));
    this.credentials = JSON.parse(str.replace(/\\n/g, "\n").replace('"', '"'));
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
