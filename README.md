# CoinWatch — MEXC Live Chart & Push Price Alerts

Free, self-hosted tool: search any MEXC coin, see a TradingView-style live chart,
set a target price, and get an instant push notification on your phone when that price hits.

## What you need first
1. **Node.js** installed on your laptop (v18 or newer). Download free from https://nodejs.org
2. The free **ntfy** app on your phone (App Store on iOS, Play Store on Android).

No Chrome install, no second phone number, no paid API, no account/signup for ntfy.

## Setup (one time only)

### A. Backend

1. Open a terminal inside the `backend` folder:
   ```
   cd crypto-alert-app/backend
   npm install
   npm start
   ```
2. You should see:
   ```
   🚀 Server running: http://localhost:4000
   ```
3. Open your browser and go to **http://localhost:4000**

### B. Push Alerts (via ntfy — free)

1. Install the **ntfy** app from the App Store (search "ntfy").
2. Open the app, tap **+ (Subscribe to topic)**.
3. Type a unique topic name only you would guess — e.g. `yourname-alerts-4821`
   (anyone who knows this exact name could also see your alerts, so make it random).
4. Tap Subscribe — that's the entire setup, no account needed.
5. In the CoinWatch app (right panel → "Push Alerts"):
   - Enter that same topic name
   - Click **Save**, then click **Send Test Notification**
   - You should get a notification on your phone within a couple of seconds

## How to use it

1. Pick an exchange at the top-left: **MEXC** or **Binance** (data comes from that
   exchange's own Futures/Perpetual market).
2. Type a coin name in the search box (e.g. `BTC`, `SOL`, `PEPE`) and click a result.
3. The chart loads real candles and updates live, no need to refresh.
4. Pick a timeframe (1m/5m/15m/1H/4H/1D) at the top.
5. **Drawing tools** (toolbar above the chart):
   - **Trend Line** — click the button, then click two points to draw a line segment
   - **Ray** — like Trend Line, but extends onward past your second click (for projecting
     a trendline or channel forward)
   - **H-Line** — click the button, then click once to drop a horizontal price line
     across the whole chart
   - **V-Line** — click the button, then click once to drop a vertical line at that time
   - **Rectangle** — click the button, then click two opposite corners to draw a box
     (handy for marking a zone/range)
   - **Clear Drawings** — removes everything you've drawn
6. **Replay mode** (toolbar above the chart):
   - Click **Replay Mode** to enter it
   - Click any candle to jump the chart back to that point in time
   - Use **Play** to step forward candle-by-candle automatically (adjust speed with the
     dropdown), or **Step Back/Fwd** to move one candle at a time
   - Click **Exit Replay** to return to the live chart
   - While in replay, live price updates are paused on the chart (so your view doesn't
     jump around), but alerts keep checking the real live price in the background regardless
7. To set an alert: type your target price, choose direction (above / below / either),
   click **Add Alert**. The alert is tied to whichever exchange/coin is currently selected.
8. When the live price hits that target:
   - The "Active Alerts" list marks it ✓ Triggered (shows which exchange it was on)
   - You get an instant push notification, even if your laptop screen is off

## Important notes

- **Keep the terminal window and laptop running** for alerts to keep working —
  this checks the price every 5 seconds and sends WhatsApp messages.
- Prices and candles come **directly from MEXC's own Futures/Perpetual API**
  (`contract.mexc.com`) or, if you switch the toggle, **Binance's Futures API** —
  the same markets as MEXC's "USDT-M Perpetual" screen and Binance USDT-M Futures.
  This is deliberately **not** the Spot market, since spot and futures prices differ
  slightly (funding rate, contango/backwardation).
- Symbols use each exchange's own format: MEXC uses an underscore (`BTC_USDT`),
  Binance does not (`BTCUSDT`). Search still works the same way either way.
- The drawing tools (Trend Line, Horizontal Line) and Replay Mode are a lightweight,
  hand-built version of what TradingView offers — TradingView's full charting library
  (Fibonacci tools, shapes, text, alerts-on-drawings, etc.) is a licensed product and
  isn't freely embeddable, so this covers the core analysis tools rather than the full set.
- Completely free — no paid API keys, no hosting cost, as long as you run it on your
  own laptop.
- CallMeBot is a free third-party relay service — your alert text passes through their
  server to deliver via WhatsApp. Don't put sensitive personal info in the alert message
  itself (the default message only contains the coin symbol and price, which is fine).
- If you ever want alerts to work even when your laptop is off, this same backend can
  later be deployed to a free cloud host (e.g. Render.com free tier) — ask and this can
  be set up as a next step.

## Project structure
```
crypto-alert-app/
├── backend/
│   ├── server.js      -> main server, API routes, alert-checking loop
│   ├── mexc.js          -> talks to MEXC futures API (prices + candles)
│   ├── binance.js        -> talks to Binance futures API (prices + candles)
│   ├── ntfy.js             -> sends free push notifications via ntfy.sh
│   ├── package.json
│   └── alerts.json          -> (auto-created) saved alerts
└── frontend/
    └── index.html            -> chart + search + drawing tools + replay + alerts UI
```

## Troubleshooting
- **"Could not load chart"** → check your internet connection; the symbol format should
  be like `BTCUSDT`.
- **Test notification fails / doesn't arrive** → make sure the topic name in the app
  exactly matches what you subscribed to in the ntfy app (case-sensitive), and that you're
  still subscribed (open the ntfy app to check).
- **Notification arrives but you want it louder/different** → open the topic in the ntfy
  app and adjust notification settings there (sound, priority) like any other app.
