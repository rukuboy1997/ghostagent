const METAAPI_TOKEN = process.env.METAAPI_TOKEN;

let _MetaApi = null;

async function getMetaApiClass() {
  if (_MetaApi) return _MetaApi;
  try {
    const mod = await import("metaapi.cloud-sdk/dists/esm-node/index.mjs");
    _MetaApi = mod.default || mod.MetaApi || mod;
    return _MetaApi;
  } catch (err) {
    throw new Error(`Failed to load MetaAPI SDK: ${err.message}`);
  }
}

function getApi() {
  if (!METAAPI_TOKEN) throw new Error("METAAPI_TOKEN is not configured");
  return getMetaApiClass().then((MetaApi) => new MetaApi(METAAPI_TOKEN));
}

export async function connectAccount(mt5Login, mt5Password, mt5Server) {
  const api = await getApi();
  const accounts = await api.metatraderAccountApi.getAccounts();

  const existing = accounts.find(
    (a) => a.login === String(mt5Login) && a.server === mt5Server
  );
  if (existing) return { accountId: existing.id, alreadyExisted: true };

  const account = await api.metatraderAccountApi.createAccount({
    name: `GhostAgent-${mt5Login}`,
    type: "cloud",
    login: String(mt5Login),
    password: mt5Password,
    server: mt5Server,
    platform: "mt5",
    magic: 123456,
  });

  await account.deploy();
  await account.waitConnected();
  return { accountId: account.id, alreadyExisted: false };
}

export async function getAccountInfo(mt5AccountId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  const info = await connection.getAccountInformation();
  await connection.close();
  return info;
}

export async function getMarketData(mt5AccountId, symbol) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();

  try {
    const price = await connection.getSymbolPrice(symbol);
    const candles = await connection
      .getHistoricalCandles(symbol, "1h", new Date(Date.now() - 5 * 3600 * 1000), new Date(), 5)
      .catch(() => []);
    await connection.close();
    return {
      symbol,
      bid: price.bid,
      ask: price.ask,
      currentPrice: ((price.bid + price.ask) / 2).toFixed(5),
      change: null,
      candles: candles.slice(-5),
    };
  } catch (err) {
    await connection.close();
    throw err;
  }
}

export async function placeTrade(mt5AccountId, { symbol, type, volume, stopLoss, takeProfit }) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();

  try {
    let result;
    if (type === "BUY") {
      result = await connection.createMarketBuyOrder(symbol, volume, stopLoss, takeProfit, {
        comment: "GhostAgent",
      });
    } else if (type === "SELL") {
      result = await connection.createMarketSellOrder(symbol, volume, stopLoss, takeProfit, {
        comment: "GhostAgent",
      });
    } else {
      throw new Error("Invalid trade type");
    }
    await connection.close();
    return result;
  } catch (err) {
    await connection.close();
    throw err;
  }
}

export async function getOpenTrades(mt5AccountId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  const positions = await connection.getPositions();
  await connection.close();
  return positions;
}

export async function closePosition(mt5AccountId, positionId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  const result = await connection.closePosition(positionId, { comment: "GhostAgent-close" });
  await connection.close();
  return result;
}

export function isMetaApiEnabled() {
  return !!METAAPI_TOKEN;
}
