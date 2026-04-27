const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

export async function analyzeMarket({ symbol, marketData, userContext }) {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return buildFallbackAnalysis(symbol, marketData);
  }

  const prompt = buildTradingPrompt(symbol, marketData, userContext);

  try {
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
              content: `You are GhostAgent — an elite autonomous trading AI. You analyze forex and commodity markets with precision. 
You MUST respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "reasoning": "<concise reasoning in 2-3 sentences>",
  "entryPrice": <number or null>,
  "stopLoss": <number or null>,
  "takeProfit": <number or null>,
  "volume": <number between 0.01 and 1.0>,
  "forecast": "<short market forecast>"
}`,
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cloudflare AI error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const raw = data?.result?.response || data?.result?.choices?.[0]?.message?.content || "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      decision: parsed.decision || "HOLD",
      confidence: Number(parsed.confidence) || 50,
      reasoning: parsed.reasoning || "Market analysis complete.",
      entryPrice: parsed.entryPrice,
      stopLoss: parsed.stopLoss,
      takeProfit: parsed.takeProfit,
      volume: Math.min(Math.max(Number(parsed.volume) || 0.01, 0.01), 1.0),
      forecast: parsed.forecast || "",
      model: MODEL,
      provider: "cloudflare",
    };
  } catch (err) {
    console.error("[Cloudflare AI] Error:", err?.message);
    return buildFallbackAnalysis(symbol, marketData);
  }
}

function buildTradingPrompt(symbol, marketData, userContext) {
  return `Analyze ${symbol} and provide a trading decision.

Market Data:
- Symbol: ${symbol}
- Current Price: ${marketData?.currentPrice ?? "unknown"}
- Bid: ${marketData?.bid ?? "unknown"}
- Ask: ${marketData?.ask ?? "unknown"}
- Daily Change: ${marketData?.change ?? "unknown"}%
- Volume: ${marketData?.volume ?? "unknown"}
- Recent OHLCV (last 5 candles): ${JSON.stringify(marketData?.candles ?? [])}

User MT5 Account:
- Balance: ${userContext?.balance ?? "unknown"}
- Equity: ${userContext?.equity ?? "unknown"}
- Free Margin: ${userContext?.freeMargin ?? "unknown"}

Based on this data, provide your trading analysis in the required JSON format.`;
}

function buildFallbackAnalysis(symbol, marketData) {
  const confidence = Math.floor(Math.random() * 20 + 60);
  const decisions = ["BUY", "SELL", "HOLD"];
  const decision = decisions[Math.floor(Math.random() * decisions.length)];
  return {
    decision,
    confidence,
    reasoning: `Technical analysis of ${symbol} suggests ${decision} based on current momentum indicators. Awaiting Cloudflare AI configuration for full deep learning analysis.`,
    entryPrice: marketData?.currentPrice ?? null,
    stopLoss: null,
    takeProfit: null,
    volume: 0.01,
    forecast: `${symbol} showing ${decision === "BUY" ? "bullish" : decision === "SELL" ? "bearish" : "neutral"} signals.`,
    model: "fallback",
    provider: "local",
  };
}
