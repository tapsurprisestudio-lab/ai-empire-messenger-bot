/**
 * Intent Detector
 * Analyzes messages for buying intent, topic extraction, and urgency signals
 * Pure functions - no external dependencies, very fast
 */

// ─── Intent Signal Maps ───────────────────────────────────────

const INTENT_SIGNALS = {
  // High-value buying signals (3 points each)
  HIGH_BUY: {
    weight: 3,
    patterns: [
      /\b(ready to (start|begin|hire|buy|purchase))\b/i,
      /\b(want to (work|partner|collaborate))\b/i,
      /\b(looking for (a |an )?(agency|company|team|provider))\b/i,
      /\b(how (much|do) (you|it) cost)\b/i,
      /\b(what('s| is) (your |the )?(price|pricing|rate|fee|package))\b/i,
      /\b(budget|invest(ment)?|spend)\b/i,
      /\b(get started|let's go|sign me up|move forward)\b/i,
      /\b(asap|urgent(ly)?|right away|immediately)\b/i,
      /\b(deadline|launch (date|soon)|going live)\b/i,
      /\b(comparing (options|agencies|providers))\b/i,
    ],
  },

  // Medium buying signals (2 points each)
  MEDIUM_BUY: {
    weight: 2,
    patterns: [
      /\b(interested in|tell me more about|learn more)\b/i,
      /\b(can you help|do you (do|offer|provide))\b/i,
      /\b(what (services|packages) do you)\b/i,
      /\b(results|roi|return on investment|case stud(y|ies))\b/i,
      /\b(portfolio|examples|samples|past work)\b/i,
      /\b(my business|our company|we need|we want)\b/i,
      /\b(struggling with|problem with|issue with|failing at)\b/i,
      /\b(currently (using|working with|paying for))\b/i,
      /\b(switch(ing)?|chang(e|ing))\b/i,
      /\b(need (help|assistance|support) with)\b/i,
    ],
  },

  // Low buying signals (1 point each)
  LOW_BUY: {
    weight: 1,
    patterns: [
      /\b(how (does|do|can))\b/i,
      /\b(what is|what are|explain)\b/i,
      /\b(question(s)?|curious|wondering)\b/i,
      /\b(think(ing)? about|consider(ing)?)\b/i,
      /\b(in the future|eventually|someday)\b/i,
    ],
  },

  // Pain point signals (2 points each)
  PAIN: {
    weight: 2,
    patterns: [
      /\b(not (enough|getting) (traffic|leads|sales|customers|clients))\b/i,
      /\b(losing (customers|clients|business|sales))\b/i,
      /\b(website (is|looks) (old|outdated|bad|slow|broken))\b/i,
      /\b(no (online presence|website|social media))\b/i,
      /\b(competitors? (is|are) (beating|ahead|winning))\b/i,
      /\b(spending (too much|a lot) on ads?)\b/i,
      /\b(email list (is )?(dead|not working|small))\b/i,
      /\b(rank(ing)? (low|badly|poorly|on page [2-9]))\b/i,
    ],
  },
};

// ─── Topic / Service Maps ─────────────────────────────────────

const TOPIC_KEYWORDS = {
  "Social Media Marketing": [
    /\b(social media|instagram|facebook|tiktok|twitter|linkedin|content creation|influencer|followers|engagement)\b/i,
  ],
  "Web Design & Development": [
    /\b(website|web design|landing page|e-?commerce|shopify|wordpress|site|redesign|frontend|ux|ui)\b/i,
  ],
  "SEO & Content Marketing": [
    /\b(seo|search engine|google (ranking|rank)|organic traffic|keywords|backlinks|content marketing|blog)\b/i,
  ],
  "Paid Advertising": [
    /\b(paid ads?|google ads?|facebook ads?|meta ads?|ppc|pay per click|campaigns?|adwords|ad spend|roas)\b/i,
  ],
  "Branding": [
    /\b(brand(ing)?|logo|identity|visual|style guide|colors?|typography|positioning|tagline|name)\b/i,
  ],
  "Email Marketing": [
    /\b(email(s)?|newsletter|mailchimp|klaviyo|automation|drip|sequence|list|subscribers?|open rate)\b/i,
  ],
  "Analytics & Reporting": [
    /\b(analytics|reporting|metrics|kpis?|data|google analytics|tracking|conversions?)\b/i,
  ],
};

// ─── Main Analysis Function ───────────────────────────────────

/**
 * Analyze a message for buying intent
 * @param {string} message - Current user message
 * @param {Array} history - Past messages in conversation
 * @returns {{ type: string, score: number, topic: string|null, signals: string[] }}
 */
function analyze(message, history = []) {
  const text = message + " " + getRecentHistory(history, 3);
  
  let score = 0;
  const signals = [];

  // Check all intent patterns
  for (const [intentType, { weight, patterns }] of Object.entries(INTENT_SIGNALS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        score += weight;
        signals.push(intentType);
        break; // Count each category once
      }
    }
  }

  // Detect topic/service interest
  const topic = detectTopic(text);

  // Determine intent type
  let type = "browsing";
  if (score >= 8) type = "hot_lead";
  else if (score >= 5) type = "warm_lead";
  else if (score >= 2) type = "curious";

  // Cap score at 10
  score = Math.min(10, score);

  return { type, score, topic, signals: [...new Set(signals)] };
}

/**
 * Extract service topic from message
 */
function detectTopic(text) {
  for (const [topic, patterns] of Object.entries(TOPIC_KEYWORDS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return topic;
    }
  }
  return null;
}

/**
 * Get last N messages as a single string for context
 */
function getRecentHistory(history, n) {
  return history
    .slice(-n)
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
}

/**
 * Detect if a message is a greeting (new conversation)
 */
function isGreeting(message) {
  return /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|what'?s up|yo|hiya|greetings?)\b/i.test(
    message.trim()
  );
}

/**
 * Detect if message is asking about pricing
 */
function isPricingQuestion(message) {
  return /\b(price|pricing|cost|how much|rate|fee|package|plan|quote|estimate)\b/i.test(message);
}

/**
 * Detect if message requests human support
 */
function wantsHuman(message) {
  return /\b(human|person|real (person|agent|someone)|talk to (someone|a person)|agent|representative|support team)\b/i.test(
    message
  );
}

module.exports = { analyze, detectTopic, isGreeting, isPricingQuestion, wantsHuman };
