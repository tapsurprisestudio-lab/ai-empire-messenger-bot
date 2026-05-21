/**
 * FAQ Service
 * Manages frequently asked questions with fuzzy matching
 */

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const adapter = new FileSync(path.join(DATA_DIR, "faqs.json"));
const db = low(adapter);

// Seed with default FAQs on first run
db.defaults({ faqs: getDefaultFAQs() }).write();

/**
 * Find a FAQ that matches the user's message
 */
async function findMatch(message) {
  const faqs = db.get("faqs").filter({ active: true }).value();
  const normalizedMsg = message.toLowerCase().trim();

  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const score = calculateMatchScore(normalizedMsg, faq);
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch) {
    // Increment hit count
    db.get("faqs").find({ id: bestMatch.id }).assign({
      hits: (bestMatch.hits || 0) + 1,
    }).write();
  }

  return bestMatch;
}

/**
 * Calculate similarity score between message and FAQ
 */
function calculateMatchScore(message, faq) {
  const keywords = (faq.keywords || []).map((k) => k.toLowerCase());
  const question = faq.question.toLowerCase();

  // Direct question similarity
  const questionWords = question.split(/\s+/);
  const msgWords = message.split(/\s+/);
  const directMatch = questionWords.filter((w) => msgWords.includes(w)).length / questionWords.length;

  // Keyword presence
  const keywordHits = keywords.filter((k) => message.includes(k)).length;
  const keywordScore = keywords.length > 0 ? keywordHits / keywords.length : 0;

  // Pattern matching (if regex patterns defined)
  let patternScore = 0;
  if (faq.patterns) {
    for (const pattern of faq.patterns) {
      if (new RegExp(pattern, "i").test(message)) {
        patternScore = 1;
        break;
      }
    }
  }

  return Math.max(directMatch * 0.4 + keywordScore * 0.4 + patternScore * 0.2);
}

/**
 * Get top N most-asked FAQs
 */
function getTopFAQs(n = 5) {
  return db
    .get("faqs")
    .filter({ active: true })
    .orderBy("hits", "desc")
    .take(n)
    .value();
}

/**
 * Get all FAQs
 */
function getAllFAQs() {
  return db.get("faqs").value();
}

/**
 * Add a new FAQ
 */
function addFAQ(faq) {
  const { v4: uuidv4 } = require("uuid");
  const newFAQ = { id: uuidv4(), hits: 0, active: true, ...faq };
  db.get("faqs").push(newFAQ).write();
  return newFAQ;
}

/**
 * Default FAQ content - customize for your agency
 */
function getDefaultFAQs() {
  return [
    {
      id: "faq-1",
      question: "What services do you offer?",
      answer: `We offer a full suite of digital marketing services:\n\n📱 Social Media Marketing\n🌐 Web Design & Development\n🔍 SEO & Content Marketing\n💰 Paid Advertising (Google & Meta)\n🎨 Brand Strategy & Design\n📧 Email Marketing\n\nWant to know which one is right for you? I can help!`,
      keywords: ["services", "offer", "do", "provide", "help with"],
      patterns: ["what (do|can) you (do|offer)", "what services"],
      hits: 0,
      active: true,
    },
    {
      id: "faq-2",
      question: "How much do your services cost?",
      answer: `Great question! Our pricing is tailored to each client's goals and scale. Generally:\n\n💰 Social Media Management: from $800/mo\n🌐 Website Design: from $2,500\n🔍 SEO Packages: from $600/mo\n💸 Ad Management: from $500/mo + ad spend\n\nFor an accurate quote, book a FREE 15-minute call with our team — no pressure, no obligation! Would you like to do that?`,
      keywords: ["price", "pricing", "cost", "how much", "fee", "rate", "charge", "budget"],
      patterns: ["how much", "what.*(cost|price|pricing|charge)"],
      hits: 0,
      active: true,
    },
    {
      id: "faq-3",
      question: "How long until I see results?",
      answer: `Timelines vary by service:\n\n⚡ Paid Ads: Results visible within 1-2 weeks\n📱 Social Media: Noticeable growth in 30-60 days\n🔍 SEO: Meaningful organic growth in 3-6 months\n🌐 Website: Live within 4-8 weeks (depending on scope)\n\nWe provide weekly/monthly reports so you're always in the loop. Want to discuss your specific goals and timeline?`,
      keywords: ["results", "timeline", "how long", "when", "fast", "quick", "time"],
      patterns: ["how long", "when will", "how fast"],
      hits: 0,
      active: true,
    },
    {
      id: "faq-4",
      question: "Do you work with small businesses?",
      answer: `Absolutely! We LOVE working with small and medium-sized businesses. Many of our clients are local businesses, solo founders, and growing startups.\n\nWe tailor our services to fit your budget and goals — you don't need a Fortune 500 budget to get Fortune 500 results. 💪\n\nWhat type of business do you run?`,
      keywords: ["small business", "startup", "local", "new business", "entrepreneur", "solopreneur"],
      patterns: ["small (business|company)", "work with.*small", "new (business|company)"],
      hits: 0,
      active: true,
    },
    {
      id: "faq-5",
      question: "Do you offer free consultations?",
      answer: `Yes! We offer a FREE 30-minute strategy call with one of our senior consultants. No pitch, no pressure — just genuine advice about what would move the needle for your business.\n\nIn 30 minutes we'll:\n✅ Audit your current online presence\n✅ Identify your biggest growth opportunities\n✅ Recommend the best next steps\n\nWant to book your free call?`,
      keywords: ["free consultation", "free call", "consultation", "discovery call", "meeting"],
      patterns: ["free (call|consult|consultation|meeting)", "book.*call"],
      hits: 0,
      active: true,
    },
    {
      id: "faq-6",
      question: "How do I get started?",
      answer: `Getting started is super easy! Here's how:\n\n1️⃣ Book a FREE strategy call (15-30 min)\n2️⃣ We audit your current situation\n3️⃣ We propose a custom plan\n4️⃣ You approve & we start within 7 days\n\nMost clients are up and running within 2 weeks. Ready to kick things off?`,
      keywords: ["get started", "start", "begin", "sign up", "join", "onboard"],
      patterns: ["how (do i|to) (get started|start|begin)", "want to (start|begin)"],
      hits: 0,
      active: true,
    },
    {
      id: "faq-7",
      question: "Can I see examples of your work?",
      answer: `We have a portfolio of successful client campaigns and projects. Our case studies show real results:\n\n📈 Local restaurant: 400% increase in Instagram followers\n🛒 E-commerce brand: 3x ROAS on Google Ads\n🏥 Healthcare clinic: #1 Google ranking in 6 months\n\nWant me to send you our full portfolio or connect you with our team to walk through relevant case studies?`,
      keywords: ["portfolio", "case study", "examples", "work", "clients", "results", "proof"],
      patterns: ["(show|see|have) (example|sample|portfolio|case)", "past (work|client|project)"],
      hits: 0,
      active: true,
    },
  ];
}

module.exports = { findMatch, getTopFAQs, getAllFAQs, addFAQ };
