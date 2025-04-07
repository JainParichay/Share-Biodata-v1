import { google } from "googleapis";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load environment variables
dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Google Drive folder ID to upload to
const TARGET_FOLDER_ID = "1BFJ_yIWtleGixHHBbk-VSeIPol6UQpIq";

// Maximum number of concurrent uploads
const MAX_CONCURRENT_UPLOADS = 5; // Reduced from 10 to avoid rate limits

// Rate limit handling configuration
const RATE_LIMIT_CONFIG = {
  maxRetries: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 32000, // 32 seconds
  backoffFactor: 2,
};

// Initialize the Google Drive API client
async function initializeDriveClient() {
  try {
    // Check if credentials file exists
    const credentialsPath = path.join(__dirname, "..", "credentials.json");
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(
        "credentials.json file not found. Please place your Google API credentials in the root directory."
      );
    }

    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    // Create Drive client
    const drive = google.drive({ version: "v3", auth });
    return drive;
  } catch (error) {
    console.error("Error initializing Drive client:", error);
    throw error;
  }
}

// Helper function to handle rate limits with exponential backoff
async function withRetry(operation, description) {
  let retries = 0;
  let delay = RATE_LIMIT_CONFIG.initialDelay;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      // Check if it's a rate limit error
      const isRateLimit =
        error.message &&
        (error.message.includes("rate limit") ||
          error.message.includes("quota") ||
          error.code === 429 ||
          error.code === 403);

      if (isRateLimit && retries < RATE_LIMIT_CONFIG.maxRetries) {
        retries++;
        console.log(
          `Rate limit hit for ${description}. Retrying in ${
            delay / 1000
          } seconds (attempt ${retries}/${RATE_LIMIT_CONFIG.maxRetries})...`
        );

        // Wait with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Increase delay for next retry
        delay = Math.min(
          delay * RATE_LIMIT_CONFIG.backoffFactor,
          RATE_LIMIT_CONFIG.maxDelay
        );
      } else {
        // If it's not a rate limit error or we've exhausted retries, rethrow
        throw error;
      }
    }
  }
}

// Create a folder in Google Drive
async function createFolder(drive, folderName, parentFolderId) {
  return withRetry(async () => {
    try {
      const fileMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        fields: "id",
      });

      console.log(`Created folder: ${folderName} with ID: ${file.data.id}`);
      return file.data.id;
    } catch (error) {
      console.error(`Error creating folder ${folderName}:`, error);
      throw error;
    }
  }, `creating folder ${folderName}`);
}

// Upload a file to Google Drive
async function uploadFile(drive, filePath, fileName, parentFolderId) {
  return withRetry(async () => {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [parentFolderId],
      };

      const media = {
        mimeType: getMimeType(filePath),
        body: fs.createReadStream(filePath),
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
      });

      console.log(`Uploaded file: ${fileName} with ID: ${file.data.id}`);
      return file.data.id;
    } catch (error) {
      console.error(`Error uploading file ${fileName}:`, error);
      throw error;
    }
  }, `uploading file ${fileName}`);
}

// Get MIME type based on file extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".zip": "application/zip",
    ".json": "application/json",
    ".js": "application/javascript",
    ".html": "text/html",
    ".css": "text/css",
    ".md": "text/markdown",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

// Process items in a directory (files and subdirectories)
async function processDirectoryItems(drive, dirPath, parentFolderId) {
  // Read directory contents
  const items = fs.readdirSync(dirPath);

  // Separate files and directories
  const files = [];
  const directories = [];

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      directories.push({ name: item, path: itemPath });
    } else {
      files.push({ name: item, path: itemPath });
    }
  }

  // Process files in parallel with a concurrency limit
  const fileUploadPromises = [];
  for (let i = 0; i < files.length; i += MAX_CONCURRENT_UPLOADS) {
    const batch = files.slice(i, i + MAX_CONCURRENT_UPLOADS);
    const batchPromises = batch.map((file) =>
      uploadFile(drive, file.path, file.name, parentFolderId)
    );
    fileUploadPromises.push(Promise.all(batchPromises));

    // Add a small delay between batches to avoid rate limits
    if (i + MAX_CONCURRENT_UPLOADS < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Wait for all file uploads to complete
  await Promise.all(fileUploadPromises);

  // Process directories recursively with a delay between each
  for (const dir of directories) {
    await uploadDirectory(drive, dir.path, parentFolderId);
    // Add a small delay between directory uploads
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Recursively upload a directory to Google Drive
async function uploadDirectory(drive, dirPath, parentFolderId) {
  try {
    // Get the directory name
    const dirName = path.basename(dirPath);

    // Create a folder in Google Drive
    const folderId = await createFolder(drive, dirName, parentFolderId);

    // Process all items in the directory
    await processDirectoryItems(drive, dirPath, folderId);

    return folderId;
  } catch (error) {
    console.error(`Error uploading directory ${dirPath}:`, error);
    throw error;
  }
}

// Main function to upload folders to Google Drive
async function uploadFoldersToDrive(folderPaths) {
  try {
    // Initialize Drive client
    const drive = await initializeDriveClient();
    console.log("Initialized Google Drive client");

    // Upload each folder sequentially to avoid rate limits
    const results = [];
    for (const folderPath of folderPaths) {
      if (!fs.existsSync(folderPath)) {
        console.error(`Folder not found: ${folderPath}`);
        results.push(null);
        continue;
      }

      console.log(`Uploading folder: ${folderPath}`);
      try {
        const folderId = await uploadDirectory(
          drive,
          folderPath,
          TARGET_FOLDER_ID
        );
        console.log(
          `Successfully uploaded folder: ${folderPath} to Google Drive with ID: ${folderId}`
        );
        results.push(folderId);
      } catch (error) {
        console.error(`Failed to upload folder ${folderPath}:`, error);
        results.push(null);
      }

      // Add a delay between folder uploads
      if (folderPaths.indexOf(folderPath) < folderPaths.length - 1) {
        console.log("Waiting 5 seconds before uploading next folder...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    const successfulUploads = results.filter((id) => id !== null);
    console.log(`Uploaded ${successfulUploads.length} folders successfully`);
  } catch (error) {
    console.error("Error uploading folders to Google Drive:", error);
    throw error;
  }
}

// Get folder paths from command line arguments
function getFolderPaths() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide at least one folder path to upload");
    process.exit(1);
  }
  return args;
}

// Execute the upload function
const folderPaths = getFolderPaths();
console.log(`Uploading folders to Google Drive folder ID: ${TARGET_FOLDER_ID}`);
console.log(`Folders to upload: ${folderPaths.join(", ")}`);

uploadFoldersToDrive(folderPaths)
  .then(() => {
    console.log("Upload completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Upload failed:", error);
    process.exit(1);
  });
