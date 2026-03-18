/**
 * Cron warmup — pre-seeds expensive endpoints that aren't covered by the
 * Render relay so Redis cache never expires between user requests.
 *
 * Called by Vercel cron every 10 minutes (see vercel.json).
 * Auth: requires Authorization: Bearer $CRON_SECRET header (Vercel sets this
 * automatically when CRON_SECRET is configured in environment variables).
 */

export const config = { runtime: 'edge' };

// Endpoints to warm, in priority order.
// These are endpoints that (a) have short Redis TTLs and (b) are NOT seeded
// by the Render relay — so the first user after a cache miss pays the full
// external-API fetch cost instead of a fast Redis read.
const WARM_PATHS = [
  '/api/news/v1/list-feed-digest?variant=full&lang=en',
  '/api/news/v1/list-feed-digest?variant=full&lang=es',
  '/api/news/v1/list-feed-digest?variant=full&lang=fr',
];

export default async function handler(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const apiKey = (process.env.WORLDMONITOR_VALID_KEYS || '').split(',').filter(Boolean)[0];
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const base = new URL(req.url).origin;
  const results = await Promise.allSettled(
    WARM_PATHS.map(async (path) => {
      const r = await fetch(`${base}${path}`, {
        headers: { 'X-WorldMonitor-Key': apiKey },
        signal: AbortSignal.timeout(20_000),
      });
      return { path, status: r.status };
    }),
  );

  const summary = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { path: '?', status: 'error', reason: String(r.reason) },
  );

  return new Response(JSON.stringify({ warmed: summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
