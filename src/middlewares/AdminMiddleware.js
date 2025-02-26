class AdminMiddleware {
  async isAdmin(req, res, next) {
    const adminKey = req.headers["x-admin-key"] || req.query.adminKey;

    if (adminKey !== process.env.ADMIN_KEY) {
      // For regular requests, render the unauthorized page
      return res.status(401).render("unauthorized", {
        serviceEmail: process.env.SERVICE_EMAIL,
      });
    }

    // Check if user's email is in allowed list
    const allowedEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    if (!allowedEmails.includes(req.user.email)) {
      return res.status(401).render("unauthorized", {
        serviceEmail: process.env.SERVICE_EMAIL,
      });
    }

    req.adminKey = adminKey;
    next();
  }
}

// Export a singleton instance
export const adminMiddleware = new AdminMiddleware();
