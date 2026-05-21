/**
 * Analytics Service
 * Tracks user events, conversation metrics, and business insights
 */

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const adapter = new FileSync(path.join(DATA_DIR, "analytics.json"));
const db = low(adapter);
db.defaults({ events: [], dailySummaries: {} }).write();

// In-memory buffer to batch writes (performance optimization)
let buffer = [];
let flushTimeout = null;

const FLUSH_INTERVAL = 5000; // Write to disk every 5 seconds

/**
 * Track a single event
 */
function trackEvent(senderId, eventType, metadata = {}) {
  const event = {
    senderId,
    eventType,
    metadata,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
  };

  buffer.push(event);

  // Schedule flush
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushBuffer, FLUSH_INTERVAL);
  }

  logger.debug(`📊 Event tracked: ${eventType} for ${senderId}`);
}

/**
 * Write buffered events to disk
 */
function flushBuffer() {
  if (buffer.length === 0) {
    flushTimeout = null;
    return;
  }

  const toFlush = [...buffer];
  buffer = [];
  flushTimeout = null;

  try {
    const currentEvents = db.get("events").value();
    // Keep last 10,000 events to prevent unbounded growth
    const allEvents = [...currentEvents, ...toFlush].slice(-10000);
    db.set("events", allEvents).write();
  } catch (err) {
    logger.error(`Analytics flush error: ${err.message}`);
    // Put events back in buffer
    buffer = [...toFlush, ...buffer];
  }
}

/**
 * Get overall analytics summary
 */
function getSummary(days = 30) {
  flushBuffer(); // Ensure latest data
  const events = db.get("events").value();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const recent = events.filter((e) => e.timestamp >= cutoff);

  // Unique users
  const uniqueUsers = new Set(recent.map((e) => e.senderId)).size;
  const uniqueUsersToday = new Set(
    events
      .filter((e) => e.date === new Date().toISOString().split("T")[0])
      .map((e) => e.senderId)
  ).size;

  // Event frequency
  const eventCounts = recent.reduce((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] || 0) + 1;
    return acc;
  }, {});

  // Funnel metrics
  const conversationsStarted = eventCounts["conversation_started"] || 0;
  const contactRequested = eventCounts["contact_requested"] || 0;
  const callBookingInitiated = eventCounts["call_booking_initiated"] || 0;
  const highIntentDetected = eventCounts["high_intent_detected"] || 0;
  const faqMatched = eventCounts["faq_matched"] || 0;

  const conversionRate =
    conversationsStarted > 0
      ? ((contactRequested / conversationsStarted) * 100).toFixed(1)
      : 0;

  // Popular services viewed
  const serviceViews = recent
    .filter((e) => e.eventType === "service_viewed")
    .reduce((acc, e) => {
      const svc = e.metadata?.service || "unknown";
      acc[svc] = (acc[svc] || 0) + 1;
      return acc;
    }, {});

  // Daily active users (last 7 days)
  const dailyActive = getDailyActiveUsers(events, 7);

  return {
    period: `Last ${days} days`,
    users: {
      total: uniqueUsers,
      today: uniqueUsersToday,
      dailyActive,
    },
    funnel: {
      conversations: conversationsStarted,
      highIntentDetected,
      contactRequested,
      callBookingInitiated,
      faqMatched,
      conversionRate: `${conversionRate}%`,
    },
    events: eventCounts,
    topServices: Object.entries(serviceViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([service, count]) => ({ service, count })),
    totalEvents: recent.length,
  };
}

function getDailyActiveUsers(events, days) {
  const result = {};
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    const dayEvents = events.filter((e) => e.date === date);
    result[date] = new Set(dayEvents.map((e) => e.senderId)).size;
  }
  return result;
}

// Flush on process exit
process.on("beforeExit", flushBuffer);
process.on("SIGTERM", () => { flushBuffer(); process.exit(0); });

module.exports = { trackEvent, getSummary };
