# -*- coding: utf-8 -*-
"""
用 stockanalysis 的现代行业分类 + 真实官网 + 真实业务描述，重建 companies.json
输入：companies.json（提供 ticker/name/exchange/featured 与旧分类兜底）
      build/sa_cache.json（Sector/Industry/Website/Employees/IPO/Description）
      build/nasdaqlisted.txt / otherlisted.txt（证券全名，用于剔除债券类证券）
      build/sec_tickers.json（ticker -> CIK，用于无官网时兜底到 SEC 备案页）
输出：companies.json（覆盖）
"""
import json, os, re, csv, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def p(*a):
    return os.path.join(ROOT, *a)


# ---------- 分类体系（顺序即侧边栏顺序） ----------
TAXONOMY = [
    ('semiconductor', '半导体与芯片'),
    ('hardware', '电子与硬件设备'),
    ('software', '软件与 SaaS'),
    ('internet', '互联网与平台'),
    ('ecommerce', '电商与数字零售'),
    ('telecom', '电信与通信'),
    ('media', '媒体与娱乐'),
    ('advertising', '广告与营销'),
    ('biotech', '生物科技'),
    ('pharma', '制药'),
    ('meddevice', '医疗器械'),
    ('healthcare', '医疗健康服务'),
    ('banking', '银行'),
    ('insurance', '保险'),
    ('asset', '资管·私募·SPAC'),
    ('financial', '金融综合服务'),
    ('reit', '房地产与 REIT'),
    ('oilgas', '油气与能源'),
    ('renewable', '新能源与公用事业'),
    ('chemical', '化工与材料'),
    ('mining', '金属与采矿'),
    ('auto', '汽车与零部件'),
    ('aerospace', '航空航天与国防'),
    ('transport', '运输·物流·航运'),
    ('manufacturing', '工业与机械制造'),
    ('construction', '建筑与工程'),
    ('restaurant', '食品饮料与餐饮'),
    ('retail', '零售与消费品牌'),
    ('travel', '旅游·酒店·博彩'),
    ('education', '教育'),
    ('hr', '人力资源与商业服务'),
    ('other', '其他'),
]

# ---------- 行业名（小写）-> 分类；顺序敏感，具体的写前面 ----------
INDUSTRY_RULES = [
    # 科技硬件
    ('semiconductor equipment', 'semiconductor'),
    ('semiconductors', 'semiconductor'),
    ('semiconductor', 'semiconductor'),
    ('communication equipment', 'hardware'),
    ('electronic components', 'hardware'),
    ('electronic distribution', 'hardware'),
    ('electronics & computer distribution', 'hardware'),
    ('computer hardware', 'hardware'),
    ('consumer electronics', 'hardware'),
    ('scientific & technical instruments', 'hardware'),
    ('solar', 'renewable'),
    # 软件 / 互联网
    ('software - infrastructure', 'software'),
    ('software - application', 'software'),
    ('software - saas', 'software'),
    ('information technology services', 'software'),
    ('internet content & information', 'internet'),
    ('internet retail', 'ecommerce'),
    ('electronic gaming & multimedia', 'media'),
    # 通信 / 媒体
    ('telecom services', 'telecom'),
    ('pay tv', 'media'),
    ('broadcasting', 'media'),
    ('entertainment', 'media'),
    ('publishing', 'media'),
    ('advertising agencies', 'advertising'),
    ('media - diversified', 'media'),
    # 医药医疗
    ('biotechnology', 'biotech'),
    ('drug manufacturers - general', 'pharma'),
    ('drug manufacturers - specialty', 'pharma'),
    ('drug manufacturers', 'pharma'),
    ('medical devices', 'meddevice'),
    ('medical instruments & supplies', 'meddevice'),
    ('medical supplies', 'meddevice'),
    ('diagnostics & research', 'meddevice'),
    ('medical care facilities', 'healthcare'),
    ('healthcare plans', 'healthcare'),
    ('health information services', 'healthcare'),
    ('medical distribution', 'healthcare'),
    ('pharmaceutical retailers', 'healthcare'),
    # 金融
    ('banks - diversified', 'banking'),
    ('banks - regional', 'banking'),
    ('banks', 'banking'),
    ('insurance - diversified', 'insurance'),
    ('insurance - property', 'insurance'),
    ('insurance - life', 'insurance'),
    ('insurance - reinsurance', 'insurance'),
    ('insurance - specialty', 'insurance'),
    ('insurance brokers', 'insurance'),
    ('insurance', 'insurance'),
    ('asset management', 'asset'),
    ('capital markets', 'asset'),
    ('shell companies', 'asset'),
    ('financial data & stock exchanges', 'financial'),
    ('credit services', 'financial'),
    ('mortgage finance', 'financial'),
    ('financial conglomerates', 'financial'),
    # 地产
    ('reit', 'reit'),
    ('real estate services', 'reit'),
    ('real estate - development', 'reit'),
    ('real estate - diversified', 'reit'),
    ('real estate', 'reit'),
    # 能源
    ('oil & gas integrated', 'oilgas'),
    ('oil & gas e&p', 'oilgas'),
    ('oil & gas midstream', 'oilgas'),
    ('oil & gas refining', 'oilgas'),
    ('oil & gas equipment', 'oilgas'),
    ('oil & gas drilling', 'oilgas'),
    ('oil & gas', 'oilgas'),
    ('thermal coal', 'oilgas'),
    ('uranium', 'mining'),
    # 公用事业 / 新能源
    ('utilities - independent power', 'renewable'),
    ('utilities - renewable', 'renewable'),
    ('utilities - regulated electric', 'renewable'),
    ('utilities - regulated gas', 'renewable'),
    ('utilities - regulated water', 'renewable'),
    ('utilities - diversified', 'renewable'),
    ('utilities', 'renewable'),
    # 材料
    ('specialty chemicals', 'chemical'),
    ('chemicals', 'chemical'),
    ('agricultural inputs', 'chemical'),
    ('paper & paper products', 'chemical'),
    ('steel', 'mining'),
    ('aluminum', 'mining'),
    ('copper', 'mining'),
    ('gold', 'mining'),
    ('silver', 'mining'),
    ('other precious metals', 'mining'),
    ('other industrial metals', 'mining'),
    ('coking coal', 'mining'),
    ('building materials', 'construction'),
    ('lumber & wood', 'construction'),
    # 汽车 / 航空
    ('auto manufacturers', 'auto'),
    ('auto parts', 'auto'),
    ('auto & truck dealerships', 'auto'),
    ('recreational vehicles', 'auto'),
    ('aerospace & defense', 'aerospace'),
    # 运输
    ('railroads', 'transport'),
    ('trucking', 'transport'),
    ('marine shipping', 'transport'),
    ('airlines', 'transport'),
    ('airports & air services', 'transport'),
    ('integrated freight', 'transport'),
    ('freight', 'transport'),
    # 工业制造
    ('specialty industrial machinery', 'manufacturing'),
    ('farm & heavy construction machinery', 'manufacturing'),
    ('industrial distribution', 'manufacturing'),
    ('metal fabrication', 'manufacturing'),
    ('tools & accessories', 'manufacturing'),
    ('electrical equipment & parts', 'manufacturing'),
    ('pollution & treatment controls', 'manufacturing'),
    ('packaging & containers', 'manufacturing'),
    ('furnishings', 'manufacturing'),
    ('business equipment & supplies', 'manufacturing'),
    ('conglomerates', 'manufacturing'),
    ('industrial', 'manufacturing'),
    # 建筑
    ('engineering & construction', 'construction'),
    ('residential construction', 'construction'),
    ('building products', 'construction'),
    ('infrastructure operations', 'construction'),
    # 餐饮食品
    ('restaurants', 'restaurant'),
    ('packaged foods', 'restaurant'),
    ('confectioners', 'restaurant'),
    ('beverages - non-alcoholic', 'restaurant'),
    ('beverages - brewers', 'restaurant'),
    ('beverages - wineries', 'restaurant'),
    ('beverages', 'restaurant'),
    ('tobacco', 'restaurant'),
    ('farm products', 'restaurant'),
    ('food distribution', 'restaurant'),
    ('grocery stores', 'retail'),
    # 零售消费
    ('home improvement retail', 'retail'),
    ('specialty retail', 'retail'),
    ('department stores', 'retail'),
    ('discount stores', 'retail'),
    ('apparel retail', 'retail'),
    ('apparel manufacturing', 'retail'),
    ('footwear & accessories', 'retail'),
    ('luxury goods', 'retail'),
    ('textile manufacturing', 'retail'),
    ('household & personal products', 'retail'),
    ('retail', 'retail'),
    # 旅游
    ('travel services', 'travel'),
    ('lodging', 'travel'),
    ('resorts & casinos', 'travel'),
    ('gambling', 'travel'),
    ('leisure', 'travel'),
    # 教育
    ('education & training', 'education'),
    ('education', 'education'),
    # 商业服务
    ('staffing & employment', 'hr'),
    ('consulting services', 'hr'),
    ('specialty business services', 'hr'),
    ('rental & leasing', 'hr'),
    ('waste management', 'hr'),
    ('security & protection', 'hr'),
    ('personal services', 'hr'),
    ('business services', 'hr'),
]

SECTOR_FALLBACK = {
    'technology': 'software',
    'healthcare': 'healthcare',
    'financials': 'financial',
    'real estate': 'reit',
    'energy': 'oilgas',
    'industrials': 'manufacturing',
    'consumer cyclical': 'retail',
    'consumer defensive': 'retail',
    'utilities': 'renewable',
    'basic materials': 'chemical',
    'communication services': 'media',
}

# 公司名兜底关键词（行业缺失时）
NAME_RULES = [
    (r'bancorp|bancshares|bank\b|banking', 'banking'),
    (r'insurance|assurance|reinsurance', 'insurance'),
    (r'biotech|bioscience|biosciences|therapeutics|biopharma', 'biotech'),
    (r'pharma|pharmaceutical', 'pharma'),
    (r'semiconductor|microelectronic', 'semiconductor'),
    (r'software|systems', 'software'),
    (r'reit|realty|real estate', 'reit'),
    (r'energy|petroleum|oil|gas', 'oilgas'),
    (r'mining|minerals|gold|silver|resources', 'mining'),
    (r'motors|automotive', 'auto'),
    (r'airlines|airways|shipping|logistics|railroad', 'transport'),
    (r'acquisition|holdings|capital|partners|investment', 'asset'),
]

# 明显非普通股（债券/票据/权证/优先股/单位）
NON_COMMON_RE = re.compile(
    r'(?:\bETN\b|Exchange-Traded Notes?|\bNotes?\b(?!.*Common)|\bWarrants?\b|\bRights?\b|\bUnits?\b|\bPreferred\b|% )',
    re.I,
)

# 封闭式基金 / 共同基金：是基金不是运营公司，剔除（BDC 除外，BDC 是真实放贷企业）
CEF_RE = re.compile(r'\bclos(?:e|ed)[\s-]*end(?:ed)?\b', re.I)
FUND_RE = re.compile(r'\b(?:mutual fund|investment trust|income fund|equity fund|bond fund)\b', re.I)
BDC_RE = re.compile(r'\bbusiness development compan|\bBDC\b', re.I)
# 名称兜底：无任何数据时，名字里带这些词的基本是基金/信托/结构化产品
FUND_NAME_RE = re.compile(r'\b(FUND|TRUST|STRATS|TRUST SERIES)\b', re.I)


def is_fund_vehicle(desc):
    if not desc:
        return False
    if BDC_RE.search(desc):
        return False
    if CEF_RE.search(desc):
        return True
    if FUND_RE.search(desc) and re.search(r'\bfund\b', desc, re.I):
        return True
    return False

FEATURED = {
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'AVGO', 'BRK.B',
    'JPM', 'V', 'MA', 'UNH', 'JNJ', 'XOM', 'WMT', 'PG', 'HD', 'COST', 'ORCL', 'AMD',
    'INTC', 'CRM', 'ADBE', 'NFLX', 'DIS', 'KO', 'PEP', 'BAC', 'PFE', 'LLY', 'ABBV',
    'MRK', 'TMO', 'CSCO', 'QCOM', 'TXN', 'IBM', 'GE', 'CAT', 'BA', 'NKE', 'MCD',
    'GS', 'MS', 'C', 'WFC', 'AXP', 'PLTR', 'UBER', 'ABNB', 'SHOP', 'COIN', 'SNOW',
}


def classify(rec):
    ind = (rec.get('industry') or '').strip().lower()
    sec = (rec.get('sector') or '').strip().lower()
    desc = rec.get('desc') or ''
    name = rec.get('name') or ''

    # 1) 行业精确/前缀匹配
    for kw, cat in INDUSTRY_RULES:
        if ind == kw or ind.startswith(kw):
            cat_id = cat
            break
    else:
        cat_id = None

    # 2) 行业里含关键词（保底）
    if not cat_id and ind:
        for kw, cat in INDUSTRY_RULES:
            if kw in ind:
                cat_id = cat
                break

    # 3) Sector 兜底
    if not cat_id and sec:
        cat_id = SECTOR_FALLBACK.get(sec)

    # 4) 公司名兜底
    if not cat_id:
        for pat, cat in NAME_RULES:
            if re.search(pat, name, re.I):
                cat_id = cat
                break

    if not cat_id:
        cat_id = 'other'

    return cat_id


def load_security_names():
    m = {}
    for fn, symk, namek in (
        ('nasdaqlisted.txt', 'Symbol', 'Security Name'),
        ('otherlisted.txt', 'ACT Symbol', 'Security Name'),
    ):
        path = p('build', fn)
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8', errors='replace') as f:
            for row in csv.DictReader(f, delimiter='|'):
                t = (row.get(symk) or '').strip().upper()
                n = (row.get(namek) or '').strip()
                if t and t not in m:
                    m[t] = n
    return m


def main():
    old = json.load(open(p('companies.json'), encoding='utf-8'))
    cache = json.load(open(p('build', 'sa_cache.json'), encoding='utf-8'))
    secnames = load_security_names()

    cik = {}
    st_path = p('build', 'sec_tickers.json')
    if os.path.exists(st_path):
        for _, v in json.load(open(st_path, encoding='utf-8')).items():
            t = (v.get('ticker') or '').upper().replace('.', '-')
            if t:
                cik[t] = str(v.get('cik_str'))
                cik.setdefault(t.replace('-', '.'), str(v.get('cik_str')))

    old_rows = []
    for cat in old['categories']:
        for co in cat['companies']:
            co['_oldcat'] = cat['id']
            old_rows.append(co)

    kept, dropped = [], []
    for co in old_rows:
        t = co['ticker'].upper()
        # 含 $ 的代码一律是优先股/债券类（如 MS$F、TRTN$A），非普通股
        if '$' in t:
            dropped.append((t, '$ 后缀（优先股/债券类）'))
            continue
        sname = secnames.get(t, '')
        if sname and NON_COMMON_RE.search(sname):
            dropped.append((t, sname))
            continue
        kept.append(co)

    rows = []
    stat = Counter()
    dropped_fund = []
    dropped_empty = []
    for co in kept:
        t = co['ticker']
        rec = cache.get(t) or {}
        ok = bool(rec.get('ok'))

        if is_fund_vehicle(rec.get('desc') or ''):
            dropped_fund.append((t, co['name'], (rec.get('desc') or '')[:70]))
            continue

        item = {
            'ticker': t,
            'name': co['name'],
            'exchange': co.get('exchange', ''),
        }

        if ok:
            item['industry'] = rec.get('industry', '')
            item['employees'] = rec.get('employees', '')
            item['ipo'] = (rec.get('ipo') or '')[-4:] if rec.get('ipo') else ''
            cat_id = classify({
                'industry': rec.get('industry', ''),
                'sector': rec.get('sector', ''),
                'desc': rec.get('desc', ''),
                'name': co['name'],
            })
        else:
            item['industry'] = ''
            item['employees'] = ''
            item['ipo'] = ''
            cat_id = co.get('_oldcat') or 'other'
            stat['cache_miss'] += 1

        # 官网：优先真实官网，退 stockanalysis 页面，再退 SEC 备案页
        web = (rec.get('website') or '').strip()
        if web.startswith('http'):
            item['website'] = web
            item['linkType'] = 'official'
        elif ok and rec.get('slug'):
            item['website'] = 'https://stockanalysis.com/stocks/%s/' % rec['slug']
            item['linkType'] = 'profile'
        else:
            c = cik.get(t.upper()) or cik.get(t.upper().replace('.', '-'))
            if c:
                item['website'] = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=%s&type=10-K' % c
                item['linkType'] = 'filing'
            else:
                item['website'] = ''
                item['linkType'] = 'none'

        # 简介：真实业务描述优先
        desc = (rec.get('desc') or '').strip()
        if desc:
            if len(desc) > 240:
                cut = desc[:240]
                pos = cut.rfind('. ')
                desc = (cut[:pos + 1] if pos > 120 else cut.rstrip() + '…')
            item['intro'] = desc
        else:
            parts = []
            if item['industry']:
                parts.append(item['industry'])
            if item['employees']:
                parts.append('%s employees' % item['employees'])
            item['intro'] = ' · '.join(parts)
            stat['no_desc'] += 1

        # 无任何数据（无行业、无描述）时，按名称判断是否为基金/信托等非运营实体
        if not item['industry'] and not item['intro']:
            if FUND_NAME_RE.search(co['name']) and not re.search(r'acquisition', co['name'], re.I):
                dropped_empty.append((t, co['name']))
                continue
            if not item['website']:
                dropped_empty.append((t, co['name']))
                continue

        item['featured'] = t.upper() in FEATURED
        item['sector'] = dict(TAXONOMY).get(cat_id, cat_id)
        item['_cat'] = cat_id
        stat[cat_id] += 1
        rows.append(item)

    # 分桶
    buckets = defaultdict(list)
    for r in rows:
        buckets[r['_cat']].append(r)

    categories = []
    for cid, cname in TAXONOMY:
        lst = buckets.get(cid) or []
        if not lst:
            continue
        lst.sort(key=lambda x: (not x['featured'], x['name']))
        for r in lst:
            r.pop('_cat', None)
        categories.append({'id': cid, 'name': cname, 'companies': lst})

    # other 放最后
    categories.sort(key=lambda c: (c['id'] == 'other', -len(c['companies'])))

    total = sum(len(c['companies']) for c in categories)
    out = {
        'meta': {
            'title': '美股上市公司分类导航',
            'description': '按主营业务分类的美股全部上市公司目录，机器可读、可直达官网。',
            'updated': '2026-10-27',
            'source': 'NASDAQ Trader 上市清单 + SEC EDGAR（CIK/备案）+ StockAnalysis（行业、官网、业务描述）',
            'total': total,
            'generatedBy': '以现代行业分类（Sector/Industry）为主，公司名关键词兜底；已剔除 ETF/ETN/债券/权证/优先股等非普通股，以及封闭式基金等非运营实体。',
        },
        'categories': categories,
    }
    json.dump(out, open(p('companies.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print('=== 重建完成 ===')
    print('剔除非普通股(ETN/债/优先股):', len(dropped))
    print('剔除封闭式基金/投资基金:', len(dropped_fund))
    print('剔除无数据空壳条目:', len(dropped_empty), [x[0] for x in dropped_empty])
    for t, n, dd in dropped_fund[:8]:
        print('   -', t, n[:40], '|', dd[:55])
    print('\n保留公司:', total, '| 分类数:', len(categories))
    print('缓存未命中(沿用旧分类):', stat['cache_miss'], '| 无业务描述:', stat['no_desc'])
    print()
    for c in sorted(categories, key=lambda x: -len(x['companies'])):
        print('  %-14s %5d  %s' % (c['id'], len(c['companies']), c['name']))


if __name__ == '__main__':
    main()
