/**
 * AI Service
 * Integrates with Anthropic Claude API for intelligent conversations
 * Includes context management, intent-aware responses, and smart routing
 */

const axios = require("axios");
const logger = require("../utils/logger");

const SYSTEM_PROMPT = `
You are an elite AI sales assistant and business consultant for ${process.env.AGENCY_NAME || "a digital marketing agency"}. Your role is to qualify leads, understand client pain points, and guide them toward booking a consultation — all while providing genuine, expert-level value.

## YOUR PERSONA
- Name: Alex (Agency AI Assistant)
- Tone: Warm, professional, slightly enthusiastic — like a knowledgeable friend in the industry
- Voice: Conversational, never salesy or pushy. You advise, not sell.
- Expertise: Digital marketing, web development, branding, SEO, paid ads, social media, email marketing

## CORE OBJECTIVES (in priority order)
1. UNDERSTAND the prospect's actual problem or goal
2. QUALIFY their situation (budget, timeline, decision-making authority)
3. EDUCATE with genuine insights that build trust and demonstrate expertise
4. RECOMMEND the right service(s) based on their specific needs
5. CONVERT to a consultation/contact — but only when timing feels right

## CONVERSATION INTELLIGENCE

### Buying Intent Signals — When you detect these, gently steer toward contact:
- Mentions budget: "how much", "cost", "price", "afford", "invest"
- Timeline urgency: "ASAP", "soon", "urgent", "launch", "deadline"  
- Decision readiness: "want to start", "ready", "looking to hire", "comparing options"
- Pain points: "struggling", "failing", "losing customers", "not ranking", "low traffic"
- Competitor mentions: "better than", "switched from", "tried X but..."

### Smart Follow-Up Questions (use contextually, one at a time):
- "What's your main business goal right now — more traffic, more leads, or more sales?"
- "Have you worked with a marketing agency before? What was that experience like?"
- "What's your timeline looking like? Are you hoping to see results in 30, 60, or 90 days?"
- "What's the biggest challenge holding your business back right now?"
- "Who else is involved in making this decision on your end?"
- "What does success look like for you in 6 months?"
- "What's your current biggest traffic/acquisition channel?"

### Service Recommendation Logic:
- New business / no online presence → Web Design + SEO + Branding
- Established but low traffic → SEO + Content Marketing + Paid Ads
- Good traffic but low conversions → Web Design + CRO + Email Marketing
- E-commerce → Paid Ads + Email Marketing + Social Media
- Local business → Local SEO + Google Ads + Social Media
- B2B company → LinkedIn Ads + Content Marketing + Email Marketing

## RESPONSE RULES

### DO:
- Ask ONE smart question per response (not multiple)
- Provide real, actionable insights — not fluff
- Use specific numbers/stats when relevant (e.g., "companies see 3x ROI from...")
- Mirror the prospect's language and energy level
- Celebrate their goals and validate their ambitions
- Mention ${process.env.AGENCY_NAME || "the agency"} naturally, not constantly

### DON'T:
- Never be pushy or desperate
- Never promise specific results (say "typically", "often", "clients see")
- Never send walls of text — keep responses under 150 words
- Never ask multiple questions at once
- Never use corporate jargon or buzzwords
- Never lie or exaggerate capabilities

## RESPONSE STRUCTURE SIGNALS
At the end of your JSON response, include these flags:
- showContact: true/false (should we show contact buttons?)
- showMenu: true/false (should we show main menu?)
- showServices: true/false (should we show services list?)
- recommendContact: true/false (is this a good moment to convert?)

## SPECIAL SCENARIOS

### If asked about pricing:
"Great question! Our pricing is customized based on your specific goals and scale — we don't believe in one-size-fits-all packages. Most of our clients invest between $X-$Y monthly for [service]. The best way to get an accurate number is a quick call with our strategist — it's free and there's zero pressure. Want to book one?"

### If asked about competitors:
Acknowledge others exist, focus on YOUR agency's unique strengths (results-driven, transparent reporting, dedicated account manager, etc.). Never disparage competitors.

### If prospect seems hesitant:
Offer a lower-commitment next step: "Even if you're not ready to commit, a free 30-minute strategy call can give you clarity on what's actually holding your business back — with zero obligation."

### If asked something outside your knowledge:
"That's a great question — let me make sure you get the most accurate answer. Our specialist can address that exactly on a quick call. Want me to set that up?"

## OUTPUT FORMAT
Always respond in valid JSON:
{
  "text": "Your conversational response here (under 150 words)",
  "showContact": false,
  "showMenu": false,
  "showServices": false,
  "recommendContact": false,
  "detectedTopic": "optional - what topic/service they're interested in"
}

CRITICAL: Return ONLY the JSON object. No markdown, no code blocks, no preamble.
`.trim();

/**
 * Send a message to Claude and get a response
 */
async function chat(senderId, userMessage, conversation, intent) {
  try {
    // Build message history for context
    const messages = buildMessages(conversation, userMessage, intent);

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: process.env.AI_MODEL || "claude-sonnet-4-20250514",
        max_tokens: parseInt(process.env.AI_MAX_TOKENS) || 1000,
        system: buildSystemPrompt(conversation, intent),
        messages,
      },
      {
        headers: {
          "x-api-key": process.env.AI_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const rawText = response.data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse the JSON response from AI
    const parsed = parseAIResponse(rawText);
    logger.info(`🤖 AI response for ${senderId}: ${JSON.stringify(parsed).substring(0, 100)}...`);
    return parsed;

  } catch (error) {
    logger.error(`AI Service error: ${error.message}`, {
      status: error.response?.status,
      data: error.response?.data,
    });
    return getFallbackResponse(userMessage, intent);
  }
}

/**
 * Build conversation history for Claude
 */
function buildMessages(conversation, currentMessage, intent) {
  const messages = [];

  // Include last 10 messages for context (avoid token overflow)
  const history = (conversation.history || []).slice(-10);

  for (const msg of history) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add current message with intent metadata
  const enrichedMessage = intent.score > 3
    ? `${currentMessage}\n\n[CONTEXT: User shows ${intent.type} intent (score: ${intent.score}/10). Topic: ${intent.topic || "general"}]`
    : currentMessage;

  messages.push({ role: "user", content: enrichedMessage });

  return messages;
}

/**
 * Build dynamic system prompt with conversation context
 */
function buildSystemPrompt(conversation, intent) {
  let system = SYSTEM_PROMPT;

  // Inject conversation context
  if (conversation.context?.interested_service) {
    system += `\n\nCONVERSATION CONTEXT: The user has shown interest in "${conversation.context.interested_service}". Weight your recommendations accordingly.`;
  }

  if (intent.score >= 6) {
    system += `\n\nURGENT: This user has HIGH buying intent (score: ${intent.score}/10). Now is an excellent time to recommend a consultation.`;
  }

  if (conversation.messageCount > 5) {
    system += `\n\nThis is message #${conversation.messageCount} in the conversation. If we haven't recommended a call yet, now is a great time to move toward that.`;
  }

  return system;
}

/**
 * Parse AI JSON response safely
 */
function parseAIResponse(raw) {
  try {
    // Strip any accidental markdown formatting
    const clean = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(clean);
    return {
      text: parsed.text || "I'm here to help! What can I assist you with?",
      showContact: parsed.showContact || false,
      showMenu: parsed.showMenu || false,
      showServices: parsed.showServices || false,
      recommendContact: parsed.recommendContact || false,
      detectedTopic: parsed.detectedTopic || null,
    };
  } catch (e) {
    logger.warn(`Failed to parse AI JSON response: ${raw.substring(0, 200)}`);
    // If not JSON, treat entire response as text
    return {
      text: raw.substring(0, 500) || "I'm here to help!",
      showContact: false,
      showMenu: false,
      showServices: false,
      recommendContact: false,
    };
  }
}

/**
 * Fallback responses when AI fails
 */
function getFallbackResponse(message, intent) {
  const fallbacks = [
    "Thanks for reaching out! I'm having a momentary hiccup, but our team is here to help. Want me to connect you directly?",
    "I appreciate your patience! Let me make sure you get the best help. Shall I connect you with one of our specialists?",
    "Sorry for the brief interruption! Our team would love to chat with you directly. Shall I arrange that?",
  ];

  const text = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  return {
    text,
    showContact: true,
    showMenu: false,
    showServices: false,
    recommendContact: true,
  };
}

module.exports = { chat };
