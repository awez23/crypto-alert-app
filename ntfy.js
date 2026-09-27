// ntfy.js
// Sends free push notifications via ntfy.sh (https://ntfy.sh) — no signup, no API key,
// works reliably on iOS via the official ntfy app (App Store).
// Setup (done by the user, not in code):
//   1. Install the "ntfy" app from the App Store
//   2. In the app, subscribe to a unique topic name (e.g. "adeel-crypto-alerts-9273")
//   3. Put that same topic name into this app's config
const fetch = require('node-fetch');

async function sendNtfyAlert(topic, message, title = 'Price Alert') {
  if (!topic) {
    return { success: false, error: 'No topic configured.' };
  }
  try {
    const safeTitle = title.replace(/[^\x00-\x7F]/g, '').trim() || 'Alert';
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Title': safeTitle,
        'Priority': 'high',
        'Tags': 'rotating_light',
      },
      body: message,
    });
    if (res.ok) {
      console.log('✅ Push notification sent via ntfy.');
      return { success: true };
    } else {
      const body = await res.text();
      console.error('ntfy send failed:', res.status, body.slice(0, 200));
      return { success: false, error: `ntfy.sh returned HTTP ${res.status}: ${body.slice(0, 150)}` };
    }
  } catch (err) {
    console.error('Failed to send ntfy notification:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendNtfyAlert };
