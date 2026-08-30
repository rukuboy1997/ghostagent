const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

function getMarketSession() {
  const hour = new Date().getUTCHours();
  if (hour >= 13 && hour < 17) return "US open";
  if (hour >= 17 && hour < 21) return "US afternoon";
  if (hour >= 12 && hour < 13) return "pre-market";
  return "off-hours";
}

function buildOptionsPrompt(symbol, marketData, accountBalance) {
  const candles = marketData?.candles?.h1?.slice(-12) || [];
  const daily = marketData?.candles?.d1?.slice(-6) || [];
  const rsi = marketData?.rsi || {};
  const macd = marketData?.macd?.h1 || {};
  const ema = marketData?.ema || {};
  const session = getMarketSession();
  return `You are GhostAgent Options Alpha, an autonomous paper-trading agent built on Alpaca.

Analyze the US equity underlying ${symbol} for a defined-risk LONG OPTIONS opportunity.
The agent may only buy a single call or put. It must never sell naked options, trade stocks instead of options, or invent a contract symbol.
When the evidence is mixed, data is incomplete, the market is closed, or the setup is not strong, return HOLD.

ACCOUNT / RISK
Account equity: $${accountBalance}
Maximum risk per trade: 1% of account equity
Market session: ${session}

ALPACA HISTORICAL MARKET DATA
Current price: ${marketData?.price ?? "N/A"}
Hourly change: ${marketData?.change ?? "N/A"}%
RSI(14) H1: ${rsi.h1 ?? "N/A"} | RSI(14) D1: ${rsi.d1 ?? "N/A"}
MACD H1: ${JSON.stringify(macd)}
EMA20 / EMA50 / EMA200: ${ema.ema20 ?? "N/A"} / ${ema.ema50 ?? "N/A"} / ${ema.ema200 ?? "N/A"}
ATR proxy H1: ${marketData?.atr ?? "N/A"}
Recent H1 candles: ${JSON.stringify(candles)}
Recent daily candles: ${JSON.stringify(daily)}

STRATEGY GATES
1. Require at least 6/8 confluence factors: daily trend, hourly trend, momentum, MACD, volatility, price action, volume/participation, and session.
2. A bullish setup maps to BUY_CALL; a bearish setup maps to BUY_PUT.
3. Confidence must be at least 78 and the score must be at least 6.
4. Prefer liquid large-cap underlyings during regular US hours.
5. The contract will be selected separately by the server from Alpaca's active contracts endpoint.
6. Give an underlying invalidation and target; these are decision levels, not an order stop on the option.

Return ONLY valid JSON:
{
  "decision": "BUY_CALL" | "BUY_PUT" | "HOLD",
  "confidence": 0-100,
  "confluenceScore": 0-8,
  "confluenceFactors": ["..."],
  "reasoning": "4-6 concise sentences citing the supplied values",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "riskRewardRatio": number,
  "riskPercent": 1,
  "timeframe": "1Hour",
  "session": "${session}",
  "forecast": "specific 1-3 session forecast",
  "keyLevels": "support and resistance",
  "invalidationLevel": "price level"
}`;
}

export async function analyzeMarket({ symbol, marketData, accountBalance = 100000 }) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error("AI engine is not configured");
  }

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
            content: "You are a disciplined options trading agent. Return raw JSON only. Prefer HOLD over low-quality trades.",
          },
          { role: "user", content: buildOptionsPrompt(symbol, marketData, accountBalance) },
        ],
        max_tokens: 1400,
      }),
    },
  );

  if (!response.ok) throw new Error(`AI engine error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  const raw = data?.result?.response || data?.result?.choices?.[0]?.message?.content || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI returned an unreadable response");

  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { throw new Error("AI response could not be parsed"); }

  let decision = String(parsed.decision || "HOLD").toUpperCase();
  if (decision === "BUY") decision = "BUY_CALL";
  if (decision === "SELL") decision = "BUY_PUT";
  if (!["BUY_CALL", "BUY_PUT", "HOLD"].includes(decision)) decision = "HOLD";

  const price = Number(parsed.entryPrice) || Number(marketData?.price) || 0;
  const stopLoss = Number(parsed.stopLoss) || 0;
  const takeProfit = Number(parsed.takeProfit) || 0;
  const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 0));
  const confluenceScore = Math.min(8, Math.max(0, Number(parsed.confluenceScore) || 0));
  const rr = Number(parsed.riskRewardRatio) || (
    stopLoss && takeProfit && price && Math.abs(price - stopLoss)
      ? Number((Math.abs(takeProfit - price) / Math.abs(price - stopLoss)).toFixed(2))
      : 0
  );

  if (confidence < 78 || confluenceScore < 6) decision = "HOLD";

  return {
    decision,
    confidence,
    confluenceScore,
    confluenceFactors: Array.isArray(parsed.confluenceFactors) ? parsed.confluenceFactors : [],
    reasoning: parsed.reasoning || "No qualifying options setup was found.",
    entryPrice: price,
    stopLoss,
    takeProfit,
    riskRewardRatio: rr,
    riskPercent: 1,
    recommendedQty: 1,
    timeframe: parsed.timeframe || "1Hour",
    session: parsed.session || getMarketSession(),
    forecast: parsed.forecast || "",
    keyLevels: parsed.keyLevels || "",
    invalidationLevel: parsed.invalidationLevel || "",
    model: MODEL,
    provider: "cloudflare-workers-ai",
    strategy: "Options Alpha / long premium",
    accountBalance,
  };
}