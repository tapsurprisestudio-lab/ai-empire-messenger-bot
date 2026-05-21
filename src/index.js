/**
 * FB AI Chatbot - Main Entry Point
 * Production-grade Facebook Messenger AI chatbot
 */

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");

const logger = require("./utils/logger");
const webhookRouter = require("./handlers/webhook");
const dashboardRouter = require("./handlers/dashboard");
const { rateLimiter } = require("./middleware/rateLimiter");
const { validateEnv } = require("./utils/validateEnv");

// Validate required environment variables on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security & Performance Middleware ───────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Raw body for webhook signature verification
app.use("/webhook", express.raw({ type: "application/json" }));

// JSON for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────
app.use("/webhook", rateLimiter);

// ─── Routes ───────────────────────────────────────────────────
app.use("/webhook", webhookRouter);
app.use("/dashboard", dashboardRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: require("../package.json").version,
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    name: "FB AI Chatbot",
    status: "running",
    docs: "/dashboard",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🤖 FB AI Chatbot running on port ${PORT}`);
  logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  logger.info(`🔗 Webhook: http://localhost:${PORT}/webhook`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
