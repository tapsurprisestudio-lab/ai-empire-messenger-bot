/**
 * Webhook Handler
 * Handles Facebook Messenger webhook verification and message events
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const logger = require("../utils/logger");
const messageHandler = require("./messageHandler");

// ─── GET: Webhook Verification ────────────────────────────────
// Facebook calls this to verify your webhook endpoint
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    logger.info("✅ Webhook verified successfully by Facebook");
    res.status(200).send(challenge);
  } else {
    logger.warn(`❌ Webhook verification failed. Token mismatch.`);
    res.status(403).json({ error: "Forbidden - Token mismatch" });
  }
});

// ─── POST: Receive Events ─────────────────────────────────────
router.post("/", async (req, res) => {
  // Verify signature for security
  if (!verifySignature(req)) {
    logger.warn("⚠️ Invalid webhook signature - possible spoofing attempt");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Parse body (comes in as raw buffer)
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (e) {
    logger.error("Failed to parse webhook body", e);
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Must respond 200 immediately to Facebook (within 20 seconds)
  res.status(200).json({ status: "received" });

  // Process asynchronously so we don't timeout
  if (body.object === "page") {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        try {
          await messageHandler.handleEvent(event);
        } catch (err) {
          logger.error(`Error handling event: ${err.message}`, {
            event,
            stack: err.stack,
          });
        }
      }
    }
  } else {
    logger.warn(`Unknown webhook object type: ${body.object}`);
  }
});

/**
 * Verify Facebook webhook signature
 * Prevents spoofed requests
 */
function verifySignature(req) {
  // Skip verification if no app secret set (development mode)
  if (!process.env.APP_SECRET) return true;

  const signature = req.headers["x-hub-signature-256"];
  if (!signature) return false;

  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.APP_SECRET)
      .update(req.body)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

module.exports = router;
