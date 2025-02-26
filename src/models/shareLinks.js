import { redisClient } from "../config/index.js";
import crypto from "crypto";

class ShareLink {
  constructor() {
    this.client = redisClient.getRedisClient();
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
          const viewCount =
            (await this.client.get(`sharedLinkCounter:${token}`)) || 0;

          // Get PDF views for files accessed through this link
          const pdfKeys = await this.client.keys(`pdfCounter:${token}:*`);
          const pdfViews =
            pdfKeys.length > 0
              ? await Promise.all(pdfKeys.map((key) => this.client.get(key)))
              : [];
          const totalPdfViews = pdfViews.reduce(
            (sum, views) => sum + Number(views || 0),
            0
          );

          return {
            ...JSON.parse(data),
            viewCount: Number(viewCount),
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
      const token = crypto.randomBytes(16).toString("hex");

      const newLink = {
        token,
        folderId,
        name,
        createdAt: new Date().toISOString(),
        expiresAt,
      };

      await this.client.set(
        "shareLinks:" + token,
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
}

// Export a singleton instance
export const shareLinks = new ShareLink();
export default shareLinks;
