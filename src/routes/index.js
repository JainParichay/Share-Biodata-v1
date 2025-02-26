import crypto from "crypto";
import express from "express";
import authRoutes from "./authRoutes.js";
import componentRoutes from "./componentRoutes.js";
import pdfRoutes from "./pdfRoutes.js";
import sharedRoutes from "./sharedRoutes.js";
import { adminMiddleware, authMiddleware } from "../middlewares/index.js";
import shareLinks from "../models/shareLinks.js";

const router = express.Router();

router.get(
  "/",
  authMiddleware.requireAuth,
  adminMiddleware.isAdmin,
  async (req, res) => {
    if (!req.session) {
      return res.status(500).json({ error: "Session not initialized" });
    }

    // Generate a secure component token
    const componentToken = crypto.randomBytes(32).toString("hex");

    // Get share links data
    const allShareLinks = await shareLinks.getAll();
    const totalLinks = await shareLinks.getSharedLinksCount();
    const totalPdfViews = await shareLinks.getAllCounterPdf();
    const activeLinks = allShareLinks.filter(
      (link) => !link.expiresAt || new Date(link.expiresAt) > new Date()
    ).length;

    // Store the token in session and wait for it to save
    req.session.componentToken = componentToken;
    await new Promise((resolve) => req.session.save(resolve));

    res.render("admin/dashboard", {
      user: req.user,
      componentToken,
      adminKey: req.query.adminKey || "",
      path: "/admin",
      shareLinks: allShareLinks,
      totalLinks,
      totalPdfViews,
      activeLinks,
    });
  }
);

// Public routes
router.use("/auth", authRoutes);
router.use("/api", componentRoutes);

router.use("/pdf", authMiddleware.requireAuth, pdfRoutes);
router.use("/share", authMiddleware.requireAuth, sharedRoutes);

export default router;
