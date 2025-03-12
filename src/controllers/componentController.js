const getFolderPath = async (drive, folder) => {
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


export const listFolders = async (driveInstance) => {
  const response = await driveInstance.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id, name, createdTime, parents)",
    orderBy: "name",
    pageSize: 1000,
  });
  const foldersWithPath = await Promise.all(
    response.data.files.map(async (folder) => {
      try {
      const path = await getFolderPath(driveInstance, folder);
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

  return foldersWithPath;
}