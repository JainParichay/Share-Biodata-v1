import express from "express";
import { googleAuth } from "../config/googleAuth.js";

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.user) {
    const next = req.query.next || "/";
    return res.redirect(next);
  }
  res.render("auth/login", { next: req.query.next });
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
