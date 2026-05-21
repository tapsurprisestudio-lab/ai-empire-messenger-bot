# 🤖 FB AI Chatbot — Complete Facebook Messenger AI Lead Generation Bot

> **Production-ready** AI chatbot for Facebook Messenger. Detects buying intent, qualifies leads, answers FAQs, pushes customers toward contacting your agency — all powered by Claude AI.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.18-blue) ![Claude AI](https://img.shields.io/badge/AI-Claude%20Sonnet-purple) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 **Buying Intent Detection** | Scores every message 1-10 for purchase intent using keyword & pattern analysis |
| 🧠 **Conversation Memory** | Remembers full conversation history per user, resets after 30min inactivity |
| 💼 **Lead Saving** | Auto-captures leads to JSON DB with status tracking (new/warm/hot/converted) |
| 📊 **Analytics Dashboard** | Web dashboard showing funnel metrics, lead stats, top services |
| ❓ **FAQ Mode** | Instant answers to common questions with fuzzy matching |
| 🛡️ **Anti-Spam** | Per-user rate limiting with automatic blocking |
| 🔔 **Notifications** | Slack alerts for hot leads + webhook forwarding to any CRM/Zapier |
| 🌐 **Messenger UI** | Persistent menu, quick replies, button templates, carousel cards |

---

## 📁 Project Structure

```
fb-ai-chatbot/
├── src/
│   ├── index.js                    # Express server entry point
│   ├── handlers/
│   │   ├── webhook.js              # Facebook webhook verification & routing
│   │   ├── messageHandler.js       # Message & postback event dispatcher
│   │   └── dashboard.js            # Analytics dashboard + admin API
│   ├── services/
│   │   ├── aiService.js            # Claude AI API integration
│   │   ├── messengerService.js     # Facebook Graph API wrapper
│   │   ├── conversationService.js  # Conversation memory (LowDB)
│   │   ├── leadService.js          # Lead capture & CRM forwarding
│   │   ├── analyticsService.js     # Event tracking & reporting
│   │   ├── faqService.js           # FAQ database & fuzzy matching
│   │   └── intentDetector.js       # Buying intent analysis engine
│   ├── middleware/
│   │   ├── rateLimiter.js          # Global rate limiting
│   │   └── spamGuard.js            # Per-user anti-spam
│   └── utils/
│       ├── logger.js               # Winston structured logging
│       └── validateEnv.js          # Startup env validation
├── data/                           # Auto-created: conversations, leads, analytics, FAQs
├── logs/                           # Auto-created: combined.log, error.log
├── .env.example                    # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- A Facebook Page
- A Facebook Developer account
- An Anthropic API key

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/fb-ai-chatbot.git
cd fb-ai-chatbot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
PAGE_ACCESS_TOKEN=your_token_here
VERIFY_TOKEN=choose_any_random_string
AI_API_KEY=sk-ant-your-anthropic-key
AGENCY_NAME=Your Agency Name
AGENCY_EMAIL=hello@youragency.com
AGENCY_PHONE=+1 (555) 000-0000
AGENCY_CALENDLY=https://calendly.com/youragency
```

### 3. Run Locally

```bash
npm run dev
```

Server starts at `http://localhost:3000`

---

## 🔗 Webhook Setup Guide

### Step 1: Expose Local Server

Use [ngrok](https://ngrok.com) to create a public URL:

```bash
# Install ngrok
npm install -g ngrok

# Expose port 3000
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 2: Facebook Developer Console

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps** → Select your app (or create one)
3. In left sidebar: **Messenger** → **Settings**
4. Scroll to **Webhooks** section
5. Click **Add Callback URL**
6. Enter:
   - **Callback URL**: `https://YOUR_NGROK_URL/webhook`
   - **Verify Token**: The exact value you set in `.env` for `VERIFY_TOKEN`
7. Click **Verify and Save**
8. Under **Webhook Fields**, subscribe to:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `messaging_reads`
   - ✅ `message_deliveries`

### Step 3: Subscribe to Your Page

In the Webhooks section, select your Facebook Page from the dropdown and click **Subscribe**.

### Step 4: Test It

Go to your Facebook Page and send a message — you should see it processed in your terminal logs!

---

## 🌐 Deployment Guide (Render)

[Render](https://render.com) is the easiest free deployment option.

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit - FB AI Chatbot"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/fb-ai-chatbot.git
git branch -M main
git push -u origin main
```

### Step 2: Create Render Service

1. Go to [render.com](https://render.com) → Sign up / Log in
2. Click **New** → **Web Service**
3. Connect your GitHub account
4. Select your `fb-ai-chatbot` repository
5. Configure:

| Setting | Value |
|---|---|
| **Name** | `fb-ai-chatbot` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for production) |

### Step 3: Add Environment Variables

In Render dashboard → **Environment** tab, add all variables from your `.env`:

```
PAGE_ACCESS_TOKEN    = your_value
VERIFY_TOKEN         = your_value
AI_API_KEY           = your_value
AGENCY_NAME          = Your Agency
AGENCY_EMAIL         = hello@agency.com
AGENCY_PHONE         = +1 555 000 0000
AGENCY_CALENDLY      = https://calendly.com/you
NODE_ENV             = production
DASHBOARD_API_KEY    = choose_a_secret_key_for_dashboard
```

### Step 4: Deploy

Click **Create Web Service** — Render will build and deploy automatically.

Your live URL will be: `https://fb-ai-chatbot.onrender.com`

### Step 5: Update Facebook Webhook

Go back to Facebook Developer Console and update your webhook URL to:
`https://fb-ai-chatbot.onrender.com/webhook`

### ⚠️ Render Free Tier Note

Free Render services sleep after 15 minutes of inactivity. Use [UptimeRobot](https://uptimerobot.com) (free) to ping your `/health` endpoint every 5 minutes to keep it awake.

---

## 📤 GitHub Upload Instructions

```bash
# 1. Create a new repository on github.com (don't initialize with README)

# 2. In your project folder:
git init
git add .
git commit -m "🤖 Initial commit — FB AI Chatbot"

# 3. Link to GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 4. Push
git branch -M main
git push -u origin main

# Future updates:
git add .
git commit -m "Your update message"
git push
```

### ⚠️ CRITICAL Security Rules
- **NEVER** commit your `.env` file (it's in `.gitignore` — don't change that)
- **NEVER** hardcode API keys in source code
- Keep your `data/` folder out of Git (contains personal data)

---

## 🤝 Connecting with Facebook Developers

### Full Setup Walkthrough

#### 1. Create a Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps** → **Create App**
3. Select **Business** as app type
4. Fill in App Name (e.g., "YourAgency ChatBot") and email
5. Click **Create App**

#### 2. Add Messenger Product

1. From your app dashboard, find **Messenger** in the product list
2. Click **Set Up**

#### 3. Generate Page Access Token

1. In Messenger → Settings → **Access Tokens**
2. Click **Add or Remove Pages**
3. Select your Facebook Page
4. Copy the **Page Access Token**
5. Paste it in your `.env` as `PAGE_ACCESS_TOKEN`

#### 4. Set Up Webhooks

(See Webhook Setup Guide above)

#### 5. Required Permissions (for production apps)

For live deployment to real users, you'll need Facebook App Review for:
- `pages_messaging` — Send/receive messages
- `pages_manage_metadata` — Subscribe to webhooks

**For testing:** You can add up to 25 test users without App Review.

To add test users:
1. App Dashboard → **Roles** → **Test Users**
2. Add your Facebook account for testing

#### 6. App Review (for public launch)

1. App Dashboard → **App Review** → **Permissions and Features**
2. Request `pages_messaging` permission
3. Submit a 1-minute video showing your bot in action
4. Typical review time: 3-5 business days

---

## 📊 Dashboard

Access your analytics dashboard at:
```
https://your-domain.com/dashboard
```

Set `DASHBOARD_API_KEY` in your `.env` to protect it in production.

### Dashboard API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/dashboard/api/analytics` | GET | Analytics summary (pass `?days=30`) |
| `/dashboard/api/leads` | GET | All leads with stats |
| `/dashboard/api/leads/:id` | PATCH | Update lead status |
| `/dashboard/api/faqs` | GET | All FAQ entries |
| `/dashboard/api/faqs` | POST | Add new FAQ |
| `/dashboard/api/setup-messenger` | POST | Configure page menu & greeting |
| `/dashboard/api/test-message` | POST | Send test message |
| `/webhook` | GET | Health/verify check |
| `/health` | GET | Server health check |

---

## 🧠 AI System Prompt

The bot uses an ultra-advanced system prompt that:

- **Personas**: Warm, expert, non-pushy advisor named "Alex"
- **Intent awareness**: Adapts tone based on buying intent score
- **Smart questioning**: Asks ONE strategic question per message
- **Service routing**: Recommends the right service based on business type
- **Conversion timing**: Knows when to push for contact vs. educate first
- **Fallback handling**: Always has a graceful response for edge cases
- **JSON output**: Structured responses with UI control flags

Customize the system prompt in `src/services/aiService.js` → `SYSTEM_PROMPT` variable.

---

## ⚙️ Customization

### Add Your Services

Edit `handleServiceInquiry()` in `src/handlers/messageHandler.js`:

```javascript
const serviceMap = {
  "YOUR_SERVICE": {
    name: "Your Service Name",
    desc: "Description of what you offer..."
  }
}
```

### Add FAQs

Via API:
```bash
curl -X POST https://your-domain.com/dashboard/api/faqs \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_DASHBOARD_KEY" \
  -d '{
    "question": "Do you offer refunds?",
    "answer": "Yes! We offer a 30-day money-back guarantee.",
    "keywords": ["refund", "money back", "guarantee", "cancel"]
  }'
```

Or directly in `data/faqs.json`.

### Customize Agency Info

In `.env`:
```env
AGENCY_NAME=Your Agency
AGENCY_EMAIL=hello@agency.com
AGENCY_PHONE=+1 555 000 0000
AGENCY_CALENDLY=https://calendly.com/you
AGENCY_WEBSITE=https://youragency.com
```

---

## 🔌 Integrations

### Zapier / Make Integration

Set `LEADS_WEBHOOK_URL` to your Zapier/Make webhook URL. Every new lead sends:
```json
{
  "event": "new_lead",
  "lead": {
    "id": "uuid",
    "status": "hot",
    "interestedService": "SEO",
    "intent": { "type": "hot_lead", "score": 9 },
    "messageCount": 12
  }
}
```

### Slack Hot Lead Alerts

Set `SLACK_WEBHOOK_URL` to your Slack incoming webhook URL. Hot leads trigger instant Slack notifications with lead details.

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| Webhook verification fails | Check `VERIFY_TOKEN` matches exactly in `.env` and Facebook console |
| Messages not received | Check webhook subscriptions include `messages` and `messaging_postbacks` |
| AI not responding | Verify `AI_API_KEY` is valid at console.anthropic.com |
| Bot sends double messages | Check you're not running multiple instances |
| Render sleeping | Set up UptimeRobot to ping `/health` every 5 minutes |
| Rate limit errors | Reduce message frequency or upgrade Anthropic plan |

### Check Logs

```bash
# Local
npm run dev  # See real-time logs

# Render
# Dashboard → Your Service → Logs tab
```

---

## 📄 License

MIT License — free to use, modify, and deploy commercially.

---

## 💬 Support

Built with ❤️ using Claude AI by Anthropic. 

For issues, open a GitHub issue or reach out to your agency contact.
