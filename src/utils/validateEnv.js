/**
 * Environment Variable Validator
 * Validates required environment variables on startup
 */

const REQUIRED_VARS = [
  { key: "PAGE_ACCESS_TOKEN", description: "Facebook Page Access Token" },
  { key: "VERIFY_TOKEN", description: "Facebook Webhook Verify Token" },
  { key: "AI_API_KEY", description: "Anthropic Claude API Key" },
];

const OPTIONAL_VARS = [
  "AGENCY_NAME",
  "AGENCY_EMAIL",
  "AGENCY_PHONE",
  "AGENCY_WEBSITE",
  "AGENCY_CALENDLY",
  "LEADS_WEBHOOK_URL",
  "SLACK_WEBHOOK_URL",
  "DASHBOARD_API_KEY",
  "APP_SECRET",
];

function validateEnv() {
  const missing = [];
  const warnings = [];

  // Check required vars
  for (const { key, description } of REQUIRED_VARS) {
    if (!process.env[key] || process.env[key].includes("your_")) {
      missing.push(`  ❌ ${key} — ${description}`);
    }
  }

  // Warn about optional but recommended vars
  if (!process.env.AGENCY_NAME) {
    warnings.push("  ⚠️  AGENCY_NAME not set — using default");
  }
  if (!process.env.DASHBOARD_API_KEY && process.env.NODE_ENV === "production") {
    warnings.push("  ⚠️  DASHBOARD_API_KEY not set — dashboard is publicly accessible");
  }
  if (!process.env.APP_SECRET) {
    warnings.push("  ⚠️  APP_SECRET not set — webhook signature verification disabled");
  }

  if (warnings.length > 0) {
    console.warn("\n⚠️  Configuration Warnings:");
    warnings.forEach((w) => console.warn(w));
  }

  if (missing.length > 0) {
    console.error("\n🚨 Missing Required Environment Variables:");
    missing.forEach((m) => console.error(m));
    console.error("\n👉 Copy .env.example to .env and fill in the values.");
    console.error("📚 See README.md for setup instructions.\n");

    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      console.warn("⚠️  Running in development mode with missing vars — some features may not work.\n");
    }
  } else {
    console.log("✅ All required environment variables are set");
  }
}

module.exports = { validateEnv };
