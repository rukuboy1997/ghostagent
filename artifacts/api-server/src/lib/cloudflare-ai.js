const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

function calcPipValue(symbol, lotSize) {
  const s = symbol.toUpperCase().replace("/", "");
  if (s.includes("JPY")) return lotSize * 100000 * 0.01 * (1 / 150);
  if (s.includes("XAU")) return lotSize * 100 * 0.1;
  if (s.includes("XAG")) return lotSize * 5000 * 0.001;
  if (s.includes("BTC")) return lotSize * 1;
  if (s.includes("ETH")) return lotSize * 0.1;
  if (s === "USOIL" || s === "WTI" || s === "BRENT") return lotSize * 1000;
  return lotSize * 100000 * 0.0001;
}

function calcLotSize(symbol, accountBalance, riskPercent, stopLossPips) {
  if (!stopLossPips || stopLossPips <= 0) return 0.01;
  const riskAmount = (accountBalance * riskPercent) / 100;
  const pipValuePerLot = calcPipValue(symbol, 1);
  const rawLot = riskAmount / (stopLossPips * pipValuePerLot);
  const lot = Math.round(rawLot * 100) / 100;
  return Math.max(0.01, Math.min(lot, 10));
}

function getMarketSession() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  if (utcHour >= 22 || utcHour < 7) return "Asian";
  if (utcHour >= 7 && utcHour < 12) return "London Open";
  if (utcHour >= 12 && utcHour < 16) return "NY Open / London-NY Overlap (PEAK LIQUIDITY)";
  if (utcHour >= 16 && utcHour < 20) return "NY Afternoon";
  return "London Close";
}

function buildAdvancedPrompt(symbol, marketData, accountBalance) {
  const session = getMarketSession();
  const { price, bid, ask, change, rsi, macd, candles } = marketData;

  const h1Candles = candles?.h1?.slice(-10) || [];
  const h4Candles = candles?.h4?.slice(-6) || [];
  const d1Candles = candles?.d1?.slice(-5) || [];

  const h1Rsi = rsi?.h1 != null ? `RSI(14)H1: ${Number(rsi.h1).toFixed(2)}` : "RSI H1: N/A";
  const h4Rsi = rsi?.h4 != null ? `RSI(14)H4: ${Number(rsi.h4).toFixed(2)}` : "RSI H4: N/A";
  const d1Rsi = rsi?.d1 != null ? `RSI(14)D1: ${Number(rsi.d1).toFixed(2)}` : "RSI D1: N/A";

  const h1Macd = macd?.h1 ? `MACD H1: ${macd.h1.macd?.toFixed(6)}, Signal: ${macd.h1.signal?.toFixed(6)}, Hist: ${macd.h1.hist?.toFixed(6)}` : "MACD H1: N/A";
  const h4Macd = macd?.h4 ? `MACD H4: ${macd.h4.macd?.toFixed(6)}, Signal: ${macd.h4.signal?.toFixed(6)}, Hist: ${macd.h4.hist?.toFixed(6)}` : "MACD H4: N/A";

  const bb = marketData.bb?.h1;
  const bbStr = bb ? `BB H1: Upper=${bb.upper?.toFixed(5)}, Mid=${bb.mid?.toFixed(5)}, Lower=${bb.lower?.toFixed(5)} (Width=${bb.width?.toFixed(5)})` : "Bollinger Bands: N/A";

  const ema = marketData.ema;
  const emaStr = ema ? `EMA20=${ema.ema20?.toFixed(5)}, EMA50=${ema.ema50?.toFixed(5)}, EMA200=${ema.ema200?.toFixed(5)}` : "EMA: N/A";

  const atr = marketData.atr != null ? `ATR(14) H1: ${Number(marketData.atr).toFixed(5)}` : "ATR: N/A";
  const stoch = marketData.stoch ? `Stochastic K=${marketData.stoch.k?.toFixed(2)}, D=${marketData.stoch.d?.toFixed(2)}` : "Stochastic: N/A";

  const h1CandlesStr = h1Candles.length ? `H1 last 10 candles (O/H/L/C): ${h1Candles.map(c => `${c.open}/${c.high}/${c.low}/${c.close}`).join(" | ")}` : "H1 candles: N/A";
  const h4CandlesStr = h4Candles.length ? `H4 last 6 candles: ${h4Candles.map(c => `${c.open}/${c.high}/${c.low}/${c.close}`).join(" | ")}` : "H4 candles: N/A";
  const d1CandlesStr = d1Candles.length ? `D1 last 5 candles: ${d1Candles.map(c => `${c.open}/${c.high}/${c.low}/${c.close}`).join(" | ")}` : "D1 candles: N/A";

  return `You are GhostAgent — an elite AI trading signal system powered by multi-timeframe technical analysis.

Perform a COMPREHENSIVE multi-timeframe analysis for ${symbol} and output a high-confidence trading signal.

═══════════════════════════════════════
LIVE MARKET DATA
═══════════════════════════════════════
Symbol: ${symbol}
Current Price: ${price}
Bid: ${bid} | Ask: ${ask}
24h Change: ${change}%
Market Session: ${session}
Account Balance: $${accountBalance}

═══════════════════════════════════════
MULTI-TIMEFRAME TECHNICAL INDICATORS
═══════════════════════════════════════
${h1Rsi}
${h4Rsi}
${d1Rsi}
${h1Macd}
${h4Macd}
${bbStr}
${emaStr}
${atr}
${stoch}

═══════════════════════════════════════
PRICE ACTION (MULTI-TIMEFRAME)
═══════════════════════════════════════
${h1CandlesStr}
${h4CandlesStr}
${d1CandlesStr}

═══════════════════════════════════════
CONFLUENCE ANALYSIS RULES (MANDATORY)
═══════════════════════════════════════
Only signal BUY or SELL when ALL of these conditions align (minimum 6/8 factors):
1. D1 trend direction (price above/below EMA200 on D1)
2. H4 trend direction (MACD histogram direction on H4)
3. H1 momentum (RSI direction and level on H1)
4. MACD H1 crossover (bullish/bearish)
5. Price relative to Bollinger Bands (breakout or pullback)
6. EMA alignment (EMA20 > EMA50 > EMA200 for bullish, reverse for bearish)
7. Stochastic position (oversold <20 for BUY, overbought >80 for SELL)
8. Market session timing (prefer London/NY overlap for signals)

Count how many factors align. Only signal if 6+ factors align AND confidence >= 72%.

SIGNAL QUALITY RULES:
- Stop Loss: ATR-based (1.5x ATR from entry) or nearest swing high/low — whichever is tighter
- Take Profit: Minimum R:R of 1:2.5 (prefer 1:3)
- Never signal at high-spread times (Asian session for major pairs) unless breakout confirmed
- For Gold (XAUUSD): require 7+ factors aligned
- For crypto: require 7+ factors and confidence >= 80%

═══════════════════════════════════════
REQUIRED OUTPUT FORMAT (JSON ONLY)
═══════════════════════════════════════
Respond ONLY with valid JSON, no markdown, no text outside JSON:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "confluenceScore": <number 0-8>,
  "confluenceFactors": ["<factor1>", "<factor2>", ...],
  "reasoning": "<detailed 4-6 sentence analysis citing specific indicator values>",
  "entryPrice": <number>,
  "stopLoss": <number>,
  "takeProfit": <number>,
  "stopLossPips": <number>,
  "takeProfitPips": <number>,
  "riskRewardRatio": <number>,
  "recommendedLotSize": <number>,
  "riskPercent": <1 or 2>,
  "timeframe": "H1",
  "session": "${session}",
  "forecast": "<4-6 hour market forecast with specific price targets>",
  "keyLevels": "<exact support and resistance price levels>",
  "invalidationLevel": "<price level that invalidates this signal>"
}`;
}

export async function analyzeMarket({ symbol, marketData, accountBalance = 1000 }) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error("AI engine not configured. Please contact support.");
  }

  const prompt = buildAdvancedPrompt(symbol, marketData, accountBalance);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are GhostAgent, an elite multi-timeframe forex trading AI. You use strict confluence analysis across D1, H4, H1 timeframes to generate only the highest-quality signals. You NEVER output markdown or thinking tags — ONLY raw JSON. You are disciplined: when in doubt, output HOLD.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI engine error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw = data?.result?.response || data?.result?.choices?.[0]?.message?.content || "";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI returned an unreadable response. Please try again.");

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("AI response could not be parsed. Please try again.");
  }

  const decision = parsed.decision || "HOLD";
  const entryPrice = Number(parsed.entryPrice) || marketData?.price || 0;
  const stopLoss = Number(parsed.stopLoss) || 0;
  const takeProfit = Number(parsed.takeProfit) || 0;
  const stopLossPips = Math.abs(Number(parsed.stopLossPips) || 0);
  const takeProfitPips = Number(parsed.takeProfitPips) || 0;
  const riskPercent = Number(parsed.riskPercent) || 1;
  const confluenceScore = Number(parsed.confluenceScore) || 0;

  const recommendedLot = stopLossPips > 0
    ? calcLotSize(symbol, accountBalance, riskPercent, stopLossPips)
    : Math.max(0.01, Number(parsed.recommendedLotSize) || 0.01);

  const rr = stopLossPips > 0 && takeProfitPips > 0
    ? (takeProfitPips / stopLossPips).toFixed(2)
    : parsed.riskRewardRatio || "N/A";

  return {
    decision,
    confidence: Number(parsed.confidence) || 50,
    confluenceScore,
    confluenceFactors: parsed.confluenceFactors || [],
    reasoning: parsed.reasoning || "Multi-timeframe analysis complete.",
    entryPrice,
    stopLoss,
    takeProfit,
    stopLossPips,
    takeProfitPips,
    riskRewardRatio: rr,
    recommendedLotSize: recommendedLot,
    riskPercent,
    timeframe: parsed.timeframe || "H1",
    session: parsed.session || getMarketSession(),
    forecast: parsed.forecast || "",
    keyLevels: parsed.keyLevels || "",
    invalidationLevel: parsed.invalidationLevel || "",
    model: MODEL,
    provider: "cloudflare-workers-ai",
    accountBalance,
  };
}
