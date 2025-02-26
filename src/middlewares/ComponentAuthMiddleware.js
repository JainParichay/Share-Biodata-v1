class ComponentAuthMiddleware {
  async verifyComponentRequest(req, res, next) {
    try {
      const componentToken = req.headers["x-component-token"];

      if (
        !componentToken ||
        !req.session ||
        componentToken !== req.session.componentToken
      ) {
        return res
          .status(401)
          .json({ error: "Unauthorized component request" });
      }

      next();
    } catch (error) {
      console.error("Component auth error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async verifyAdminComponentRequest(req, res, next) {
    const componentToken = req.headers["x-component-token"];

    // Check if token exists and matches session
    if (!componentToken || componentToken !== req.session.componentToken) {
      return res.status(400).json({ error: "Unauthorized component request" });
    }

    // Check if user is admin
    if (!req.adminKey) {
      return res.status(400).json({ error: "Unauthorized component request" });
    }

    next();
  }
}

export const componentAuthMiddleware = new ComponentAuthMiddleware();
