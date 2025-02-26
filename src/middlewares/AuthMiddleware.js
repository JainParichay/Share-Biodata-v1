import { googleAuth } from "../config/googleAuth.js";

class AuthMiddleware {
  async requireAuth(req, res, next) {
    // First check if user exists in session
    if (req.session?.user) {
      req.user = req.session.user;
      return next();
    }

    const token = req.cookies?.googleToken;
    const refreshToken = req.cookies?.googleRefreshToken;

    if (!token) {
      // Store the original URL in the query string
      const returnTo = encodeURIComponent(req.originalUrl);
      return res.redirect(`/auth/login?next=${returnTo}`);
    }

    try {
      // Verify token and get user data
      const user = await googleAuth.verifyToken(token);
      if (user) {
        // Store user in session
        req.session.user = user;
        req.user = user;
        return next();
      }
    } catch (error) {
      console.log("Token verification failed:", error.message);

      // Try refresh token if available
      if (refreshToken) {
        try {
          const newTokens = await googleAuth.refreshTokens(refreshToken);
          if (newTokens) {
            // Set new cookies
            res.cookie("googleToken", newTokens.id_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              maxAge: 60 * 60 * 1000, // 1 hour
            });

            if (newTokens.refresh_token) {
              res.cookie("googleRefreshToken", newTokens.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
              });
            }

            const user = await googleAuth.verifyToken(newTokens.id_token);
            if (user) {
              // Store refreshed user data in session
              req.session.user = user;
              req.user = user;
              return next();
            }
          }
        } catch (refreshError) {
          console.error("Error refreshing token:", refreshError);
          // Clear session on refresh error
          req.session.destroy();
        }
      }
    }

    // Authentication failed - clear everything
    res.clearCookie("googleToken");
    res.clearCookie("googleRefreshToken");
    req.session.destroy();
    const returnTo = encodeURIComponent(req.originalUrl);
    return res.redirect(`/auth/login?next=${returnTo}`);
  }

  async setUserIfExists(req, res, next) {
    // First check session
    if (req.session?.user) {
      req.user = req.session.user;
      return next();
    }

    // Fall back to token if no session
    const token = req.cookies?.googleToken;
    if (token) {
      try {
        const user = await googleAuth.verifyToken(token);
        if (user) {
          req.session.user = user;
          req.user = user;
        }
      } catch (error) {
        console.log("Non-critical token verification failed:", error.message);
      }
    }
    next();
  }

  async updateLastVisit(req, res, next) {
    try {
      if (!req.session || !req.session.user) {
        return res.redirect("/auth/login");
      }

      // Only update lastVisit without modifying session expiry
      const originalExpires = req.session.cookie.expires;
      req.session.lastVisit = new Date();
      req.session.cookie.expires = originalExpires;

      await new Promise((resolve) => req.session.save(resolve));
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.redirect("/auth/login");
    }
  }
}

// Export a singleton instance
export const authMiddleware = new AuthMiddleware();
