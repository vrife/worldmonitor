import { isDesktopRuntime, toApiUrl } from '@/services/runtime';
import { getMarketWatchlistEntries } from '@/services/market-watchlist';
import { MARKET_SYMBOLS, COMMODITIES } from '@/config/markets';

const hydrationCache = new Map<string, unknown>();

export function getHydratedData(key: string): unknown | undefined {
  const val = hydrationCache.get(key);
  if (val !== undefined) hydrationCache.delete(key);
  return val;
}

function populateCache(data: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined) {
      hydrationCache.set(k, v);
    }
  }
}

async function fetchTier(tier: string, signal: AbortSignal, extraParams = ''): Promise<void> {
  try {
    const resp = await fetch(toApiUrl(`/api/bootstrap?tier=${tier}${extraParams}`), { signal });
    if (!resp.ok) return;
    const { data } = (await resp.json()) as { data: Record<string, unknown> };
    populateCache(data);
  } catch {
    // silent — panels fall through to individual calls
  }
}

export async function fetchBootstrapData(): Promise<void> {
  const fastCtrl = new AbortController();
  const slowCtrl = new AbortController();
  const desktop = isDesktopRuntime();
  const fastTimeout = setTimeout(() => fastCtrl.abort(), desktop ? 5_000 : 5_000);
  const slowTimeout = setTimeout(() => slowCtrl.abort(), desktop ? 8_000 : 8_000);

  // Compute the exact set of market symbols this user needs so the bootstrap
  // response contains only those quotes instead of the full seeded dataset.
  const customEntries = getMarketWatchlistEntries();
  const effectiveSymbols = new Set([
    ...MARKET_SYMBOLS.map((s) => s.symbol),
    ...COMMODITIES.map((s) => s.symbol),
    ...customEntries.map((e) => e.symbol).filter(Boolean),
  ]);
  const mktSymbolsParam = `&mktSymbols=${encodeURIComponent([...effectiveSymbols].join(','))}`;

  try {
    await Promise.all([
      fetchTier('slow', slowCtrl.signal),
      fetchTier('fast', fastCtrl.signal, mktSymbolsParam),
    ]);
  } finally {
    clearTimeout(fastTimeout);
    clearTimeout(slowTimeout);
  }
}
