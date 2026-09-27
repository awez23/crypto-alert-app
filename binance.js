// binance.js
// Talks to Binance's USDT-M Futures public API (no API key needed for market data).
// Mirrors mexc.js so server.js can treat both exchanges the same way.
const fetch = require('node-fetch');

const BASE_URL = 'https://fapi.binance.com';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoinWatchApp/1.0' };

// Our UI's short interval codes -> Binance kline interval codes
const INTERVAL_MAP = {
  '1m': '1m', '5m': '5m', '15m': '15m',
  '60m': '1h', '4h': '4h', '1d': '1d',
};

async function getAllSymbols() {
  const res = await fetch(`${BASE_URL}/fapi/v1/exchangeInfo`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Binance exchangeInfo request failed: HTTP ${res.status} - ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.symbols)) {
    throw new Error(`Unexpected Binance response shape: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const usdtPairs = data.symbols.filter(
    s => s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL' && s.status === 'TRADING'
  );
  console.log(`Binance futures returned ${data.symbols.length} total symbols, ${usdtPairs.length} are USDT perpetuals.`);
  return usdtPairs.map(s => ({ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: 'USDT' }));
}

async function getKlines(symbol, interval = '15m', limit = 500) {
  const binInterval = INTERVAL_MAP[interval] || '15m';
  const url = `${BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${binInterval}&limit=${limit}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected Binance kline response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.map(c => ({
    time: Math.floor(c[0] / 1000),
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

async function getPrice(symbol) {
  const res = await fetch(`${BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`, { headers: HEADERS });
  const data = await res.json();
  if (data.price === undefined) {
    throw new Error(`Unexpected Binance ticker response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return parseFloat(data.price);
}

module.exports = { getAllSymbols, getKlines, getPrice };
