import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { testDbConnection } from "./config/db.js";
import { logger } from "./utils/logger.js";
import { setupSwagger } from "./utils/swagger.js";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import hrManagerRoutes from "./routes/hrManager.js";
import userRoutes from "./routes/users.js";
import applicationRoutes from "./routes/applications.js";
import jobPostRoutes from "./routes/jobPosts.js";
import savedJobsRoutes from "./routes/savedJobs.js";
import messageRoutes from "./routes/messages.js";
import interviewRoutes from "./routes/interviews.js";
import onboardingRoutes from "./routes/onboarding.js";
import employeeRoutes from "./routes/employees.js";
import notificationRoutes from "./routes/notifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = process.env.PORT || 5000;
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 100;

const generalLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests, please try again later",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts, please try again later",
  },
  skip: () => process.env.NODE_ENV !== "production",
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many upload attempts, please try again later",
  },
  skip: () => process.env.NODE_ENV !== "production",
});

const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);
const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || localhostPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan("dev"));

// Setup Swagger UI
setupSwagger(app);

// Apply general API rate limiter only in production to avoid blocking local development
if (process.env.NODE_ENV === "production") {
  app.use("/api", generalLimiter);
} else {
  logger.info("[Server] Rate limiter disabled for non-production environment");
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/admin", adminRoutes);
app.use("/api/hr-manager", hrManagerRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/applications/apply", uploadLimiter);
app.use("/api/applications", applicationRoutes);
app.use("/api/job-posts", jobPostRoutes);
app.use("/api/saved-jobs", savedJobsRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/employees", employeeRoutes);

app.use((err, _req, res, _next) => {
  if (process.env.NODE_ENV !== "test") {
    logger.error(`[Server Error] ${err?.message || err} ${err?.stack || ""}`);
  }

  // Handle Multer errors
  if (err?.name === "MulterError") {
    const detail = err.code === "LIMIT_FILE_SIZE" ? "Maximum allowed size depends on the upload type" :
                   err.code === "LIMIT_UNEXPECTED_FILE" ? "Check the expected multipart field name" :
                   err.message;
    return res.status(400).json({ 
      success: false, 
      message: err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : 
               err.code === "LIMIT_UNEXPECTED_FILE" ? "Invalid upload field" : "Invalid upload", 
      detail 
    });
  }

  // Handle known validation/file errors
  if (typeof err?.message === "string" && (err.message.includes("Only PDF, DOC and DOCX") || err.message.includes("Only JPG, PNG, WEBP and GIF"))) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Standardized error response
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  const detail = process.env.NODE_ENV === "production" ? (status === 500 ? "An unexpected error occurred" : undefined) : (err.detail || err.stack);

  return res.status(status).json({
    success: false,
    message,
    ...(detail ? { detail } : {})
  });
});

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in environment variables");
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET is not set in environment variables");
  }

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
  }

  await testDbConnection();

  if (process.env.AUTO_MIGRATE === "true" || process.env.NODE_ENV === "production") {
    try {
      const { execSync } = await import("child_process");
      logger.info("Running automatic database migrations and seed...");
      execSync("node scripts/migrate.js", { stdio: "inherit" });
      execSync("node scripts/seed-sample-jobs.js", { stdio: "inherit" });
      logger.info("Automatic database migrations and seed completed.");
    } catch (migrateErr) {
      logger.warn(`Migration/Seed step encountered an error: ${migrateErr.message}`);
    }
  }

  app.listen(port, () => {
    logger.info(`API server running on http://localhost:${port}`);
  });
};

export { app };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain && process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    logger.error(`Failed to start API server: ${error.message}`);
    process.exit(1);
  });
}

app.get("/", (_req, res) => {
  res.json({ message: "Job Application API is running!" });
});
