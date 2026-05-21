/**
 * Spam Guard
 * Per-user message rate limiting and spam detection
 * Prevents bot abuse and message floods
 */

const logger = require("../utils/logger");

// In-memory store: { senderId: { count, firstMessageAt, blocked, blockedUntil } }
const userActivity = new Map();

const CONFIG = {
  // Max messages per window before throttling
  maxMessages: 10,
  // Window duration in ms (1 minute)
  windowMs: 60 * 1000,
  // Block duration if spam detected (5 minutes)
  blockDurationMs: 5 * 60 * 1000,
  // Min time between messages in ms (no faster than 500ms)
  minIntervalMs: 500,
  // Cleanup inactive entries every 10 minutes
  cleanupIntervalMs: 10 * 60 * 1000,
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [senderId, data] of userActivity.entries()) {
    if (now - data.firstMessageAt > CONFIG.windowMs * 2) {
      userActivity.delete(senderId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`🧹 SpamGuard: Cleaned ${cleaned} stale entries`);
  }
}, CONFIG.cleanupIntervalMs);

/**
 * Check if a sender is spamming
 * Returns true if the message should be blocked
 */
function isSpam(senderId) {
  const now = Date.now();
  const data = userActivity.get(senderId);

  if (!data) {
    // First message from this user
    userActivity.set(senderId, {
      count: 1,
      firstMessageAt: now,
      lastMessageAt: now,
      blocked: false,
      blockedUntil: null,
    });
    return false;
  }

  // Check if currently blocked
  if (data.blocked) {
    if (now < data.blockedUntil) {
      logger.debug(`🚫 Blocked message from ${senderId} (unblocks in ${Math.ceil((data.blockedUntil - now) / 1000)}s)`);
      return true;
    } else {
      // Block expired, reset
      data.blocked = false;
      data.blockedUntil = null;
      data.count = 1;
      data.firstMessageAt = now;
      data.lastMessageAt = now;
      userActivity.set(senderId, data);
      return false;
    }
  }

  // Check minimum interval (anti-flood for very fast messages)
  const timeSinceLast = now - data.lastMessageAt;
  if (timeSinceLast < CONFIG.minIntervalMs) {
    logger.warn(`⚡ Too fast from ${senderId}: ${timeSinceLast}ms interval`);
    data.count += 3; // Penalize rapid messages more
  } else {
    data.count++;
  }

  data.lastMessageAt = now;

  // Reset window if expired
  if (now - data.firstMessageAt > CONFIG.windowMs) {
    data.count = 1;
    data.firstMessageAt = now;
    userActivity.set(senderId, data);
    return false;
  }

  // Block if over limit
  if (data.count > CONFIG.maxMessages) {
    data.blocked = true;
    data.blockedUntil = now + CONFIG.blockDurationMs;
    userActivity.set(senderId, data);
    logger.warn(`🚫 SpamGuard: Blocked ${senderId} for ${CONFIG.blockDurationMs / 60000} minutes (${data.count} msgs in window)`);
    return true;
  }

  userActivity.set(senderId, data);
  return false;
}

/**
 * Manually unblock a user (for admin use)
 */
function unblock(senderId) {
  userActivity.delete(senderId);
  logger.info(`✅ SpamGuard: Unblocked ${senderId}`);
}

/**
 * Get current spam stats
 */
function getStats() {
  const total = userActivity.size;
  const blocked = [...userActivity.values()].filter((d) => d.blocked).length;
  return { totalTracked: total, currentlyBlocked: blocked };
}

module.exports = { isSpam, unblock, getStats };
