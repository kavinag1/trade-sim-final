import { FINNHUB_API_KEY, FINNHUB_BASE_URL } from '../config';

const cache = new Map();
const CACHE_TTL = 15000; // 15 seconds for quotes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < entry.ttl) return entry.data;
  return null;
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, ts: Date.now(), ttl });
}

async function finnhubFetch(endpoint, params = {}) {
  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
  url.searchParams.set('token', FINNHUB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const cacheKey = url.toString();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  const data = await res.json();
  setCache(cacheKey, data);
  return data;
}

export async function getQuote(symbol) {
  const data = await finnhubFetch('/quote', { symbol: symbol.toUpperCase() });
  return {
    symbol: symbol.toUpperCase(),
    price: data.c,
    change: data.d,
    changePercent: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
    volume: data.v,
  };
}

export async function searchStocks(query) {
  const data = await finnhubFetch('/search', { q: query });
  if (!data.result) return [];
  return data.result
    .filter(r => r.type === 'Common Stock' || r.type === '')
    .slice(0, 10)
    .map(r => ({
      symbol: r.symbol,
      description: r.description,
      type: r.type,
    }));
}

export async function getCompanyProfile(symbol) {
  const data = await finnhubFetch('/stock/profile2', { symbol: symbol.toUpperCase() });
  return data;
}

export async function getCandles(symbol, resolution, from, to) {
  const data = await finnhubFetch('/stock/candle', {
    symbol: symbol.toUpperCase(),
    resolution,
    from,
    to,
  });
  if (data?.error) {
    throw new Error(data.error);
  }
  if (!data || data.s === 'no_data') return [];
  if (data.s !== 'ok' || !Array.isArray(data.t)) {
    throw new Error('Unable to load chart data from Finnhub');
  }
  const candles = [];
  for (let i = 0; i < data.t.length; i++) {
    candles.push({
      time: data.t[i],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    });
  }
  return candles;
}

export async function getMultipleQuotes(symbols) {
  const promises = symbols.map(s => getQuote(s).catch(() => null));
  const results = await Promise.all(promises);
  const map = {};
  results.forEach((r, i) => {
    if (r) map[symbols[i]] = r;
  });
  return map;
}
