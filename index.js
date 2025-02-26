import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { redisClient } from "./src/config/index.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import router from "./src/routes/index.js";

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  // Wait for Redis to be ready
  await redisClient.initRedis();

  // Initialize Redis store for sessions
  const redisStore = new RedisStore({
    client: redisClient.getRedisClient(),
    prefix: "sess:",
    disableTouch: false,
    ttl: 86400, // 1 day in seconds
  });

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static("public"));
  app.use(cookieParser(process.env.SESSION_SECRET));

  // Session configuration
  app.use(
    session({
      store: redisStore,
      secret: process.env.SESSION_SECRET || "your-secret-key",
      name: "sessionId",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      unset: "keep",
      proxy: true,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
        path: "/",
      },
    })
  );

  // Optional: Add session touch middleware to update TTL
  app.use((req, res, next) => {
    if (req.session?.user) {
      req.session.touch(); // Update TTL when session is used
    }
    next();
  });

  // Add trust proxy if you're behind a reverse proxy
  app.set("trust proxy", 1);

  // // Debug middleware - Enhanced logging
  // app.use((req, res, next) => {
  //   console.log("Session Middleware Debug:", {
  //     id: req.sessionID,
  //     isSecure: req.secure,
  //     protocol: req.protocol,
  //     cookie: {
  //       ...req.session?.cookie,
  //       secure: req.session?.cookie?.secure,
  //     },
  //     token: req.session?.componentToken,
  //     isNew: req.session?.isNew,
  //     headers: {
  //       host: req.headers.host,
  //       cookie: req.headers.cookie,
  //     },
  //   });
  //   next();
  // });

  // Set view engine
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  app.set("view engine", "ejs");
  app.set("views", join(__dirname, "src/views"));

  // Routes
  app.use("/", router);

  app.get("*", (req, res) => {
    res.status(404).render("404");
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Start the server and handle any errors
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
