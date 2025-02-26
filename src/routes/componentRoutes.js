import express from "express";
import { componentAuthMiddleware } from "../middlewares/ComponentAuthMiddleware.js";

const router = express.Router();

// Map of valid components and their view paths
const VALID_COMPONENTS = {
  StatsCard: "components/admin/StatsCard",
  ShareStats: "components/admin/ShareStats",
  LinkClicksStats: "components/admin/LinkClicksStats",
  RecentActivity: "components/admin/RecentActivity",
  QuickActions: "components/admin/QuickActions",
  Notifications: "components/admin/Notifications",
};

router.post(
  "/components/admin/:component",
  componentAuthMiddleware.verifyComponentRequest,
  async (req, res) => {
    try {
      const componentName = req.params.component;
      const viewPath = VALID_COMPONENTS[componentName];
      if (!viewPath) {
        return res.status(400).json({ error: "Invalid component requested" });
      }

      // Render the component with the provided props
      res.render(viewPath, {
        ...req.body,
        layout: false,
      });
    } catch (error) {
      console.error("Error rendering component:", error);
      res.status(500).send("Error rendering component");
    }
  }
);

export default router;
