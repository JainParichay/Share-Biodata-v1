import { OAuth2Client } from "google-auth-library";
import axios from "axios";

class GoogleAuth {
  constructor() {
    this.clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.error("Missing credentials:", {
        clientId: !!this.clientId,
        clientSecret: !!this.clientSecret,
        redirectUri: !!this.redirectUri,
      });
      throw new Error("Google OAuth credentials are not properly configured");
    }

    this.client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    });
  }

  getAuthUrl(redirectUri = this.redirectUri) {
    return this.client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      include_granted_scopes: true,
      prompt: "consent",
      redirect_uri: redirectUri,
      client_id: this.clientId,
    });
  }

  async getTokens(code, redirectUri = this.redirectUri) {
    try {
      // Exchange authorization code for access token
      const response = await axios.post(
        "https://oauth2.googleapis.com/token",
        {
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("OAuth Error Response:", error.response.data);
        console.error("OAuth Error Status:", error.response.status);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("No response received:", error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error setting up request:", error.message);
      }
      return null;
    }
  }

  async verifyToken(token) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.clientId,
      });
      return ticket.getPayload();
    } catch (error) {
      console.error("Error verifying token:", error);
      return null;
    }
  }

  async refreshTokens(refreshToken) {
    try {
      const response = await axios.post(
        "https://oauth2.googleapis.com/token",
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  }
}

export const googleAuth = new GoogleAuth();
