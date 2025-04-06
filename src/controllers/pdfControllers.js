import { driveService } from "../config/googleDrive.js";
import { shareLinks as shareLinksModel } from "../models/shareLinks.js";
import NodeCache from "node-cache";

// Cache for PDF metadata (10 minutes TTL)
const pdfCache = new NodeCache({
  stdTTL: 600, // 10 minutes
  checkperiod: 120, // Check for expired entries every 2 minutes
  useClones: false,
});

export const renderPdfViewer = async (req, res) => {
  try {
    const { fileId } = req.params;
    const token = req.query.token; // Get token from query params
    if (token) {
      await shareLinksModel.increaseCounterPdf(fileId, token);
    }
    res.render("pdfViewer", {
      fileId,
      title: "PDF Viewer",
      user: req.user,
    });
  } catch (error) {
    console.error("Error rendering PDF viewer:", error);
    res.status(500).send("Error loading PDF viewer");
  }
};

export const getPdfStream = async (req, res) => {
  try {
    const { fileId } = req.params;
    const range = req.headers.range;

    // Try to get metadata from cache
    let fileMetadata = pdfCache.get(fileId);
    const drive = await driveService.getService();

    if (!fileMetadata) {
      // Get and cache file metadata if not in cache
      fileMetadata = await drive.files
        .get({
          fileId,
          fields: "id, name, mimeType, size",
        })
        .catch((error) => {
          console.error("Error getting file metadata:", error);
          throw new Error("File not found or inaccessible");
        });

      if (fileMetadata.data.mimeType !== "application/pdf") {
        return res.status(400).send("File is not a PDF");
      }

      pdfCache.set(fileId, fileMetadata.data);
      fileMetadata = fileMetadata.data;
    }

    // Set basic headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour cache
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileMetadata.name}"`
    );

    // Handle range requests for better streaming
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileMetadata.size - 1;
      const chunksize = end - start + 1;

      res.setHeader(
        "Content-Range",
        `bytes ${start}-${end}/${fileMetadata.size}`
      );
      res.setHeader("Content-Length", chunksize);
      res.status(206); // Partial Content

      // Get specific byte range
      const response = await drive.files
        .get(
          {
            fileId,
            alt: "media",
            headers: {
              Range: `bytes=${start}-${end}`,
            },
          },
          { responseType: "stream" }
        )
        .catch((error) => {
          console.error("Error getting file stream:", error);
          throw new Error("Failed to stream file");
        });

      // Add error handling for the stream
      response.data.on("error", (error) => {
        console.error("Stream error:", error);
        if (!res.headersSent) {
          res.status(500).send("Error streaming PDF");
        }
      });

      // Pipe the range stream to response
      response.data.pipe(res);
    } else {
      // Full file request
      const response = await drive.files
        .get(
          {
            fileId,
            alt: "media",
          },
          { responseType: "stream" }
        )
        .catch((error) => {
          console.error("Error getting file stream:", error);
          throw new Error("Failed to stream file");
        });

      // Add error handling for the stream
      response.data.on("error", (error) => {
        console.error("Stream error:", error);
        if (!res.headersSent) {
          res.status(500).send("Error streaming PDF");
        }
      });

      // Set content length for full file
      res.setHeader("Content-Length", fileMetadata.size);

      // Pipe the full stream to response
      response.data.pipe(res);
    }
  } catch (error) {
    console.error("Error streaming PDF:", error.message);
    if (!res.headersSent) {
      res.status(500).send(`Error streaming PDF: ${error.message}`);
    }
  }
};

export const downloadPdf = async (req, res) => {
  try {
    const { fileId } = req.params;
    const drive = await driveService.getService();

    const fileMetadata = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size",
    });

    if (fileMetadata.data.mimeType !== "application/pdf") {
      return res.status(400).send("File is not a PDF");
    }

    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileMetadata.data.name}"`
    );

    response.data.pipe(res);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    res.status(500).send("Error downloading PDF");
  }
};
