/**
 * Lead Service
 * Captures, stores, and forwards leads
 * Integrates with external webhooks (Zapier, Make, CRMs)
 */

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const conversationService = require("./conversationService");

// Setup DB
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const adapter = new FileSync(path.join(DATA_DIR, "leads.json"));
const db = low(adapter);
db.defaults({ leads: [] }).write();

/**
 * Save a lead to the database
 * @param {string} senderId - Facebook sender ID
 * @param {object} options - Lead metadata
 */
async function saveLead(senderId, options = {}) {
  const { intent, conversation, status = "new", source = "unknown" } = options;

  // Don't save duplicate leads within 1 hour
  const recentLead = db
    .get("leads")
    .find((l) => l.senderId === senderId && Date.now() - new Date(l.createdAt).getTime() < 3600000)
    .value();

  if (recentLead) {
    // Update status if it escalated
    if (getStatusWeight(status) > getStatusWeight(recentLead.status)) {
      db.get("leads").find({ id: recentLead.id }).assign({ status, updatedAt: new Date().toISOString() }).write();
      logger.info(`📊 Lead status upgraded: ${recentLead.status} → ${status} for ${senderId}`);
    }
    return recentLead;
  }

  const lead = {
    id: uuidv4(),
    senderId,
    status, // new | warm | hot | contacted | call_requested | converted
    source,
    intent: intent
      ? { type: intent.type, score: intent.score, topic: intent.topic, signals: intent.signals }
      : null,
    interestedService: conversation?.context?.interested_service || intent?.topic || null,
    messageCount: conversation?.messageCount || 0,
    sessionCount: conversation?.sessionCount || 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [],
  };

  db.get("leads").push(lead).write();
  conversationService.markLeadCaptured(senderId);

  logger.info(`🎯 Lead saved: ${lead.id} | Status: ${status} | Source: ${source} | Intent: ${intent?.type}`);

  // Fire-and-forget external notifications
  notifyExternal(lead).catch((err) =>
    logger.warn(`External notification failed: ${err.message}`)
  );

  return lead;
}

/**
 * Update lead status
 */
function updateLeadStatus(leadId, status, notes = null) {
  const update = { status, updatedAt: new Date().toISOString() };
  if (notes) update.notes = notes;
  db.get("leads").find({ id: leadId }).assign(update).write();
  logger.info(`📝 Lead ${leadId} updated to: ${status}`);
}

/**
 * Get all leads with optional filtering
 */
function getLeads({ status, limit = 50, offset = 0 } = {}) {
  let leads = db.get("leads").orderBy("createdAt", "desc");

  if (status) {
    leads = leads.filter({ status });
  }

  return leads.slice(offset, offset + limit).value();
}

/**
 * Get lead statistics
 */
function getStats() {
  const leads = db.get("leads").value();
  const now = Date.now();

  return {
    total: leads.length,
    today: leads.filter(
      (l) => now - new Date(l.createdAt).getTime() < 86400000
    ).length,
    thisWeek: leads.filter(
      (l) => now - new Date(l.createdAt).getTime() < 604800000
    ).length,
    byStatus: {
      new: leads.filter((l) => l.status === "new").length,
      warm: leads.filter((l) => l.status === "warm").length,
      hot: leads.filter((l) => l.status === "hot").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
      call_requested: leads.filter((l) => l.status === "call_requested").length,
      converted: leads.filter((l) => l.status === "converted").length,
    },
    byService: leads.reduce((acc, l) => {
      const svc = l.interestedService || "Unknown";
      acc[svc] = (acc[svc] || 0) + 1;
      return acc;
    }, {}),
    avgIntentScore: leads.length
      ? (leads.reduce((sum, l) => sum + (l.intent?.score || 0), 0) / leads.length).toFixed(1)
      : 0,
  };
}

// ─── External Integrations ────────────────────────────────────

async function notifyExternal(lead) {
  const promises = [];

  // Generic webhook (Zapier, Make, custom CRM)
  if (process.env.LEADS_WEBHOOK_URL) {
    promises.push(sendWebhook(process.env.LEADS_WEBHOOK_URL, lead));
  }

  // Slack notification for hot leads
  if (process.env.SLACK_WEBHOOK_URL && ["hot", "call_requested"].includes(lead.status)) {
    promises.push(sendSlackNotification(lead));
  }

  await Promise.allSettled(promises);
}

async function sendWebhook(url, lead) {
  await axios.post(url, {
    event: "new_lead",
    lead,
    agency: process.env.AGENCY_NAME,
    timestamp: new Date().toISOString(),
  }, { timeout: 10000 });
  logger.info(`📤 Lead sent to webhook: ${url}`);
}

async function sendSlackNotification(lead) {
  const emoji = lead.status === "hot" ? "🔥" : "📅";
  const message = {
    text: `${emoji} *New ${lead.status.toUpperCase()} Lead!*`,
    attachments: [
      {
        color: lead.status === "hot" ? "#ff4444" : "#36a64f",
        fields: [
          { title: "Status", value: lead.status, short: true },
          { title: "Intent Score", value: `${lead.intent?.score || 0}/10`, short: true },
          { title: "Interested In", value: lead.interestedService || "General inquiry", short: true },
          { title: "Source", value: lead.source, short: true },
          { title: "Messages Exchanged", value: `${lead.messageCount}`, short: true },
          { title: "Lead ID", value: lead.id, short: true },
        ],
        footer: `${process.env.AGENCY_NAME} AI Chatbot`,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  await axios.post(process.env.SLACK_WEBHOOK_URL, message, { timeout: 5000 });
  logger.info(`💬 Slack notification sent for lead ${lead.id}`);
}

function getStatusWeight(status) {
  const weights = { new: 1, warm: 2, hot: 3, contacted: 4, call_requested: 5, converted: 6 };
  return weights[status] || 0;
}

module.exports = { saveLead, updateLeadStatus, getLeads, getStats };
