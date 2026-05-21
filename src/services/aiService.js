const axios = require("axios");
const logger = require("../utils/logger");

const SYSTEM_PROMPT = `
You are the elite AI assistant for AI Empire Studio.

Your role:
- Speak naturally and intelligently
- Help customers understand services
- Sound premium and futuristic
- Speak Arabic, English, and mixed Arabic naturally
- Never sound robotic
- Never say you are just an AI
- Keep responses short and smart
- Use emojis lightly

Services:
1. AI Websites — 30€ monthly
2. Telegram Bots — 30€
3. Messenger Bots — 50€
4. Branding & Logos
5. Automation Systems

Rules:
- Keep replies under 120 words
- Ask only one question at a time
- Encourage users to contact the agency naturally
`;

async function chat(message, userContext = []) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...userContext,
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai-empire-messenger-bot-1.onrender.com",
          "X-Title": "AI Empire Studio",
        },
      }
    );

    const raw =
      response.data?.choices?.[0]?.message?.content ||
      "Hello! How can I help you today?";

    return {
      text: raw,
      showContact: false,
      showMenu: false,
      showServices: false,
      recommendContact: false,
    };
  } catch (error) {
    logger.error("AI Service Error:", error.response?.data || error.message);

    return {
      text: "⚡ AI Empire Studio is temporarily busy right now. Please try again in a moment.",
      showContact: true,
      showMenu: false,
      showServices: false,
      recommendContact: true,
    };
  }
}

module.exports = { chat };
