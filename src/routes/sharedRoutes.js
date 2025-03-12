import express from "express";
import {
  adminShareManager,
  createShareLink,
  deleteShareLink,
  viewSharedFolder,
} from "../controllers/sharedController.js";
import { adminMiddleware } from "../middlewares/AdminMiddleware.js";
const router = express.Router();

router.get("/:token", viewSharedFolder);
router.get("/", adminMiddleware.isAdmin, adminShareManager);
router.post("/", adminMiddleware.isAdmin, createShareLink);
router.delete("/:token", adminMiddleware.isAdmin, deleteShareLink);

export default router;
