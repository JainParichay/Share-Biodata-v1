import express from "express";
import { componentAuthMiddleware } from "../middlewares/ComponentAuthMiddleware.js";
import { shareLinks } from "../models/shareLinks.js";
import { driveService } from "../config/googleDrive.js";
import { sharedFolderService } from "../controllers/sharedController.js";
import { listFolders } from "../controllers/componentController.js";

const router = express.Router();

// Map of valid components and their view paths
const VALID_COMPONENTS = {
  StatsCard: "components/admin/StatsCard",
  ShareStats: "components/admin/ShareStats",
  LinkClicksStats: "components/admin/LinkClicksStats",
  RecentActivity: "components/admin/RecentActivity",
  QuickActions: "components/admin/QuickActions",
  Notifications: "components/admin/Notifications",
  ShareCreator: "components/admin/ShareCreator",
  ActiveShares: "components/admin/ActiveShares",
  SharedFolderContent: "components/shared/FolderContent",
  SharedFolderBreadcrumbs: "components/shared/Breadcrumbs",
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
      const driveInstance = await driveService.getService();

      switch (componentName) {
        case "ShareCreator":
          // Fetch folders when ShareCreator is loaded
          props.folders = await listFolders(driveInstance);
          break;

        case "ActiveShares":
          // Fetch share links when ActiveShares is loaded
          const allLinks = await shareLinks.getAll();

          // Sort links by createdAt in descending order (newest first)
          props.shareLinks = allLinks.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
          
          // Also fetch folders for stats
          // props.folders = await listFolders(driveInstance);
          break;

        case "StatsCard":
          if (props.title === "Total Share Links") {
            props.value = await shareLinks.getSharedLinksCount();
          } else if (props.title === "Total PDF Opened") {
            props.value = await shareLinks.getAllCounterPdf();
          } else if (props.title === "Active Links") {
            const links = await shareLinks.getAll();
            props.value = links.filter(
              (link) => !link.expiresAt || new Date(link.expiresAt) > new Date()
            ).length;
          } else if (props.title === "Users Sessions") {
            props.value = await shareLinks.countUsersSessions();
          } else if (props.title === "Total Clicks") {
            props.value = await shareLinks.getTotalClicks();
          }
          break;

        case "ShareStats":
          props.shareLinks = await shareLinks.getAll();
          props.shareLinks = props.shareLinks.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
          break;

        case "RecentActivity":
          props.recentActivity = await shareLinks.getRecentUsersSessions();
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
      }

      // Check if client wants JSON
      const wantsJson = req.accepts("json") && !req.accepts("html");

      if (wantsJson) {
        res.json(props);
      } else {
        res.render(viewPath, {
          ...props,
          layout: false,
        });
      }
    } catch (error) {
      console.error("Error rendering component:", error);
      res.status(500).send("Error rendering component");
    }
  }
);

router.post(
  "/components/:component",
  componentAuthMiddleware.verifyComponentRequest,
  async (req, res) => {
    try {
      const componentName = req.params.component;
      const viewPath = VALID_COMPONENTS[componentName];

      if (!viewPath) {
        return res.status(400).json({ error: "Invalid component requested" });
      }

      let props = { ...req.body };
      const driveInstance = await driveService.getService();

      switch (componentName) {
        case "SharedFolderContent":
          const { token, folderId } = props;
          const link = await shareLinks.getByToken(token);

          // Validate folder access
          if (
            folderId &&
            !(await sharedFolderService.validateFolderAccess(
              driveInstance,
              folderId,
              link.folderId
            ))
          ) {
            return res
              .status(403)
              .json({ error: "Access to this folder is not allowed" });
          }

          const currentFolderId = folderId || link.folderId;

          // Get current folder name
          let folderName = link.name;
          if (folderId) {
            const folderData = await driveInstance.files.get({
              fileId: folderId,
              fields: "name",
            });
            folderName = folderData.data.name;
          }

          // Get folders and files
          const [foldersResponse, filesResponse] = await Promise.all([
            driveInstance.files.list({
              q: `'${currentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
              fields: "files(id, name, createdTime, parents)",
              orderBy: "name",
            }),
            driveInstance.files.list({
              q: `'${currentFolderId}' in parents and mimeType contains 'pdf' and trashed = false`,
              fields:
                "files(id, name, mimeType, createdTime, size, thumbnailLink, parents)",
              orderBy: "name",
            }),
          ]);

          props = {
            ...props,
            folders: foldersResponse.data.files,
            files: filesResponse.data.files.map((file) => ({
              ...file,
              previewUrl: `/pdf/${file.id}`,
              downloadUrl: `/pdf/${file.id}/download`,
              formattedSize: sharedFolderService.formatFileSize(file.size),
            })),
            folderName,
            currentFolderId,
          };
          break;

        case "SharedFolderBreadcrumbs":
          const { token: breadcrumbToken, folderId: breadcrumbFolderId } =
            props;
          const breadcrumbLink = await shareLinks.getByToken(breadcrumbToken);

          props.breadcrumbs = await sharedFolderService.getSharedBreadcrumbs(
            driveInstance,
            breadcrumbFolderId || breadcrumbLink.folderId,
            breadcrumbLink.folderId,
            breadcrumbLink.name
          );
          break;
      }

      // Check if client wants JSON
      const wantsJson = req.accepts("json") && !req.accepts("html");

      if (wantsJson) {
        res.json(props);
      } else {
        res.render(viewPath, {
          ...props,
          layout: false,
        });
      }
    } catch (error) {
      console.error("Error rendering component:", error);
      res.status(500).send("Error rendering component");
    }
  }
);


export default router;
