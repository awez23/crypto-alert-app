// server.js — Main backend
// Runs the API, checks alert prices against live prices every few seconds,
// and fires a push notification when a target price is hit.
// Supports two exchanges: MEXC (default, matches what the user trades on) and Binance.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mexc = require('./mexc');
const binance = require('./binance');
const { sendNtfyAlert } = require('./ntfy');

const app = express();
const PORT = process.env.PORT || 4000;
const ALERTS_FILE = path.join(__dirname, 'alerts.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const CHECK_INTERVAL_MS = 5000; // how often we re-check prices (5 sec)

const providers = { mexc, binance };
function getProvider(exchange) {
  return providers[exchange] || providers.mexc;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------- Simple JSON file storage (no database needed) ----------
function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) { console.error('Failed to load', file, e.message); }
  return fallback;
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let alerts = loadJSON(ALERTS_FILE, []);       // [{id, exchange, symbol, targetPrice, direction, status, createdAt}]
let config = loadJSON(CONFIG_FILE, { ntfyTopic: '' });

// ---------- API: Symbol search ----------
let symbolCache = { mexc: [], binance: [] };
async function refreshSymbolCache() {
  for (const name of Object.keys(providers)) {
    try {
      symbolCache[name] = await providers[name].getAllSymbols();
      console.log(`Loaded ${symbolCache[name].length} symbols from ${name}.`);
    } catch (e) {
      console.error(`Could not load symbol list from ${name}:`, e.message);
    }
  }
}

app.get('/api/symbols', (req, res) => {
  const q = (req.query.q || '').toUpperCase();
  const exchange = req.query.exchange === 'binance' ? 'binance' : 'mexc';
  const list = symbolCache[exchange] || [];
  if (!q) return res.json(list.slice(0, 30));
  const matches = list.filter(s => s.symbol.includes(q) || s.baseAsset.includes(q));
  res.json(matches.slice(0, 30));
});

// ---------- API: Chart data ----------
app.get('/api/klines', async (req, res) => {
  const { symbol, interval } = req.query;
  const exchange = req.query.exchange === 'binance' ? 'binance' : 'mexc';
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const candles = await getProvider(exchange).getKlines(symbol, interval || '15m', 500);
    res.json(candles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- API: Live price (used for polling by frontend too) ----------
app.get('/api/price', async (req, res) => {
  const { symbol } = req.query;
  const exchange = req.query.exchange === 'binance' ? 'binance' : 'mexc';
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const price = await getProvider(exchange).getPrice(symbol);
    res.json({ symbol, price });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- API: Push notification (ntfy) config ----------
app.get('/api/config', (req, res) => res.json(config));
app.post('/api/config', (req, res) => {
  const { ntfyTopic } = req.body;
  if (ntfyTopic !== undefined) config.ntfyTopic = ntfyTopic;
  saveJSON(CONFIG_FILE, config);
  res.json(config);
});

// Send a one-off test notification so the user can confirm ntfy works before relying on it
app.post('/api/test-whatsapp', async (req, res) => {
  const result = await sendNtfyAlert(config.ntfyTopic,
    'Test notification from CoinWatch — your alerts are working!', 'CoinWatch Test');
  res.json(result);
});

// ---------- API: Alerts CRUD ----------
app.get('/api/alerts', (req, res) => res.json(alerts));

app.post('/api/alerts', (req, res) => {
  const { symbol, targetPrice, direction, exchange } = req.body;
  if (!symbol || !targetPrice) return res.status(400).json({ error: 'symbol and targetPrice required' });
  const alert = {
    id: Date.now().toString(),
    exchange: exchange === 'binance' ? 'binance' : 'mexc',
    symbol: symbol.toUpperCase(),
    targetPrice: parseFloat(targetPrice),
    direction: direction || 'either', // 'above', 'below', or 'either' (crosses either direction)
    status: 'active', // active | triggered
    createdAt: new Date().toISOString(),
  };
  alerts.push(alert);
  saveJSON(ALERTS_FILE, alerts);
  res.json(alert);
});

app.delete('/api/alerts/:id', (req, res) => {
  alerts = alerts.filter(a => a.id !== req.params.id);
  saveJSON(ALERTS_FILE, alerts);
  res.json({ success: true });
});

// ---------- Background loop: check all active alerts against live prices ----------
let lastPrices = {}; // "exchange:symbol" -> last known price, used to detect crossing direction

async function checkAlerts() {
  const active = alerts.filter(a => a.status === 'active');
  if (active.length === 0) return;

  // Group by exchange+symbol so we only fetch each one's price once
  const keys = [...new Set(active.map(a => `${a.exchange}:${a.symbol}`))];

  for (const key of keys) {
    const [exchange, symbol] = key.split(':');
    let price;
    try {
      price = await getProvider(exchange).getPrice(symbol);
    } catch (e) {
      console.error(`Price fetch failed for ${key}:`, e.message);
      continue;
    }

    const prevPrice = lastPrices[key];
    lastPrices[key] = price;
    if (prevPrice === undefined) continue; // need at least 2 readings to detect a "cross"

    const keyAlerts = active.filter(a => `${a.exchange}:${a.symbol}` === key);
    for (const alert of keyAlerts) {
      const target = alert.targetPrice;
      let crossed = false;

      if (alert.direction === 'above' && prevPrice < target && price >= target) crossed = true;
      else if (alert.direction === 'below' && prevPrice > target && price <= target) crossed = true;
      else if (alert.direction === 'either' &&
               ((prevPrice < target && price >= target) || (prevPrice > target && price <= target))) crossed = true;

      if (crossed) {
        alert.status = 'triggered';
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = price;
        console.log(`🔔 ALERT TRIGGERED: [${exchange}] ${symbol} hit ${price} (target ${target})`);

        if (config.ntfyTopic) {
          const msg = `[${exchange.toUpperCase()}] ${symbol} has reached your target price.\n\nTarget: ${target}\nCurrent: ${price}\nTime: ${new Date().toLocaleString()}\n\nOpen your chart and plan your trade.`;
          const result = await sendNtfyAlert(config.ntfyTopic, msg, `${symbol} Alert`);
          if (!result.success) console.error('Alert push failed:', result.error);
        } else {
          console.log('Push notifications not configured yet (ntfy topic missing) — alert only shown in app.');
        }
      }
    }
  }
  saveJSON(ALERTS_FILE, alerts);
}

setInterval(checkAlerts, CHECK_INTERVAL_MS);

// ---------- Startup ----------
async function start() {
  await refreshSymbolCache();
  setInterval(refreshSymbolCache, 60 * 60 * 1000); // refresh symbol list every hour

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running: http://localhost:${PORT}`);
    console.log('Open that link in your browser to use the app.\n');
  });
}

start();
