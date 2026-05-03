const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

function calcPipValue(symbol, lotSize) {
  const s = symbol.toUpperCase();
  if (s.includes("JPY")) return lotSize * 100000 * 0.01 * (1 / 155.2);
  if (s.includes("XAU")) return lotSize * 100 * 0.1;
  if (s.includes("XAG")) return lotSize * 5000 * 0.001;
  if (s.includes("BTC") || s.includes("ETH")) return lotSize * 1;
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

export async function analyzeMarket({ symbol, marketData, accountBalance = 1000 }) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new Error("AI engine not configured. Please contact support.");
  }

  const prompt = buildSignalPrompt(symbol, marketData, accountBalance);

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
            content: `You are GhostAgent — an elite forex and commodity trading signal AI. You analyze markets with precision and give high-reliability trading signals.

You MUST respond ONLY with valid JSON in this exact format (no markdown, no extra text, no <think> tags outside JSON):
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "reasoning": "<detailed reasoning in 3-5 sentences explaining the technical setup>",
  "entryPrice": <number>,
  "stopLoss": <number>,
  "takeProfit": <number>,
  "stopLossPips": <number>,
  "takeProfitPips": <number>,
  "riskRewardRatio": <number>,
  "recommendedLotSize": <number>,
  "riskPercent": <number 1 or 2>,
  "forecast": "<short market forecast for the next 4-8 hours>",
  "keyLevels": "<key support/resistance levels to watch>"
}`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1200,
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

  const parsed = JSON.parse(jsonMatch[0]);

  const decision = parsed.decision || "HOLD";
  const entryPrice = Number(parsed.entryPrice) || marketData?.price || 0;
  const stopLoss = Number(parsed.stopLoss) || 0;
  const takeProfit = Number(parsed.takeProfit) || 0;
  const stopLossPips = Math.abs(Number(parsed.stopLossPips) || 0);
  const riskPercent = Number(parsed.riskPercent) || 1;

  const recommendedLot = stopLossPips > 0
    ? calcLotSize(symbol, accountBalance, riskPercent, stopLossPips)
    : Math.max(0.01, Number(parsed.recommendedLotSize) || 0.01);

  const rr = stopLossPips > 0 && Number(parsed.takeProfitPips) > 0
    ? (Number(parsed.takeProfitPips) / stopLossPips).toFixed(2)
    : parsed.riskRewardRatio || "N/A";

  return {
    decision,
    confidence: Number(parsed.confidence) || 50,
    reasoning: parsed.reasoning || "Market analysis complete.",
    entryPrice,
    stopLoss,
    takeProfit,
    stopLossPips,
    takeProfitPips: Number(parsed.takeProfitPips) || 0,
    riskRewardRatio: rr,
    recommendedLotSize: recommendedLot,
    riskPercent,
    forecast: parsed.forecast || "",
    keyLevels: parsed.keyLevels || "",
    model: MODEL,
    provider: "cloudflare",
  };
}

function buildSignalPrompt(symbol, marketData, accountBalance) {
  const price = marketData?.price;
  const bid = marketData?.bid;
  const ask = marketData?.ask;
  const change = marketData?.change;
  const rsi = marketData?.rsi != null ? `RSI(14): ${Number(marketData.rsi).toFixed(2)}` : "RSI: not available";
  const macd = marketData?.macd
    ? `MACD: ${marketData.macd.macd?.toFixed(5)}, Signal: ${marketData.macd.signal?.toFixed(5)}, Hist: ${marketData.macd.hist?.toFixed(5)}`
    : "MACD: not available";
  const candles = marketData?.candles?.length
    ? `Last ${marketData.candles.length} H1 candles (oldest→newest): ${JSON.stringify(marketData.candles.slice(-5))}`
    : "Candles: not available";

  return `Analyze ${symbol} and provide a precise trading signal.

LIVE MARKET DATA (from FMP):
- Symbol: ${symbol}
- Current Price: ${price}
- Bid: ${bid} | Ask: ${ask}
- 24h Change: ${change}%
- ${rsi}
- ${macd}
- ${candles}

TRADER ACCOUNT:
- Account Balance: $${accountBalance}
- Risk tolerance: 1-2% per trade max

SIGNAL REQUIREMENTS:
1. Only signal BUY or SELL if confidence > 65%. Otherwise signal HOLD.
2. Set stop loss at nearest technical support/resistance level.
3. Target minimum 1:2 risk-reward ratio (preferably 1:3).
4. Calculate recommended lot size based on 1-2% account risk with the stop loss distance.
5. For ${symbol} with $${accountBalance} account, calculate the exact pip risk.

Provide your complete trading signal in the required JSON format.`;
}
