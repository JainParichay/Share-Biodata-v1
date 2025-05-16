import express from "express";
import { googleAuth } from "../config/googleAuth.js";

const router = express.Router();

// Helper function to convert string to title case
function toTitleCase(str) {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

router.get("/login", (req, res) => {
  if (req.user?.isAuthenticated) {
    const next = req.query.next || "/";
    return res.redirect(next);
  }

  let title = "Jain Parichay Biodata Group Login";

  if (req.query.next) {
    const nextPath = req.query.next
      .replace("/share/", "")
      .replace("/admin/", "")
      .replace(/-/g, " ")
      // Remove the last 4 numbers if they exist
      .replace(/\d{4}$/, "");

    const returnTo = req.query.next;
    title = "Jain Parichay Biodata Group - " + toTitleCase(nextPath);

    res.cookie("returnTo", returnTo, {
      httpOnly: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
    });
  }

  res.redirect("/logto/sign-in");
});

router.get("/google", (req, res) => {
  const next = req.query.next || "/";
  // Store the return URL in a cookie
  res.cookie("returnTo", next, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000, // 5 minutes
  });
  const authUrl = googleAuth.getAuthUrl();
  res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  const returnTo = req.cookies?.returnTo || "/";

  if (!code) {
    console.error("No code received from Google");
    return res.status(400).render("error", {
      error: "Authentication failed - no code received",
    });
  }

  try {
    const tokens = await googleAuth.getTokens(code);
    if (!tokens?.id_token) {
      throw new Error("No ID token received from Google");
    }

    const user = await googleAuth.verifyToken(tokens.id_token);
    if (!user) {
      throw new Error("Failed to verify user token");
    }

    // Set cookie with ID token
    res.cookie("googleToken", tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000, // 1 hour
      sameSite: "lax",
    });

    if (tokens.refresh_token) {
      res.cookie("googleRefreshToken", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    // Clear the returnTo cookie
    res.clearCookie("returnTo");

    // Redirect to the original URL
    res.redirect(returnTo);
  } catch (error) {
    console.error("Auth error details:", error);
    res.status(500).render("error", {
      error: "Authentication failed. Please try again.",
    });
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("googleToken");
  res.clearCookie("googleRefreshToken");
  res.redirect("/auth/login");
});

export default router;
