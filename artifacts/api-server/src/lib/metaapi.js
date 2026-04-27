const METAAPI_TOKEN = process.env.METAAPI_TOKEN;

let _MetaApi = null;
let _api = null;

async function getApi() {
  if (_api) return _api;
  if (!METAAPI_TOKEN) throw new Error("METAAPI_TOKEN is not configured");
  if (!_MetaApi) {
    try {
      const mod = await import("metaapi.cloud-sdk/esm-node");
      _MetaApi = mod.default || mod.MetaApi || mod;
    } catch (err) {
      throw new Error(`Failed to load MetaAPI SDK: ${err.message}`);
    }
  }
  _api = new _MetaApi(METAAPI_TOKEN);
  return _api;
}

export async function connectAccount(mt5Login, mt5Password, mt5Server) {
  const api = await getApi();

  // Check if account already exists in MetaAPI
  let existing = null;
  try {
    const { items } = await api.metatraderAccountApi.getAccountsWithInfiniteScrollPagination({ limit: 100 });
    existing = items?.find(
      (a) => String(a.login) === String(mt5Login) && a.server === mt5Server
    );
  } catch (_) {
    // No accounts yet — that's fine
  }

  if (existing) {
    if (existing.state !== "DEPLOYED") {
      await existing.deploy();
      await existing.waitConnected({ timeoutInSeconds: 120 });
    }
    return { accountId: existing.id, alreadyExisted: true };
  }

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
  await account.waitConnected({ timeoutInSeconds: 120 });
  return { accountId: account.id, alreadyExisted: false };
}

export async function getAccountInfo(mt5AccountId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  const info = await connection.getAccountInformation();
  await connection.close();
  return info;
}

export async function getMarketData(mt5AccountId, symbol) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });

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
  await connection.waitSynchronized({ timeoutInSeconds: 60 });

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
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  const positions = await connection.getPositions();
  await connection.close();
  return positions;
}

export async function closePosition(mt5AccountId, positionId) {
  const api = await getApi();
  const account = await api.metatraderAccountApi.getAccount(mt5AccountId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized({ timeoutInSeconds: 60 });
  const result = await connection.closePosition(positionId, { comment: "GhostAgent-close" });
  await connection.close();
  return result;
}

export function isMetaApiEnabled() {
  return !!METAAPI_TOKEN;
}
