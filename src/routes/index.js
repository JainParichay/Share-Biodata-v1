import crypto from "crypto";
import express from "express";
import authRoutes from "./authRoutes.js";
import componentRoutes from "./componentRoutes.js";
import pdfRoutes from "./pdfRoutes.js";
import sharedRoutes from "./sharedRoutes.js";
import { adminMiddleware, authMiddleware } from "../middlewares/index.js";
import shareLinks from "../models/shareLinks.js";
import { downloadPdf } from "../controllers/pdfControllers.js";

const router = express.Router();

router.get("/", (req, res) => {
  return res.render("landing");
});

router.get("/health", (req, res) => {
  return res.status(200).json({ message: "OK" });
});

router.get("/pdf-download/:fileId", downloadPdf);

router.get("/terms", (req, res) => {
  return res.render("terms");
});

router.get("/privacy", (req, res) => {
  return res.render("privacy");
});

router.get(
  "/admin",
  authMiddleware.requireAuth,
  adminMiddleware.isAdmin,
  authMiddleware.updateLastVisit,
  async (req, res) => {
    if (!req.session) {
      return res.status(500).json({ error: "Session not initialized" });
    }

    // Generate a secure component token
    const componentToken = crypto.randomBytes(32).toString("hex");

    // Store the token in session and wait for it to save
    req.session.componentToken = componentToken;
    await new Promise((resolve) => req.session.save(resolve));

    return res.render("admin/dashboard", {
      user: req.user,
      componentToken,
      adminKey: req.query.adminKey || "",
      path: "/admin",
    });
  }
);

// Public routes
router.use("/auth", authRoutes);
router.use("/api", componentRoutes);

router.use(
  "/pdf",
  authMiddleware.requireAuth,
  authMiddleware.updateLastVisit,
  pdfRoutes
);

router.use(
  "/share",
  authMiddleware.requireAuth,
  authMiddleware.updateLastVisit,
  sharedRoutes
);

export default router;
