import express from "express";
import { componentAuthMiddleware } from "../middlewares/ComponentAuthMiddleware.js";
import { shareLinks } from "../models/shareLinks.js";

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

      // Handle data fetching based on component
      let props = { ...req.body };

      switch (componentName) {
        case "StatsCard":
          if (props.title === "Total Share Links") {
            props.value = await shareLinks.getSharedLinksCount();
          } else if (props.title === "Total PDF Views") {
            props.value = await shareLinks.getAllCounterPdf();
          } else if (props.title === "Active Links") {
            const allLinks = await shareLinks.getAll();
            props.value = allLinks.filter(
              (link) => !link.expiresAt || new Date(link.expiresAt) > new Date()
            ).length;
          } else if (props.title === "Users Sessions") {
            props.value = await shareLinks.countUsersSessions();
          }
          break;

        case "ShareStats":
          props.shareLinks = await shareLinks.getAll();
          break;

        case "RecentActivity":
          props.recentActivity = await shareLinks.getRecentUsersSessions();
          // Sort by lastVisit time (most recent first)
          props.recentActivity.sort((a, b) => {
            const timeA = a.lastVisit
              ? new Date(a.lastVisit).getTime()
              : new Date(a.cookie.expires).getTime() - a.cookie.originalMaxAge;
            const timeB = b.lastVisit
              ? new Date(b.lastVisit).getTime()
              : new Date(b.cookie.expires).getTime() - b.cookie.originalMaxAge;
            return timeB - timeA;
          });
          break;

        // Add other component data fetching as needed
      }

      // Render the component with the fetched data
      res.render(viewPath, {
        ...props,
        layout: false,
      });
    } catch (error) {
      console.error("Error rendering component:", error);
      res.status(500).send("Error rendering component");
    }
  }
);

export default router;
