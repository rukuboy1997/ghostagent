const METAAPI_TOKEN = process.env.METAAPI_TOKEN;

let _MetaApi = null;
let _api = null;

async function getApi() {
  if (_api) return _api;
  if (!METAAPI_TOKEN) throw new Error("METAAPI_TOKEN is not configured");
  if (!_MetaApi) {
    const mod = await import("metaapi.cloud-sdk/esm-node");
    _MetaApi = mod.default || mod.MetaApi || mod;
  }
  _api = new _MetaApi(METAAPI_TOKEN);
  return _api;
}

// Connect (or find existing) account — returns accountId immediately without blocking on sync
export async function connectAccount(mt5Login, mt5Password, mt5Server) {
  const api = await getApi();

  // Check if already provisioned in MetaAPI
  try {
    const { items } = await api.metatraderAccountApi.getAccountsWithInfiniteScrollPagination({ limit: 100 });
    const existing = items?.find(
      (a) => String(a.login) === String(mt5Login) && a.server === mt5Server
    );
    if (existing) {
      // Ensure it's deployed (fire-and-forget, don't block)
      if (existing.state === "UNDEPLOYED") {
        existing.deploy().catch(() => {});
      }
      return { accountId: existing.id, alreadyExisted: true, state: existing.state, connectionStatus: existing.connectionStatus };
    }
  } catch (_) {}

  // Create new account
  const account = await api.metatraderAccountApi.createAccount({
    name: `GhostAgent-${mt5Login}`,
    type: "cloud",
    login: String(mt5Login),
    password: mt5Password,
    server: mt5Server,
    platform: "mt5",
    magic: 123456,
    reliability: "regular",
  });

  // Deploy fire-and-forget — don't wait
  account.deploy().catch(() => {});

  return { accountId: account.id, alreadyExisted: false, state: "DEPLOYING" };
}

// Check connection status via REST (fast, no SDK overhead)
export async function getAccountStatus(mt5AccountId) {
  const TOKEN = METAAPI_TOKEN;
  const res = await fetch(
    `https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${mt5AccountId}`,
    { headers: { "auth-token": TOKEN } }
  );
  if (!res.ok) throw new Error(`MetaAPI status check failed: ${res.status}`);
  const a = await res.json();
  return { state: a.state, connectionStatus: a.connectionStatus, server: a.server, login: a.login };
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
      result = await connection.createMarketBuyOrder(symbol, volume, stopLoss, takeProfit, { comment: "GhostAgent" });
    } else if (type === "SELL") {
      result = await connection.createMarketSellOrder(symbol, volume, stopLoss, takeProfit, { comment: "GhostAgent" });
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
