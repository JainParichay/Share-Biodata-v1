import express from "express";
import { componentAuthMiddleware } from "../middlewares/index.js";

const router = express.Router();

router.post(
  "/components/admin/:component",
  componentAuthMiddleware.verifyComponentRequest,
  async (req, res) => {
    const { component } = req.params;
    const props = req.body;

    try {
      // Validate component name to prevent directory traversal
      const allowedComponents = [
        "StatsCard",
        "RecentActivity",
        "QuickActions",
        "Notifications",
      ];
      if (!allowedComponents.includes(component)) {
        throw new Error("Invalid component requested");
      }

      // Render the component with its props
      res.render(`admin/island/${component}`, {
        ...props,
        user: req.user, // Pass user data to components if needed
      });
    } catch (error) {
      console.error("Error rendering component:", error);
      res.status(500).json({ error: "Failed to load component" });
    }
  }
);

export default router;
