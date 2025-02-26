import express from "express";
import {
  renderPdfViewer,
  getPdfStream,
} from "../controllers/pdfControllers.js";

const router = express.Router();

router.get("/:fileId", renderPdfViewer);
router.get("/stream/:fileId", getPdfStream);

export default router;
