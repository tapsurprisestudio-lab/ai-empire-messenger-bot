/**
 * Dashboard Handler
 * Simple analytics dashboard and admin API
 */

const express = require("express");
const router = express.Router();
const analyticsService = require("../services/analyticsService");
const leadService = require("../services/leadService");
const faqService = require("../services/faqService");
const conversationService = require("../services/conversationService");
const messengerService = require("../services/messengerService");
const spamGuard = require("../middleware/spamGuard");
const logger = require("../utils/logger");

// Simple API key auth for dashboard
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.key;
  const expectedKey = process.env.DASHBOARD_API_KEY;

  // If no key configured, allow in development, block in production
  if (!expectedKey) {
    if (process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "Dashboard API key not configured" });
    }
    return next(); // Allow in dev mode
  }

  if (key !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Dashboard HTML ───────────────────────────────────────────

router.get("/", (req, res) => {
  const html = getDashboardHTML();
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ─── API Routes ───────────────────────────────────────────────

// Analytics summary
router.get("/api/analytics", requireApiKey, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const summary = analyticsService.getSummary(days);
  res.json({ success: true, data: summary });
});

// Lead management
router.get("/api/leads", requireApiKey, (req, res) => {
  const { status, limit, offset } = req.query;
  const leads = leadService.getLeads({
    status,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  const stats = leadService.getStats();
  res.json({ success: true, data: { leads, stats } });
});

// Update lead status
router.patch("/api/leads/:id", requireApiKey, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  leadService.updateLeadStatus(id, status, notes);
  res.json({ success: true, message: `Lead ${id} updated to ${status}` });
});

// FAQ management
router.get("/api/faqs", requireApiKey, (req, res) => {
  const faqs = faqService.getAllFAQs();
  res.json({ success: true, data: faqs });
});

router.post("/api/faqs", requireApiKey, (req, res) => {
  const faq = faqService.addFAQ(req.body);
  res.json({ success: true, data: faq });
});

// Spam guard stats
router.get("/api/spam", requireApiKey, (req, res) => {
  const stats = spamGuard.getStats();
  res.json({ success: true, data: stats });
});

router.delete("/api/spam/:senderId", requireApiKey, (req, res) => {
  spamGuard.unblock(req.params.senderId);
  res.json({ success: true, message: `Unblocked ${req.params.senderId}` });
});

// Setup messenger (persistent menu, greeting)
router.post("/api/setup-messenger", requireApiKey, async (req, res) => {
  try {
    await messengerService.setupPersistentMenu();
    res.json({ success: true, message: "Messenger profile set up successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send a test message
router.post("/api/test-message", requireApiKey, async (req, res) => {
  const { recipientId, text } = req.body;
  if (!recipientId || !text) {
    return res.status(400).json({ error: "recipientId and text required" });
  }
  try {
    await messengerService.sendText(recipientId, text);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Dashboard HTML ───────────────────────────────────────────

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🤖 FB AI Chatbot Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #1d4ed8, #7c3aed); padding: 24px 32px; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 24px; font-weight: 700; }
    .header span { font-size: 14px; opacity: 0.8; }
    .container { padding: 32px; max-width: 1400px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
    .card h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px; }
    .card .value { font-size: 36px; font-weight: 700; color: #f1f5f9; }
    .card .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .section { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; margin-bottom: 24px; }
    .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #f1f5f9; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 12px 16px; background: #0f172a; color: #94a3b8; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px 16px; border-top: 1px solid #334155; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-hot { background: #7f1d1d; color: #fca5a5; }
    .badge-warm { background: #78350f; color: #fcd34d; }
    .badge-new { background: #1e3a5f; color: #93c5fd; }
    .badge-contacted { background: #14532d; color: #86efac; }
    .badge-call_requested { background: #581c87; color: #d8b4fe; }
    .funnel { display: flex; gap: 12px; flex-wrap: wrap; }
    .funnel-step { flex: 1; min-width: 120px; background: #0f172a; padding: 16px; border-radius: 8px; text-align: center; }
    .funnel-step .num { font-size: 28px; font-weight: 700; color: #60a5fa; }
    .funnel-step .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .btn { background: #1d4ed8; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; }
    .btn:hover { background: #1e40af; }
    .btn-green { background: #15803d; }
    .btn-green:hover { background: #166534; }
    .setup-note { background: #1a2744; border: 1px solid #2563eb; border-radius: 8px; padding: 16px; font-size: 14px; color: #93c5fd; margin-bottom: 24px; }
    .loading { color: #64748b; font-style: italic; }
    #status-bar { background: #15803d; color: white; padding: 8px 16px; font-size: 13px; display: none; border-radius: 6px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <span style="font-size:28px">🤖</span>
    <div>
      <h1>FB AI Chatbot Dashboard</h1>
      <span>${process.env.AGENCY_NAME || "Agency"} · Powered by Claude AI</span>
    </div>
    <div style="margin-left:auto;display:flex;gap:12px">
      <button class="btn btn-green" onclick="setupMessenger()">⚙️ Setup Messenger</button>
      <button class="btn" onclick="loadData()">🔄 Refresh</button>
    </div>
  </div>

  <div class="container">
    <div id="status-bar"></div>

    <div class="setup-note">
      💡 <strong>Quick Setup:</strong> Click "Setup Messenger" to configure your page's persistent menu and greeting message. Do this once after deployment.
    </div>

    <div class="grid" id="stats-grid">
      <div class="card"><h3>Total Leads</h3><div class="value loading" id="stat-total">—</div></div>
      <div class="card"><h3>Leads Today</h3><div class="value loading" id="stat-today">—</div></div>
      <div class="card"><h3>Hot Leads</h3><div class="value loading" id="stat-hot">—</div></div>
      <div class="card"><h3>Conversion Rate</h3><div class="value loading" id="stat-conv">—</div></div>
      <div class="card"><h3>Avg Intent Score</h3><div class="value loading" id="stat-intent">—</div></div>
      <div class="card"><h3>Users Today</h3><div class="value loading" id="stat-users">—</div></div>
    </div>

    <div class="section">
      <h2>📊 Conversion Funnel</h2>
      <div class="funnel" id="funnel">
        <div class="loading">Loading funnel data...</div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 Recent Leads</h2>
      <div id="leads-table"><div class="loading">Loading leads...</div></div>
    </div>

    <div class="section">
      <h2>🏆 Top Services by Interest</h2>
      <div id="services-table"><div class="loading">Loading...</div></div>
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        const [analyticsRes, leadsRes] = await Promise.all([
          fetch('/dashboard/api/analytics'),
          fetch('/dashboard/api/leads')
        ]);
        const analytics = await analyticsRes.json();
        const leads = await leadsRes.json();

        if (analytics.success) renderAnalytics(analytics.data);
        if (leads.success) renderLeads(leads.data);
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }

    function renderAnalytics(data) {
      document.getElementById('stat-total').textContent = data.users.total || 0;
      document.getElementById('stat-today').textContent = data.users.today || 0;
      document.getElementById('stat-conv').textContent = data.funnel.conversionRate || '0%';
      document.getElementById('stat-users').textContent = data.users.today || 0;

      // Funnel
      const funnel = data.funnel;
      document.getElementById('funnel').innerHTML = [
        ['Conversations', funnel.conversations],
        ['High Intent', funnel.highIntentDetected],
        ['Contact Requested', funnel.contactRequested],
        ['Call Booked', funnel.callBookingInitiated],
        ['FAQ Matches', funnel.faqMatched],
      ].map(([label, num]) => \`
        <div class="funnel-step">
          <div class="num">\${num || 0}</div>
          <div class="label">\${label}</div>
        </div>
      \`).join('');

      // Top services
      const svcs = data.topServices || [];
      document.getElementById('services-table').innerHTML = svcs.length ? \`
        <table>
          <tr><th>Service</th><th>Inquiries</th></tr>
          \${svcs.map(s => \`<tr><td>\${s.service}</td><td>\${s.count}</td></tr>\`).join('')}
        </table>
      \` : '<p style="color:#64748b">No service data yet</p>';
    }

    function renderLeads(data) {
      const { leads, stats } = data;
      document.getElementById('stat-hot').textContent = stats.byStatus.hot || 0;
      document.getElementById('stat-intent').textContent = stats.avgIntentScore || 0;

      const table = leads.length ? \`
        <table>
          <tr><th>ID</th><th>Status</th><th>Service Interest</th><th>Intent Score</th><th>Messages</th><th>Created</th></tr>
          \${leads.slice(0, 20).map(l => \`
            <tr>
              <td style="font-family:monospace;font-size:12px">\${l.id.substring(0,8)}...</td>
              <td><span class="badge badge-\${l.status}">\${l.status}</span></td>
              <td>\${l.interestedService || '—'}</td>
              <td>\${l.intent?.score || 0}/10</td>
              <td>\${l.messageCount || 0}</td>
              <td style="font-size:12px;color:#64748b">\${new Date(l.createdAt).toLocaleDateString()}</td>
            </tr>
          \`).join('')}
        </table>
      \` : '<p style="color:#64748b">No leads yet — start chatting with your bot!</p>';

      document.getElementById('leads-table').innerHTML = table;
    }

    async function setupMessenger() {
      const bar = document.getElementById('status-bar');
      bar.textContent = '⏳ Setting up Messenger...';
      bar.style.display = 'block';
      try {
        const res = await fetch('/dashboard/api/setup-messenger', { method: 'POST' });
        const data = await res.json();
        bar.textContent = data.success ? '✅ Messenger set up successfully! Menu and greeting are live.' : '❌ Error: ' + data.error;
        bar.style.background = data.success ? '#15803d' : '#7f1d1d';
        setTimeout(() => bar.style.display = 'none', 5000);
      } catch(e) {
        bar.textContent = '❌ Request failed: ' + e.message;
        bar.style.background = '#7f1d1d';
      }
    }

    // Load on start
    loadData();
    // Auto-refresh every 30s
    setInterval(loadData, 30000);
  </script>
</body>
</html>`;
}

module.exports = router;
