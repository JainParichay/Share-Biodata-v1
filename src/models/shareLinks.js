import { redisClient } from "../config/index.js";
import crypto from "crypto";

class ShareLink {
  constructor() {
    this.client = redisClient.getRedisClient();
  }

  async listFolders() {
    const folders = await this.client.get("driveFolders");
    return JSON.parse(folders);
  }

  async setFolders(folders) {
    await this.client.set("driveFolders", JSON.stringify(folders));
  }

  async getAll() {
    try {
      const keys = await this.client.keys("shareLinks:*");
      if (!keys.length) return [];

      const links = await Promise.all(
        keys.map(async (key) => {
          const data = await this.client.get(key);
          const token = key.split(":")[1];
          // Get view count for this link
          const counters = await this.client.keys(
            `sharedLinkCounter:${token}*`
          );
          let viewCount = 0;

          // Properly handle async operations for counting views
          if (counters.length > 0) {
            const counts = await Promise.all(
              counters.map((key) => this.client.get(key))
            );
            viewCount = counts.reduce(
              (sum, count) => sum + (Number(count) || 0),
              0
            );
          }

          // Get PDF views for files accessed through this link
          const pdfKeys = await this.client.keys(`pdfCounter:${token}:*`);
          let totalPdfViews = 0;

          if (pdfKeys.length > 0) {
            const pdfCounts = await Promise.all(
              pdfKeys.map((key) => this.client.get(key))
            );
            totalPdfViews = pdfCounts.reduce(
              (sum, count) => sum + (Number(count) || 0),
              0
            );
          }

          return {
            ...JSON.parse(data),
            viewCount: viewCount,
            pdfViews: totalPdfViews,
          };
        })
      );

      return links;
    } catch (error) {
      console.error("Error reading share links:", error);
      return [];
    }
  }

  async cacheLink(token, data) {
    await this.client.set("cachedLinkData:" + token, JSON.stringify(data), {
      EX: 3600,
    });
  }

  async getCachedLink(token) {
    const data = await this.client.get("cachedLinkData:" + token);
    await this.client.incr("sharedLinkCounter:" + token);

    return data ? JSON.parse(data) : null;
  }

  async getByToken(token) {
    try {
      const data = await this.client.get("shareLinks:" + token);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Error getting share link:", error);
      return null;
    }
  }

  async create({ folderId, name, expiresAt = null }) {
    try {
      // Format the name to create a URL-friendly token
      const token = name
        .toLowerCase() // Convert to lowercase
        .replace(/\.pdf$/, "") // Remove .pdf extension
        .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
        .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
        .substring(0, 100); // Limit length to 100 chars

      // Add a short random string to prevent conflicts
      const uniqueToken = `${token}-${Math.random()
        .toString(6)
        .substring(2, 6)}`;

      const newLink = {
        token: uniqueToken,
        folderId,
        name,
        createdAt: new Date().toISOString(),
        expiresAt,
      };

      await this.client.set(
        "shareLinks:" + uniqueToken,
        JSON.stringify(newLink),
        expiresAt
          ? { EX: Math.floor((new Date(expiresAt) - Date.now()) / 1000) }
          : {}
      );

      return newLink;
    } catch (error) {
      console.error("Error creating share link:", error);
      throw new Error("Failed to create share link");
    }
  }

  async delete(token) {
    try {
      await this.client.del("shareLinks:" + token);
    } catch (error) {
      console.error("Error deleting share link:", error);
      throw new Error("Failed to delete share link");
    }
  }

  async increaseCounterPdf(fileId, token) {
    await this.client.incr(`pdfCounter:${token}:${fileId}`);
  }

  async getAllCounterPdf() {
    const keys = await this.client.keys("pdfCounter:*");
    return keys.length;
  }

  async getSharedLinksCount() {
    const keys = await this.client.keys("shareLinks:*");
    return keys.length;
  }

  async countUsersSessions() {
    const keys = await this.client.keys("sess:*");
    return keys.length;
  }

  async getRecentUsersSessions() {
    const keys = await this.client.keys("sess:*");
    const sessions = await Promise.all(
      keys.map(async (key) => {
        const data = await this.client.get(key);
        return JSON.parse(data);
      })
    );
    return sessions;
  }
}

// Export a singleton instance
export const shareLinks = new ShareLink();
export default shareLinks;
