/**
 * Messenger Service
 * Wraps the Facebook Graph API for sending messages
 */

const axios = require("axios");
const logger = require("../utils/logger");

const GRAPH_API_URL = "https://graph.facebook.com/v19.0/me/messages";

/**
 * Core send function - all message types go through this
 */
async function sendMessage(recipientId, messageData) {
  if (!process.env.PAGE_ACCESS_TOKEN) {
    logger.error("PAGE_ACCESS_TOKEN not set - cannot send message");
    return;
  }

  try {
    const response = await axios.post(
      GRAPH_API_URL,
      {
        recipient: { id: recipientId },
        message: messageData,
        messaging_type: "RESPONSE",
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN },
        timeout: 10000,
      }
    );

    logger.debug(`✉️ Message sent to ${recipientId}`, {
      messageId: response.data.message_id,
    });

    return response.data;
  } catch (error) {
    const errData = error.response?.data?.error;
    logger.error(`Failed to send message to ${recipientId}: ${errData?.message || error.message}`, {
      code: errData?.code,
      type: errData?.type,
    });

    // Handle specific Facebook errors
    if (errData?.code === 551) {
      logger.warn(`User ${recipientId} has not opted into receiving messages`);
    }

    throw error;
  }
}

/**
 * Send a typing indicator or seen receipt
 */
async function sendAction(recipientId, action) {
  if (!process.env.PAGE_ACCESS_TOKEN) return;

  try {
    await axios.post(
      GRAPH_API_URL,
      {
        recipient: { id: recipientId },
        sender_action: action,
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN },
        timeout: 5000,
      }
    );
  } catch (error) {
    // Non-critical, don't throw
    logger.debug(`Failed to send action ${action}: ${error.message}`);
  }
}

/**
 * Send a plain text message
 */
async function sendText(recipientId, text) {
  // Split long messages (Facebook limit: 2000 chars)
  if (text.length > 2000) {
    const chunks = splitText(text, 1900);
    for (const chunk of chunks) {
      await sendMessage(recipientId, { text: chunk });
      await delay(400);
    }
    return;
  }
  return sendMessage(recipientId, { text });
}

/**
 * Send quick reply buttons
 */
async function sendQuickReplies(recipientId, { text, quickReplies }) {
  return sendMessage(recipientId, {
    text,
    quick_replies: quickReplies.slice(0, 13).map((qr) => ({
      content_type: qr.content_type || "text",
      title: qr.title?.substring(0, 20),
      payload: qr.payload || qr.title,
      image_url: qr.image_url,
    })),
  });
}

/**
 * Send button template
 */
async function sendButtonMessage(recipientId, { text, buttons }) {
  return sendMessage(recipientId, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text.substring(0, 640),
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: btn.type,
          title: btn.title?.substring(0, 20),
          payload: btn.payload,
          url: btn.url,
          webview_height_ratio: btn.webview_height_ratio || "full",
        })),
      },
    },
  });
}

/**
 * Send generic template (card carousel)
 */
async function sendGenericTemplate(recipientId, elements) {
  return sendMessage(recipientId, {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: elements.slice(0, 10).map((el) => ({
          title: el.title?.substring(0, 80),
          subtitle: el.subtitle?.substring(0, 80),
          image_url: el.image_url,
          default_action: el.default_action,
          buttons: (el.buttons || []).slice(0, 3).map((btn) => ({
            type: btn.type,
            title: btn.title?.substring(0, 20),
            payload: btn.payload,
            url: btn.url,
          })),
        })),
      },
    },
  });
}

/**
 * Send a list template
 */
async function sendListTemplate(recipientId, { topElement, elements, buttons }) {
  return sendMessage(recipientId, {
    attachment: {
      type: "template",
      payload: {
        template_type: "list",
        top_element_style: topElement || "compact",
        elements: elements.slice(0, 4),
        buttons: buttons?.slice(0, 1),
      },
    },
  });
}

/**
 * Set up persistent menu for the page
 * Call this once during setup
 */
async function setupPersistentMenu() {
  try {
    await axios.post(
      "https://graph.facebook.com/v19.0/me/messenger_profile",
      {
        persistent_menu: [
          {
            locale: "default",
            composer_input_disabled: false,
            call_to_actions: [
              { type: "postback", title: "🏠 Main Menu", payload: "GET_STARTED" },
              { type: "postback", title: "💼 Our Services", payload: "VIEW_SERVICES" },
              { type: "postback", title: "📞 Contact Us", payload: "CONTACT_AGENCY" },
              { type: "postback", title: "❓ FAQ", payload: "FAQ" },
              { type: "postback", title: "👤 Talk to Human", payload: "HUMAN_AGENT" },
            ],
          },
        ],
        get_started: { payload: "GET_STARTED" },
        greeting: [
          {
            locale: "default",
            text: `👋 Hi {{user_first_name}}! Welcome to ${process.env.AGENCY_NAME || "our agency"}. I'm your AI assistant — ready to help you grow your business! 🚀`,
          },
        ],
      },
      {
        params: { access_token: process.env.PAGE_ACCESS_TOKEN },
      }
    );
    logger.info("✅ Persistent menu and greeting set up successfully");
  } catch (error) {
    logger.error(`Failed to set up persistent menu: ${error.response?.data?.error?.message || error.message}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function splitText(text, maxLen) {
  const chunks = [];
  while (text.length > maxLen) {
    let cutAt = text.lastIndexOf("\n", maxLen);
    if (cutAt === -1) cutAt = text.lastIndexOf(" ", maxLen);
    if (cutAt === -1) cutAt = maxLen;
    chunks.push(text.substring(0, cutAt));
    text = text.substring(cutAt).trim();
  }
  if (text) chunks.push(text);
  return chunks;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  sendMessage,
  sendAction,
  sendText,
  sendQuickReplies,
  sendButtonMessage,
  sendGenericTemplate,
  sendListTemplate,
  setupPersistentMenu,
};
