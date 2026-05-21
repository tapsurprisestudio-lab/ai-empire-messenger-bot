/**
 * Message Handler
 * Routes incoming Messenger events to the right processors
 */

const logger = require("../utils/logger");
const messengerService = require("../services/messengerService");
const aiService = require("../services/aiService");
const conversationService = require("../services/conversationService");
const leadService = require("../services/leadService");
const analyticsService = require("../services/analyticsService");
const intentDetector = require("../services/intentDetector");
const faqService = require("../services/faqService");
const spamGuard = require("../middleware/spamGuard");

const POSTBACK_HANDLERS = {
  GET_STARTED: handleGetStarted,
  CONTACT_AGENCY: handleContactRequest,
  BOOK_CALL: handleBookCall,
  VIEW_SERVICES: handleViewServices,
  FAQ: handleFAQ,
  HUMAN_AGENT: handleHumanAgent,
};

/**
 * Main event dispatcher
 */
async function handleEvent(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;

  // Anti-spam check
  if (spamGuard.isSpam(senderId)) {
    logger.warn(`🚫 Spam blocked for sender: ${senderId}`);
    return;
  }

  // Track message for analytics
  analyticsService.trackEvent(senderId, "message_received");

  // Route by event type
  if (event.message) {
    await handleMessage(senderId, event.message);
  } else if (event.postback) {
    await handlePostback(senderId, event.postback);
  } else if (event.read) {
    logger.debug(`Message read by ${senderId}`);
  } else if (event.delivery) {
    logger.debug(`Message delivered to ${senderId}`);
  }
}

/**
 * Handle incoming text/attachment messages
 */
async function handleMessage(senderId, message) {
  // Ignore echoes (messages sent by the page itself)
  if (message.is_echo) return;

  const text = message.text?.trim();
  const attachments = message.attachments;

  if (!text && !attachments) return;

  // Show typing indicator
  await messengerService.sendAction(senderId, "typing_on");

  try {
    // Handle attachments
    if (attachments && !text) {
      await messengerService.sendText(
        senderId,
        "Thanks for sharing! I can help you better with a text message. What can I help you with today? 😊"
      );
      await sendMainMenu(senderId);
      return;
    }

    // Detect FAQ match first (fast path)
    const faqMatch = await faqService.findMatch(text);
    if (faqMatch) {
      logger.info(`📚 FAQ match for "${text}": ${faqMatch.question}`);
      analyticsService.trackEvent(senderId, "faq_matched", { question: faqMatch.question });
      await messengerService.sendText(senderId, faqMatch.answer);
      await sendFollowUpButtons(senderId);
      return;
    }

    // Get or create conversation memory
    const conversation = await conversationService.getOrCreate(senderId);

    // Detect buying intent
    const intent = intentDetector.analyze(text, conversation.history);
    logger.info(`🎯 Intent detected for ${senderId}: ${intent.type} (score: ${intent.score})`);

    // Update conversation with new message
    conversationService.addMessage(senderId, "user", text, intent);

    // If high buying intent, trigger lead capture flow
    if (intent.score >= 8 && !conversation.leadCaptured) {
      analyticsService.trackEvent(senderId, "high_intent_detected", intent);
      await handleHighIntent(senderId, intent, conversation);
      return;
    }

    // Generate AI response with full context
    const aiResponse = await aiService.chat(senderId, text, conversation, intent);

    // Send AI response
    await messengerService.sendText(senderId, aiResponse.text);

    // Add follow-up actions based on response type
    if (aiResponse.showMenu) {
      await sendMainMenu(senderId);
    } else if (aiResponse.showContact) {
      await sendContactButtons(senderId);
    } else if (aiResponse.showServices) {
      await sendServicesMenu(senderId);
    }

    // Update conversation with AI response
    conversationService.addMessage(senderId, "assistant", aiResponse.text, null);

    // Check if AI recommended contact
    if (aiResponse.recommendContact) {
      analyticsService.trackEvent(senderId, "contact_recommended");
    }

  } finally {
    await messengerService.sendAction(senderId, "typing_off");
  }
}

/**
 * Handle postback button presses
 */
async function handlePostback(senderId, postback) {
  const payload = postback.payload;
  logger.info(`📲 Postback from ${senderId}: ${payload}`);
  analyticsService.trackEvent(senderId, "postback", { payload });

  const handler = POSTBACK_HANDLERS[payload];
  if (handler) {
    await handler(senderId);
  } else if (payload.startsWith("SERVICE_")) {
    await handleServiceInquiry(senderId, payload.replace("SERVICE_", ""));
  } else {
    await messengerService.sendText(senderId, "I'm not sure what you meant. Let me show you what I can help with!");
    await sendMainMenu(senderId);
  }
}

// ─── Specific Flow Handlers ───────────────────────────────────

async function handleGetStarted(senderId) {
  const conversation = await conversationService.getOrCreate(senderId);

  await messengerService.sendText(
    senderId,
    `👋 Welcome! I'm the AI assistant for *${process.env.AGENCY_NAME || "our agency"}*.\n\nI'm here to help you find the perfect solution for your business. Whether you need help with marketing, web development, branding, or strategy — I've got you covered! 🚀`
  );

  await new Promise((r) => setTimeout(r, 800));
  await messengerService.sendText(senderId, "What brings you here today?");
  await sendMainMenu(senderId);

  analyticsService.trackEvent(senderId, "conversation_started");
  conversationService.addMessage(senderId, "assistant", "Get Started flow initiated");
}

async function handleHighIntent(senderId, intent, conversation) {
  const messages = [
    `It sounds like you're ready to take action — that's great! 🎯`,
    `Based on what you've shared, I think we can definitely help with your ${intent.topic || "project"}.`,
    `Our team would love to give you a FREE consultation to understand your needs better.\n\nWould you like to connect with us? 👇`,
  ];

  for (const msg of messages) {
    await messengerService.sendText(senderId, msg);
    await new Promise((r) => setTimeout(r, 600));
  }

  await sendContactButtons(senderId);

  // Save as hot lead
  await leadService.saveLead(senderId, {
    intent,
    conversation,
    status: "hot",
    source: "high_intent_detection",
  });
}

async function handleContactRequest(senderId) {
  const agencyName = process.env.AGENCY_NAME || "our team";
  const email = process.env.AGENCY_EMAIL || "hello@agency.com";
  const phone = process.env.AGENCY_PHONE || "contact us";
  const calendly = process.env.AGENCY_CALENDLY;

  let message = `🎉 Awesome! Here's how to reach *${agencyName}*:\n\n`;
  message += `📧 Email: ${email}\n`;
  message += `📞 Phone: ${phone}\n`;
  if (calendly) message += `📅 Book a call: ${calendly}\n`;
  message += `\nWe typically respond within *2 business hours*. We can't wait to hear about your project!`;

  await messengerService.sendText(senderId, message);

  const conversation = await conversationService.getOrCreate(senderId);
  await leadService.saveLead(senderId, {
    conversation,
    status: "contacted",
    source: "contact_button",
  });

  analyticsService.trackEvent(senderId, "contact_requested");
  await new Promise((r) => setTimeout(r, 1000));
  await messengerService.sendText(senderId, "Is there anything else I can help you with in the meantime? 😊");
}

async function handleBookCall(senderId) {
  const calendly = process.env.AGENCY_CALENDLY;

  if (calendly) {
    await messengerService.sendButtonMessage(senderId, {
      text: "📅 Let's schedule your FREE 30-minute strategy call!\n\nClick below to pick a time that works for you:",
      buttons: [
        { type: "web_url", url: calendly, title: "📅 Book My Free Call" },
        { type: "postback", payload: "CONTACT_AGENCY", title: "💬 Other Contact Options" },
      ],
    });
  } else {
    await handleContactRequest(senderId);
  }

  const conversation = await conversationService.getOrCreate(senderId);
  await leadService.saveLead(senderId, { conversation, status: "call_requested", source: "book_call" });
  analyticsService.trackEvent(senderId, "call_booking_initiated");
}

async function handleViewServices(senderId) {
  await messengerService.sendText(senderId, "Here are our core services 👇 Which area interests you most?");
  await sendServicesMenu(senderId);
}

async function handleFAQ(senderId) {
  const faqs = await faqService.getTopFAQs(5);
  let message = "🙋 Here are our most frequently asked questions:\n\n";
  faqs.forEach((faq, i) => {
    message += `*${i + 1}. ${faq.question}*\n${faq.answer}\n\n`;
  });
  message += "Have a different question? Just type it and I'll do my best to help!";
  await messengerService.sendText(senderId, message);
}

async function handleHumanAgent(senderId) {
  const email = process.env.AGENCY_EMAIL || "hello@agency.com";
  await messengerService.sendText(
    senderId,
    `👤 I'll connect you with a real person from our team!\n\nYou can reach them directly at *${email}* and they'll get back to you ASAP.\n\nAlternatively, leave me your question and I'll make sure it's passed on! 💌`
  );
  analyticsService.trackEvent(senderId, "human_agent_requested");
}

async function handleServiceInquiry(senderId, service) {
  const serviceMap = {
    "SOCIAL_MEDIA": {
      name: "Social Media Marketing",
      desc: "We manage your social media presence, create engaging content, run targeted ads, and grow your audience organically. Our clients see an average 3x increase in engagement within 90 days.",
    },
    "WEB_DESIGN": {
      name: "Web Design & Development",
      desc: "From beautiful landing pages to full e-commerce stores, we build fast, modern, conversion-optimized websites. Mobile-first, SEO-ready, and built to impress.",
    },
    "SEO": {
      name: "SEO & Content Marketing",
      desc: "We get you found on Google. Our data-driven SEO strategy combines technical optimization, quality content, and link building to drive sustainable organic traffic.",
    },
    "PAID_ADS": {
      name: "Paid Advertising (Google & Meta)",
      desc: "Maximize your ad spend with precision-targeted campaigns. We manage Google Ads, Facebook/Instagram Ads, and provide detailed ROI reporting.",
    },
    "BRANDING": {
      name: "Brand Strategy & Design",
      desc: "Build a brand that people remember. Logo design, brand guidelines, messaging strategy, and visual identity that sets you apart from the competition.",
    },
    "EMAIL": {
      name: "Email Marketing",
      desc: "Nurture leads and retain customers with automated email sequences, newsletters, and campaigns that convert. Average 42x ROI.",
    },
  };

  const service_info = serviceMap[service];
  if (service_info) {
    await messengerService.sendText(
      senderId,
      `✨ *${service_info.name}*\n\n${service_info.desc}\n\nWould you like to discuss how this could work for your business?`
    );
    await sendContactButtons(senderId);

    const conversation = await conversationService.getOrCreate(senderId);
    conversationService.addContext(senderId, "interested_service", service_info.name);
    analyticsService.trackEvent(senderId, "service_viewed", { service });
  }
}

// ─── UI Component Builders ────────────────────────────────────

async function sendMainMenu(senderId) {
  await messengerService.sendQuickReplies(senderId, {
    text: "What would you like to explore?",
    quickReplies: [
      { content_type: "text", title: "💼 Our Services", payload: "VIEW_SERVICES" },
      { content_type: "text", title: "💰 Pricing", payload: "PRICING" },
      { content_type: "text", title: "📞 Contact Us", payload: "CONTACT_AGENCY" },
      { content_type: "text", title: "❓ FAQ", payload: "FAQ" },
    ],
  });
}

async function sendContactButtons(senderId) {
  await messengerService.sendButtonMessage(senderId, {
    text: "Ready to take the next step? 🚀",
    buttons: [
      { type: "postback", payload: "BOOK_CALL", title: "📅 Book Free Call" },
      { type: "postback", payload: "CONTACT_AGENCY", title: "📧 Get In Touch" },
      { type: "postback", payload: "HUMAN_AGENT", title: "👤 Talk to Human" },
    ],
  });
}

async function sendFollowUpButtons(senderId) {
  await messengerService.sendQuickReplies(senderId, {
    text: "Was that helpful?",
    quickReplies: [
      { content_type: "text", title: "✅ Yes, thanks!", payload: "HELPFUL_YES" },
      { content_type: "text", title: "🔍 Tell me more", payload: "MORE_INFO" },
      { content_type: "text", title: "📞 Contact Agency", payload: "CONTACT_AGENCY" },
    ],
  });
}

async function sendServicesMenu(senderId) {
  await messengerService.sendGenericTemplate(senderId, [
    {
      title: "📱 Social Media Marketing",
      subtitle: "Grow your audience & engagement",
      buttons: [{ type: "postback", payload: "SERVICE_SOCIAL_MEDIA", title: "Learn More" }],
    },
    {
      title: "🌐 Web Design & Development",
      subtitle: "Beautiful, fast, converting websites",
      buttons: [{ type: "postback", payload: "SERVICE_WEB_DESIGN", title: "Learn More" }],
    },
    {
      title: "🔍 SEO & Content Marketing",
      subtitle: "Rank higher, get more traffic",
      buttons: [{ type: "postback", payload: "SERVICE_SEO", title: "Learn More" }],
    },
    {
      title: "💰 Paid Advertising",
      subtitle: "Google & Meta Ads that convert",
      buttons: [{ type: "postback", payload: "SERVICE_PAID_ADS", title: "Learn More" }],
    },
    {
      title: "🎨 Brand Strategy & Design",
      subtitle: "Stand out from the competition",
      buttons: [{ type: "postback", payload: "SERVICE_BRANDING", title: "Learn More" }],
    },
    {
      title: "📧 Email Marketing",
      subtitle: "Nurture leads, boost retention",
      buttons: [{ type: "postback", payload: "SERVICE_EMAIL", title: "Learn More" }],
    },
  ]);
}

module.exports = { handleEvent };
