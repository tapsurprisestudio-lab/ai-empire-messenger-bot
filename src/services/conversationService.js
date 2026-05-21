/**
 * Conversation Service
 * Manages conversation memory, context, and history using LowDB (JSON file database)
 * Each user gets their own conversation thread
 */

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize database
const adapter = new FileSync(path.join(DATA_DIR, "conversations.json"));
const db = low(adapter);

// Default schema
db.defaults({ conversations: {} }).write();

const MAX_HISTORY_SIZE = 50; // Max messages to store per user
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a conversation for a user
 */
async function getOrCreate(senderId) {
  const existing = db.get(`conversations.${senderId}`).value();

  if (existing) {
    // Check if session expired (new session = reset context but keep history)
    const lastActivity = new Date(existing.lastActivity);
    const timeSince = Date.now() - lastActivity.getTime();

    if (timeSince > SESSION_TIMEOUT_MS) {
      logger.debug(`Session expired for ${senderId}, starting fresh`);
      return resetSession(senderId, existing);
    }

    return existing;
  }

  // Create new conversation
  const conversation = {
    senderId,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    messageCount: 0,
    history: [],
    context: {},
    leadCaptured: false,
    sessionCount: 1,
  };

  db.set(`conversations.${senderId}`, conversation).write();
  logger.info(`📝 New conversation started for ${senderId}`);
  return conversation;
}

/**
 * Add a message to conversation history
 */
function addMessage(senderId, role, content, intent = null) {
  const conversation = db.get(`conversations.${senderId}`).value();
  if (!conversation) return;

  const message = {
    role,
    content,
    timestamp: new Date().toISOString(),
    intent: intent
      ? { type: intent.type, score: intent.score, topic: intent.topic }
      : null,
  };

  // Add to history
  let history = [...(conversation.history || []), message];

  // Trim to max size (keep most recent)
  if (history.length > MAX_HISTORY_SIZE) {
    history = history.slice(-MAX_HISTORY_SIZE);
  }

  db.set(`conversations.${senderId}`, {
    ...conversation,
    history,
    messageCount: (conversation.messageCount || 0) + 1,
    lastActivity: new Date().toISOString(),
  }).write();
}

/**
 * Add arbitrary context to a conversation
 */
function addContext(senderId, key, value) {
  const conversation = db.get(`conversations.${senderId}`).value();
  if (!conversation) return;

  db.set(`conversations.${senderId}.context.${key}`, value).write();
  db.set(`conversations.${senderId}.lastActivity`, new Date().toISOString()).write();
}

/**
 * Mark lead as captured for this user
 */
function markLeadCaptured(senderId) {
  db.set(`conversations.${senderId}.leadCaptured`, true).write();
  db.set(`conversations.${senderId}.leadCapturedAt`, new Date().toISOString()).write();
}

/**
 * Reset session (clear context, keep history for reference)
 */
function resetSession(senderId, existing) {
  const updated = {
    ...existing,
    context: {},
    leadCaptured: false,
    sessionCount: (existing.sessionCount || 1) + 1,
    lastActivity: new Date().toISOString(),
  };
  db.set(`conversations.${senderId}`, updated).write();
  return updated;
}

/**
 * Get all conversations (for analytics)
 */
function getAllConversations() {
  return Object.values(db.get("conversations").value() || {});
}

/**
 * Get a specific conversation
 */
function getConversation(senderId) {
  return db.get(`conversations.${senderId}`).value();
}

/**
 * Delete a conversation (GDPR compliance)
 */
function deleteConversation(senderId) {
  db.unset(`conversations.${senderId}`).write();
  logger.info(`🗑️ Conversation deleted for ${senderId}`);
}

module.exports = {
  getOrCreate,
  addMessage,
  addContext,
  markLeadCaptured,
  getAllConversations,
  getConversation,
  deleteConversation,
};
