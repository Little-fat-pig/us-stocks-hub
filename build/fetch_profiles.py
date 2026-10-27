# -*- coding: utf-8 -*-
"""
抓取 stockanalysis.com 公司资料（美股全量）
每个 ticker 抓两页：
  /stocks/{slug}/          -> Sector / Industry / Website / Employees / IPO / Exchange
  /stocks/{slug}/company/  -> Company Description（真实业务描述）
输出：build/sa_cache.json （带断点续传）
"""
import json, os, re, sys, time, threading
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'build', 'sa_cache.json')
COMPANIES = os.path.join(ROOT, 'companies.json')

WORKERS = int(os.environ.get('SA_WORKERS', '6'))
TIMEOUT = 25
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

local = threading.local()


def session():
    if not hasattr(local, 's'):
        s = requests.Session()
        s.headers.update({
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        local.s = s
    return local.s


def clean(txt):
    txt = re.sub(r'<[^>]+>', ' ', txt)
    txt = txt.replace('&amp;', '&').replace('&#39;', "'").replace('&quot;', '"')
    txt = txt.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>')
    return re.sub(r'\s+', ' ', txt).strip()


def parse_main(html):
    out = {}
    pairs = re.findall(r'\{t:"([^"]+)",v:"([^"]*)"', html)
    for k, v in pairs:
        out[k] = v
    m = re.search(r'<span class="block font-semibold">Website</span>\s*<!--\[1-->.*?href="([^"]+)"', html, re.S)
    if m:
        out['Website'] = m.group(1)
    return {
        'sector': out.get('Sector', ''),
        'industry': out.get('Industry', ''),
        'website': out.get('Website', ''),
        'employees': out.get('Employees', ''),
        'ipo': out.get('IPO Date', ''),
        'exchange': out.get('Stock Exchange', ''),
    }


def parse_company(html):
    i = html.find('Company Description</h1>')
    if i < 0:
        return ''
    tail = html[i:i + 12000]
    # 取该标题后的第一个 <div ...> 块内的所有 <p>
    d = re.search(r'<div class="mb-5[^"]*">(.*?)</div>', tail, re.S)
    block = d.group(1) if d else tail
    ps = re.findall(r'<p>(.*?)</p>', block, re.S)
    if not ps:
        ps = re.findall(r'<p[^>]*>(.*?)</p>', block, re.S)
    txt = ' '.join(clean(p) for p in ps if clean(p))
    txt = re.sub(r'\s+', ' ', txt).strip()
    return txt[:1200]


def slug_variants(ticker):
    t = ticker.lower().strip()
    vs = []
    vs.append(t.replace('.', '-'))
    vs.append(t.replace('.', ''))
    vs.append(t)
    # 去重保序
    seen, out = set(), []
    for v in vs:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def fetch_one(ticker):
    s = session()
    rec = {'ok': False}
    for slug in slug_variants(ticker):
        url = 'https://stockanalysis.com/stocks/%s/' % slug
        try:
            r = s.get(url, timeout=TIMEOUT, allow_redirects=True)
        except Exception as e:
            rec['err'] = type(e).__name__
            continue
        if r.status_code == 429:
            time.sleep(3)
            try:
                r = s.get(url, timeout=TIMEOUT)
            except Exception:
                continue
        if r.status_code != 200:
            rec['lastStatus'] = r.status_code
            continue
        rec.update(parse_main(r.text))
        rec['ok'] = True
        rec['slug'] = slug
        # 第二页：业务描述
        try:
            r2 = s.get('https://stockanalysis.com/stocks/%s/company/' % slug, timeout=TIMEOUT)
            if r2.status_code == 200:
                rec['desc'] = parse_company(r2.text)
        except Exception:
            pass
        break
    return ticker, rec


def main():
    d = json.load(open(COMPANIES, encoding='utf-8'))
    tickers = [c['ticker'] for cat in d['categories'] for c in cat['companies']]
    tickers = list(dict.fromkeys(tickers))

    cache = {}
    if os.path.exists(CACHE):
        try:
            cache = json.load(open(CACHE, encoding='utf-8'))
        except Exception:
            cache = {}

    todo = [t for t in tickers if not (cache.get(t) or {}).get('ok')]
    print('总 ticker=%d | 已缓存成功=%d | 待抓=%d | 并发=%d'
          % (len(tickers), len(tickers) - len(todo), len(todo), WORKERS), flush=True)

    done = 0
    t0 = time.time()
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(fetch_one, t): t for t in todo}
        for f in as_completed(futs):
            t = futs[f]
            try:
                tk, rec = f.result()
            except Exception as e:
                tk, rec = t, {'ok': False, 'err': 'future:' + type(e).__name__}
            with lock:
                cache[tk] = rec
                done += 1
                if done % 100 == 0:
                    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
                    el = time.time() - t0
                    rate = done / el * 60 if el else 0
                    eta = (len(todo) - done) / max(rate, 0.01)
                    okn = sum(1 for v in cache.values() if v.get('ok'))
                    print('进度 %d/%d | ok=%d | %.0f 家/分 | ETA %.0f 分'
                          % (done, len(todo), okn, rate, eta), flush=True)

    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    ok = sum(1 for v in cache.values() if v.get('ok'))
    web = sum(1 for v in cache.values() if v.get('website'))
    desc = sum(1 for v in cache.values() if v.get('desc'))
    print('DONE. cache=%d ok=%d website=%d desc=%d 用时 %.1f 分'
          % (len(cache), ok, web, desc, (time.time() - t0) / 60), flush=True)


if __name__ == '__main__':
    main()
