class ComponentAuthMiddleware {
  async verifyComponentRequest(req, res, next) {
    const componentToken = req.headers["x-component-token"];

    // Check if token exists and matches session
    if (!componentToken || componentToken !== req.session?.componentToken) {
      return res.status(400).json({
        error: "Unauthorized component request",
        debug: {
          hasToken: !!componentToken,
          matches: componentToken === req.session?.componentToken,
          sessionToken: req.session?.componentToken,
        },
      });
    }

    next();
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
