// mexc.js
// Talks to MEXC's FUTURES / PERPETUAL contract API (contract.mexc.com).
// This matches the "BTCUSDT.P" symbols on TradingView and what you actually
// trade on MEXC with leverage — NOT the Spot market, which trades at a
// slightly different price.
const fetch = require('node-fetch');

const BASE_URL = 'https://contract.mexc.com';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoinWatchApp/1.0' };

// Our UI's short interval codes -> MEXC futures kline interval codes
const INTERVAL_MAP = {
  '1m': 'Min1', '5m': 'Min5', '15m': 'Min15',
  '60m': 'Min60', '4h': 'Hour4', '1d': 'Day1',
};

// Get list of all USDT-margined perpetual contracts (for search feature)
async function getAllSymbols() {
  const res = await fetch(`${BASE_URL}/api/v1/contract/detail`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MEXC contract/detail request failed: HTTP ${res.status} - ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json.data)) {
    throw new Error(`Unexpected MEXC response shape: ${JSON.stringify(json).slice(0, 200)}`);
  }
  // Symbol format is like "BTC_USDT" — filter to USDT-margined pairs using the symbol itself,
  // which is more reliable than guessing exact field names for base/quote coin.
  const usdtPairs = json.data.filter(s => typeof s.symbol === 'string' && s.symbol.endsWith('_USDT'));
  console.log(`MEXC futures returned ${json.data.length} total contracts, ${usdtPairs.length} are USDT-margined.`);
  return usdtPairs.map(s => {
    const [baseAsset] = s.symbol.split('_');
    return { symbol: s.symbol, baseAsset, quoteAsset: 'USDT' };
  });
}

// Get historical candles for a symbol (for the chart)
async function getKlines(symbol, interval = '15m', limit = 500) {
  const contractInterval = INTERVAL_MAP[interval] || 'Min15';
  const url = `${BASE_URL}/api/v1/contract/kline/${symbol}?interval=${contractInterval}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MEXC kline request failed: HTTP ${res.status} - ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const d = json.data;
  if (!d || !Array.isArray(d.time)) {
    throw new Error(`Unexpected MEXC kline response: ${JSON.stringify(json).slice(0, 200)}`);
  }
  const n = d.time.length;
  const start = Math.max(0, n - limit);
  const candles = [];
  for (let i = start; i < n; i++) {
    candles.push({
      time: d.time[i], // already in seconds
      open: d.open[i],
      high: d.high[i],
      low: d.low[i],
      close: d.close[i],
      volume: d.vol ? d.vol[i] : 0,
    });
  }
  return candles;
}

// Get current live price for a single symbol (the "last traded price" — matches
// what you see as the live price on MEXC's futures trading screen)
async function getPrice(symbol) {
  const res = await fetch(`${BASE_URL}/api/v1/contract/ticker?symbol=${symbol}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MEXC ticker request failed: HTTP ${res.status} - ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const price = json.data && json.data.lastPrice;
  if (price === undefined) {
    throw new Error(`Unexpected MEXC ticker response: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return parseFloat(price);
}

module.exports = { getAllSymbols, getKlines, getPrice };
