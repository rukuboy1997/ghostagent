// ES module version
import { getOptionContracts, getOptionQuotes } from '../lib/options.js';

// Select the best put to sell for a given stock
const selectBestPut = async (stockSymbol) => {
  const contracts = await getOptionContracts(stockSymbol, 25, 45);
  if (contracts.length === 0) return null;

  // Group by expiration, pick the closest
  const grouped = contracts.reduce((acc, c) => {
    const key = c.expiration_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  const sortedExpiries = Object.keys(grouped).sort();
  const targetExpiry = sortedExpiries[0];
  const candidates = grouped[targetExpiry];

  // Get quotes for all candidates
  const symbols = candidates.map(c => c.symbol);
  const quotes = await getOptionQuotes(symbols);

  // Pick the one with the highest bid (premium) – OTM is automatically filtered by contract selection
  let best = null;
  let highestBid = 0;

  for (const contract of candidates) {
    const quote = quotes[contract.symbol];
    if (!quote || !quote.bid || quote.bid <= 0.01) continue;
    if (quote.bid > highestBid) {
      highestBid = quote.bid;
      best = {
        symbol: contract.symbol,
        strike: contract.strike_price,
        expiration: contract.expiration_date,
        bid: quote.bid,
        premium: quote.bid * 100,
        underlying: stockSymbol,
      };
    }
  }
  return best;
};

// Run the wheel cycle for a list of stocks
export const runWheelCycle = async (stocks = ['SPY', 'QQQ', 'AAPL']) => {
  const signals = [];
  for (const stock of stocks) {
    console.log(`Scanning ${stock} for puts...`);
    const put = await selectBestPut(stock);
    if (put) {
      signals.push({ ...put, type: 'SELL_PUT' });
      console.log(`🎯 Found signal: Sell Put on ${stock} for $${put.premium} premium.`);
    }
  }
  return signals;
};
