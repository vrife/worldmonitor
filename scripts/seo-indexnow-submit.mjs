#!/usr/bin/env node
/**
 * Submit all worldmonitor.io URLs to IndexNow after deploy.
 * Run once after deploying the IndexNow key file:
 *   node scripts/seo-indexnow-submit.mjs
 *
 * IndexNow requires all URLs in one request to share the same host.
 * Submits separate batches per subdomain.
 */

import { readdirSync } from 'node:fs';
import { basename } from 'node:path';

const KEY = 'a7f3e9d1b2c44e8f9a0b1c2d3e4f5a6b';
const BLOG_DIR = new URL('../blog-site/src/content/blog/', import.meta.url);

function getBlogPostUrls() {
  return readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => `https://www.worldmonitor.io/blog/posts/${basename(file, '.md')}/`)
    .sort();
}

const WWW_URLS = [
  'https://www.worldmonitor.io/',
  'https://www.worldmonitor.io/pro',
  'https://www.worldmonitor.io/blog/',
  ...getBlogPostUrls(),
];

const BATCHES = [
  {
    host: 'www.worldmonitor.io',
    urls: WWW_URLS,
  },
  { host: 'tech.worldmonitor.io', urls: ['https://tech.worldmonitor.io/'] },
  { host: 'finance.worldmonitor.io', urls: ['https://finance.worldmonitor.io/'] },
  { host: 'happy.worldmonitor.io', urls: ['https://happy.worldmonitor.io/'] },
];

const ENDPOINTS = [
  'https://api.indexnow.org/IndexNow',
  'https://www.bing.com/IndexNow',
  'https://searchadvisor.naver.com/indexnow',
  'https://search.seznam.cz/indexnow',
  'https://yandex.com/indexnow',
];

async function submit(endpoint, host, urlList) {
  const keyLocation = `https://${host}/${KEY}.txt`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'WorldMonitor-IndexNow/1.0 (+https://www.worldmonitor.io)',
    },
    body: JSON.stringify({ host, key: KEY, keyLocation, urlList }),
  });
  return { endpoint, host, status: res.status, ok: res.ok };
}

for (const { host, urls } of BATCHES) {
  console.log(`\n[${host}] (${urls.length} URLs)`);
  const results = await Promise.allSettled(ENDPOINTS.map(ep => submit(ep, host, urls)));
  for (const r of results) {
    if (r.status === 'fulfilled') {
      console.log(`  ${r.value.ok ? '✓' : '✗'} ${r.value.endpoint.replace('https://', '')} → ${r.value.status}`);
    } else {
      console.log(`  ✗ error: ${r.reason}`);
    }
  }
}
