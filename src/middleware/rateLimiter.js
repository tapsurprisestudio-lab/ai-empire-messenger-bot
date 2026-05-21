/**
 * Rate Limiter Middleware
 * Prevents webhook flooding and API abuse
 */

const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only rate limit POST requests (incoming events)
    return req.method === "GET";
  },
  handler: (req, res) => {
    logger.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: "Too many requests",
      retryAfter: Math.ceil(rateLimiter.windowMs / 1000),
    });
  },
  keyGenerator: (req) => {
    // Rate limit by IP, not per-user (Facebook sends from fixed IPs)
    return req.ip || req.connection.remoteAddress || "unknown";
  },
});

module.exports = { rateLimiter };
