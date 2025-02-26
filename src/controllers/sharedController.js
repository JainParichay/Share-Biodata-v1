import { driveService } from "../config/googleDrive.js";
import { shareLinks as shareLinksModel } from "../models/shareLinks.js";

export const viewSharedFolder = async (req, res) => {
  try {
    const { token } = req.params;
    const folderId = req.query.folderId;

    let predata;

    predata = await shareLinksModel.getCachedLink(token + folderId);

    if (!predata) {
      // If no cached version, render the page
      const link = await shareLinksModel.getByToken(token);

      if (!link) {
        return res.status(404).render("error", {
          error: "Share link not found or has expired",
        });
      }

      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        shareLinksModel.delete(token);
        return res.status(410).render("error", {
          error: "This share link has expired",
        });
      }

      const drive = await driveService.getService();

      // Verify that the requested folder is within the shared folder tree
      if (folderId && folderId !== link.folderId) {
        let isValidFolder = false;
        let currentFolder = folderId;

        while (currentFolder) {
          try {
            const folderData = await drive.files.get({
              fileId: currentFolder,
              fields: "parents",
            });

            if (!folderData.data.parents) break;
            if (folderData.data.parents[0] === link.folderId) {
              isValidFolder = true;
              break;
            }
            currentFolder = folderData.data.parents[0];
          } catch (error) {
            console.error("Error checking folder ancestry:", error);
            break;
          }
        }

        if (!isValidFolder) {
          return res.status(403).render("error", {
            error: "Access to this folder is not allowed",
          });
        }
      }

      // Get current folder name
      const currentFolderId = folderId || link.folderId;
      let folderName = link.name;

      if (folderId) {
        try {
          const folderData = await drive.files.get({
            fileId: folderId,
            fields: "name",
          });
          folderName = folderData.data.name;
        } catch (error) {
          console.error("Error getting folder name:", error);
        }
      }

      // Get breadcrumbs
      const breadcrumbs = await getSharedBreadcrumbs(
        drive,
        currentFolderId,
        link.folderId,
        link.name
      );

      // Get folders in the current folder
      const foldersResponse = await drive.files.list({
        q: `'${currentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id, name, createdTime, parents)",
        orderBy: "name",
      });

      // Get PDF files in the current folder
      const filesResponse = await drive.files.list({
        q: `'${currentFolderId}' in parents and mimeType contains 'pdf' and trashed = false`,
        fields:
          "files(id, name, mimeType, createdTime, size, thumbnailLink, parents)",
        orderBy: "name",
      });

      const folders = foldersResponse.data.files;
      const files = filesResponse.data.files.map((file) => ({
        ...file,
        previewUrl: `/pdf/${file.id}`,
        downloadUrl: `/pdf/${file.id}/download`,
        formattedSize: formatFileSize(file.size),
      }));

      predata = {
        folders,
        files,
        folderName,
        breadcrumbs,
        currentFolderId,
        isSharedView: true,
        token,
        serviceEmail: " ",
      };

      await shareLinksModel.cacheLink(token + folderId, predata);
    }

    const host = req.get("host");

    const data = {
      ...predata,
      host,
      user: req.user,
      title: `${predata.folderName} - Shared Folder`,
    };

    // Render the page
    res.render("sharedFolder", data, async (err, html) => {
      if (err) throw err;
      res.send(html);
    });
  } catch (error) {
    console.error("Error viewing shared folder:", error);
    res.status(500).render("error", {
      error: "Failed to load shared folder",
      user: req.user,
    });
  }
};

// Add this new controller function
export const adminShareManager = async (req, res) => {
  try {
    const drive = await driveService.getService();

    // Get all folders with more details
    const foldersResponse = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id, name, createdTime, parents)",
      orderBy: "name",
      pageSize: 1000, // Increase to get all folders
    });

    // Log for debugging
    // console.log("Found folders:", foldersResponse.data.files.length);
    // console.log("First few folders:", foldersResponse.data.files.slice(0, 3));

    // Get folder details including path
    const foldersWithPath = await Promise.all(
      foldersResponse.data.files.map(async (folder) => {
        try {
          const path = await getFolderPath(drive, folder);
          return {
            ...folder,
            fullPath: path.join(" > "),
          };
        } catch (error) {
          console.error(`Error getting path for folder ${folder.name}:`, error);
          return {
            ...folder,
            fullPath: folder.name,
          };
        }
      })
    );

    // Get all share links
    const links = await shareLinksModel.getAll();

    // Get additional details for each share link
    const shareLinksWithDetails = await Promise.all(
      links.map(async (link) => {
        try {
          const folderDetails = await drive.files.get({
            fileId: link.folderId,
            fields: "name, trashed",
          });
          return {
            ...link,
            folderName: folderDetails.data.name,
            isValid: !folderDetails.data.trashed,
          };
        } catch (error) {
          console.error(`Error getting details for share ${link.name}:`, error);
          return {
            ...link,
            folderName: "Unknown or Deleted Folder",
            isValid: false,
          };
        }
      })
    );

    // Sort share links by creation date (newest first)
    shareLinksWithDetails.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Log for debugging
    // console.log("Active share links:", shareLinksWithDetails.length);

    res.render("admin/shareManager", {
      folders: foldersWithPath,
      shareLinks: shareLinksWithDetails.filter((link) => link.isValid), // Only show valid links
      adminKey: process.env.ADMIN_KEY,
      baseUrl: `${req.protocol}://${req.get("host")}`,
      serviceEmail: process.env.SERVICE_EMAIL,
    });
  } catch (error) {
    console.error("Error loading admin page:", error);
    res.status(500).render("error", {
      error: "Failed to load admin page: " + error.message,
    });
  }
};

export const createShareLink = async (req, res) => {
  try {
    const { folderId, name, expiresAt } = req.body;

    const link = await shareLinksModel.create({
      folderId,
      name,
      expiresAt,
    });

    res.status(201).json(link);
  } catch (error) {
    console.error("Error creating share link:", error);
    res.status(500).json({ error: "Failed to create share link" });
  }
};

export const deleteShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    await shareLinksModel.delete(token);
    res.status(200).json({ message: "Share link deleted successfully" });
  } catch (error) {
    console.error("Error deleting share link:", error);
    res.status(500).json({ error: "Failed to delete share link" });
  }
};

// Helper function to get folder path
async function getFolderPath(drive, folder) {
  const path = [folder.name];
  let current = folder;

  while (current.parents && current.parents[0] !== "root") {
    try {
      const parent = await drive.files.get({
        fileId: current.parents[0],
        fields: "id, name, parents",
      });
      path.unshift(parent.data.name);
      current = parent.data;
    } catch (error) {
      console.error("Error getting parent folder:", error);
      break;
    }
  }
  return path;
}

// Helper function for shared folder breadcrumbs
async function getSharedBreadcrumbs(
  drive,
  currentFolderId,
  rootFolderId,
  rootName
) {
  const breadcrumbs = [];

  if (currentFolderId === rootFolderId) {
    return [{ id: rootFolderId, name: rootName }];
  }

  let folder = currentFolderId;
  while (folder) {
    try {
      const response = await drive.files.get({
        fileId: folder,
        fields: "id, name, parents",
      });

      breadcrumbs.unshift({ id: response.data.id, name: response.data.name });

      if (!response.data.parents || response.data.parents[0] === rootFolderId) {
        breadcrumbs.unshift({ id: rootFolderId, name: rootName });
        break;
      }

      folder = response.data.parents[0];
    } catch (error) {
      console.error("Error getting folder for breadcrumbs:", error);
      break;
    }
  }

  return breadcrumbs;
}

// Helper function to format file sizes
export function formatFileSize(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
