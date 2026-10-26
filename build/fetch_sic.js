'use strict';
// 全量拉取每家公司的主营业务（SEC EDGAR submissions API -> sic + sicDescription）
// 断点续传：已成功存入缓存的跳过；限速 + 429/超时重试；定期写盘防中断丢失。
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');
const BUILD = __dirname;

const sec = JSON.parse(fs.readFileSync(path.join(BUILD, 'sec_tickers.json'), 'utf8'));
const secByTicker = {};
for (const k of Object.keys(sec)) {
  const e = sec[k];
  const t = String(e.ticker || '').toUpperCase().replace(/[._]/g, '');
  if (t) secByTicker[t] = String(e.cik_str);
}

const comp = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies.json'), 'utf8'));
const items = []; // {ticker, cik, name}
for (const cat of comp.categories) {
  for (const c of cat.companies) {
    const t = String(c.ticker).toUpperCase().replace(/[._]/g, '');
    items.push({ ticker: c.ticker, cik: secByTicker[t] || null, name: c.name });
  }
}

const CACHE_PATH = path.join(BUILD, 'sic_cache.json');
let cache = {};
if (fs.existsSync(CACHE_PATH)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (e) { cache = {}; }
}

function fetchSic(cik) {
  return new Promise((resolve) => {
    const url = `https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`;
    const tryOnce = (attempt) => {
      const req = https.get(url, { headers: { 'User-Agent': 'WorkBuddy research zxlmu@example.com' } }, (res) => {
        if (res.statusCode === 429) { res.resume(); setTimeout(() => tryOnce(attempt + 1), 2000 * (attempt + 1)); return; }
        if (res.statusCode >= 500) { res.resume(); setTimeout(() => tryOnce(attempt + 1), 1500 * (attempt + 1)); return; }
        if (res.statusCode !== 200) { res.resume(); return resolve({ ok: false, reason: 'http' + res.statusCode }); }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const d = JSON.parse(body);
            resolve({ ok: true, sic: d.sic || null, sicDescription: d.sicDescription || null });
          } catch (e) { resolve({ ok: false, reason: 'parse' }); }
        });
      });
      req.on('error', () => { if (attempt < 5) setTimeout(() => tryOnce(attempt + 1), 1500 * (attempt + 1)); else resolve({ ok: false, reason: 'net' }); });
      req.setTimeout(20000, () => { req.destroy(); if (attempt < 5) setTimeout(() => tryOnce(attempt + 1), 1500 * (attempt + 1)); else resolve({ ok: false, reason: 'timeout' }); });
    };
    if (!/^\d+$/.test(cik)) return resolve({ ok: false, reason: 'badcik' });
    tryOnce(0);
  });
}

(async () => {
  const n = items.length;
  let idx = 0, fetched = 0;
  const CONC = 10; // 并发拉取提速（SEC 响应慢，单线程太慢）；429/超时已内置退避重试
  async function worker() {
    while (idx < items.length) {
      const it = items[idx++];
      if (cache[it.ticker] && cache[it.ticker].ok) continue;
      if (!it.cik) { cache[it.ticker] = { ok: true, reason: 'no_cik', sic: null, sicDescription: null }; continue; }
      const r = await fetchSic(it.cik);
      cache[it.ticker] = Object.assign({ ok: true }, r);
      fetched++;
      if (fetched % 200 === 0) {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
        console.log(`progress fetched=${fetched} cached=${Object.keys(cache).length}/${n}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  const withSic = Object.values(cache).filter((v) => v.ok && v.sicDescription).length;
  const failed = Object.values(cache).filter((v) => !v.ok && v.reason !== 'no_cik').length;
  console.log(`DONE. total=${Object.keys(cache).length} withSicDescription=${withSic} failed=${failed}`);
})();
