'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD = __dirname;

// ---------- 1. 读取原始数据 ----------
const sec = JSON.parse(fs.readFileSync(path.join(BUILD, 'sec_tickers.json'), 'utf8'));
const secByTicker = {};
for (const k of Object.keys(sec)) {
  const e = sec[k];
  secByTicker[e.ticker] = e.title;
}

function parsePipe(file) {
  const text = fs.readFileSync(path.join(BUILD, file), 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const header = lines.shift().split('|').map(s => s.trim());
  const out = [];
  for (const line of lines) {
    if (/File Creation Time/i.test(line)) continue;
    const cols = line.split('|');
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    out.push(row);
  }
  return out;
}

const nasdaq = parsePipe('nasdaqlisted.txt');   // Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
const other = parsePipe('otherlisted.txt');     // ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol

// ---------- 2. 构建上市运营公司清单 ----------
// 排除：测试股、ETF、优先股/权证/权利/单位/票据/存托
const EXCLUDE_RE = /\b(preferred|pfd|\bwt\b|warrants?|\brights?\b|\bunits?\b|depositary shares?|subordinated|debentures? due|\bnotes due)\b/i;

function exchangeOf(row, isNasdaq) {
  if (isNasdaq) return '纳斯达克';
  const ex = (row['Exchange'] || '').toUpperCase();
  if (ex === 'N') return '纽交所';
  if (ex === 'A') return '纽交所美国(AMEX)';
  if (ex === 'P') return '纽交所Arca';
  if (ex === 'Z') return 'Cboe BZX';
  if (ex === 'V') return 'IEX';
  return '其他交易所';
}

function cleanName(secTitle, secName) {
  if (secTitle && secTitle.length > 2) return secTitle.replace(/\s+/g, ' ').trim();
  // 退而求其次：清理 security name
  return secName
    .replace(/\s+(Common Stock|Ordinary Shares|American Depositary Shares|ADS|Class [A-Z]?|Common Shares|Preferred Stock|Warrants?|Units?|Rights?)\b.*$/i, '')
    .replace(/\s+/g, ' ').trim();
}

const companies = []; // {ticker, name, exchange, secName}
const seen = new Set();

function ingest(rows, isNasdaq) {
  for (const r of rows) {
    const ticker = (r['Symbol'] || r['ACT Symbol'] || '').trim();
    const secName = (r['Security Name'] || '').trim();
    if (!ticker || !secName) continue;
    if (r['Test Issue'] === 'Y') continue;
    if (r['ETF'] === 'Y') continue;            // ETF 不是运营公司
    if (EXCLUDE_RE.test(secName)) continue;    // 优先股/权证/单位等
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    const name = cleanName(secByTicker[ticker], secName);
    companies.push({ ticker, name, exchange: exchangeOf(r, isNasdaq), secName: secName.toLowerCase() });
  }
}
ingest(nasdaq, true);
ingest(other, false);

console.log('上市运营公司总数:', companies.length);

// ---------- 3. 细分行业分类（关键词启发式，具体在前、宽泛在后）----------
// 每条：{id, name, kw:[小写关键词]}
const TAXONOMY = [
  { id: 'semiconductor', name: '半导体与芯片', kw: ['semiconductor', 'semicon', 'microchip', 'integrated circuit', 'silicon'] },
  { id: 'biotech', name: '生物科技', kw: ['biotech', 'bio-', 'bioscience', 'therapeutics', 'genomic', 'genetics', 'biopharma', 'cell therapy', 'gene', 'antibodies'] },
  { id: 'pharma', name: '制药与生命科学', kw: ['pharma', 'pharmaceutical', 'medicines', 'medicine', 'life science'] },
  { id: 'meddevice', name: '医疗器械', kw: ['medical device', 'surgical', 'medtech', 'diagnostics', 'diagnostic'] },
  { id: 'healthcare', name: '医疗健康服务', kw: ['health', 'healthcare', 'medical', 'clinic', 'hospital', 'care ', 'wellness', 'patient'] },
  { id: 'software', name: '软件与 SaaS', kw: ['software', 'saas', 'platform software'] },
  { id: 'ai', name: '人工智能与机器人', kw: ['artificial intelligence', 'robotics', 'machine learning', 'ai corp', 'cognitive'] },
  { id: 'internet', name: '互联网与社交', kw: ['internet', 'online', 'social', '.com', 'web ', 'web3', 'networks', 'digital', 'cyber'] },
  { id: 'ecommerce', name: '电商与数字零售', kw: ['ecommerce', 'e-commerce', 'marketplace', 'online retail', 'digital commerce'] },
  { id: 'telecom', name: '电信与通信', kw: ['telecom', 'telecommunication', 'communication', 'wireless', 'mobile', 'cellular', 'broadband', 'cable '] },
  { id: 'banking', name: '银行与储蓄', kw: ['bank', 'banco', 'banc', 'bancorp', 'bancorporation', 'savings', 'trust co', 'trust company', 'national association'] },
  { id: 'insurance', name: '保险', kw: ['insurance', 'assurance', 'reinsurance', 'casualty', ' life ', 'annuity', 'mutual insurance'] },
  { id: 'asset', name: '资管·私募·SPAC', kw: ['capital', 'partners', 'asset management', 'investment', 'holdings', 'acquisition', 'acquirer', 'spac', 'blank check', 'growth corp', 'opportunities', 'enterprises'] },
  { id: 'reit', name: '房地产与 REIT', kw: ['reit', 'realty', 'properties', 'property', 'real estate', 'apartments', 'residential', 'mortgage reit', 'lodging', 'prologis', 'land trust', 'centers '] },
  { id: 'oilgas', name: '油气与能源', kw: ['oil', 'gas ', 'petroleum', 'petro', 'energy', 'drilling', 'exploration', 'fuel', 'refining', 'pipeline', ' lng', 'natural gas'] },
  { id: 'renewable', name: '新能源与电力', kw: ['solar', 'wind', 'renewable', 'utility', ' electric', 'power', 'hydro', 'clean energy', 'geothermal'] },
  { id: 'chemical', name: '化工与材料', kw: ['chemical', 'chem ', 'materials', 'polymers', 'resin', 'specialty materials', 'coatings'] },
  { id: 'mining', name: '金属与采矿', kw: ['mining', 'gold', 'silver', 'copper', 'steel', 'metals', 'ore', 'lithium', 'mineral', 'coal', 'uranium', 'resources'] },
  { id: 'auto', name: '汽车与零部件', kw: ['motor', 'automotive', 'auto ', ' car ', 'vehicle', 'truck', 'electric vehicle', 'ev '] },
  { id: 'aerospace', name: '航空航天与国防', kw: ['aerospace', 'defense', 'defence', 'aviation', 'aircraft', 'airline', 'flight', 'space', 'rocket', 'military', 'drone', 'missile'] },
  { id: 'transport', name: '铁路·物流·海运', kw: ['rail', 'logistics', 'shipping', 'freight', 'transport', 'trucking', 'delivery', 'courier', 'cargo', 'marine', 'navigat', 'port'] },
  { id: 'restaurant', name: '餐饮与食品饮料', kw: ['restaurant', 'food', 'beverage', 'coffee', 'dining', 'eat ', 'snack', 'brewery', 'wine', 'spirits', 'beverage'] },
  { id: 'retail', name: '零售与消费品牌', kw: ['retail', 'store', 'shop', 'consumer', 'goods', 'apparel', 'clothing', 'luxury', 'fashion', 'wear', 'merchandis', 'brand'] },
  { id: 'manufacturing', name: '工业与制造', kw: ['manufactur', 'industrial', 'industries', 'industrials', 'products', 'machinery', 'equipment', 'tools', 'factory', 'fabricat'] },
  { id: 'construction', name: '建筑与工程', kw: ['construction', 'build', 'engineering', 'infrastructure', 'concrete', 'cement', 'contractor'] },
  { id: 'media', name: '媒体与娱乐', kw: ['media', 'entertainment', 'broadcast', 'film', 'music', 'game', 'gaming', 'studio', 'publishing', 'news', 'sports', 'streaming', 'television'] },
  { id: 'education', name: '教育', kw: ['education', 'school', 'learning', 'academy', 'university', 'teach', 'training'] },
  { id: 'travel', name: '旅游·酒店·博彩', kw: ['hotel', 'resort', 'travel', 'leisure', 'lodging', 'casino', 'cruise', 'vacation', 'gaming'] },
  { id: 'advertising', name: '广告与营销', kw: ['advertising', 'marketing', 'agency', 'adtech'] },
  { id: 'hr', name: '人力资源服务', kw: ['staffing', 'workforce', 'payroll', 'hr '] },
  { id: 'services', name: '商业与专业服务', kw: ['services', 'solutions', 'consulting', 'business services', 'outsourcing'] },
  { id: 'tech', name: '科技综合', kw: ['technologies', 'technology', 'tech ', 'techcorp', 'systems', 'labs'] },
  { id: 'financial', name: '金融综合', kw: ['financial', 'finance', 'financials', 'financier'] },
  { id: 'other', name: '其他综合', kw: [] },
];

const taxById = {};
TAXONOMY.forEach(t => { taxById[t.id] = t; });

function classify(secNameLower) {
  for (const t of TAXONOMY) {
    if (t.id === 'other') continue;
    for (const kw of t.kw) {
      if (secNameLower.includes(kw)) return t.id;
    }
  }
  return 'other';
}

// ---------- 4. 知名公司真实资料覆盖（保留官方站 + 真实简介）----------
const FEATURED = {
  AAPL: { website: 'https://www.apple.com', intro: '全球消费电子与操作系统龙头，iPhone、Mac、服务业务为核心。' },
  MSFT: { website: 'https://www.microsoft.com', intro: '微软，Windows、Office、Azure 云与企业软件巨头。' },
  NVDA: { website: 'https://www.nvidia.com', intro: '英伟达，GPU 与 AI 加速计算芯片领导者。' },
  GOOGL: { website: 'https://www.alphabet.com', intro: 'Alphabet，谷歌母公司，搜索、广告、云与 AI。' },
  AMZN: { website: 'https://www.amazon.com', intro: '亚马逊，全球电商与 AWS 云计算龙头。' },
  META: { website: 'https://www.meta.com', intro: 'Meta，社交平台 Facebook/Instagram 与元宇宙业务。' },
  TSLA: { website: 'https://www.tesla.com', intro: '特斯拉，电动汽车与储能、自动驾驶。' },
  JPM: { website: 'https://www.jpmorganchase.com', intro: '摩根大通，美国资产规模最大的银行控股公司。' },
  BRK_B: { website: 'https://www.berkshirehathaway.com', intro: '伯克希尔·哈撒韦，巴菲特掌舵的多元投资控股公司。' },
  V: { website: 'https://www.visa.com', intro: 'Visa，全球支付清算网络与银行卡品牌。' },
  JNJ: { website: 'https://www.jnj.com', intro: '强生，制药、医疗器械与消费健康巨头。' },
  WMT: { website: 'https://www.walmart.com', intro: '沃尔玛，全球最大连锁零售商之一。' },
  XOM: { website: 'https://www.exxonmobil.com', intro: '埃克森美孚，国际石油与天然气一体化巨头。' },
  DIS: { website: 'https://www.disney.com', intro: '迪士尼，影视、主题乐园与流媒体娱乐帝国。' },
  BAC: { website: 'https://www.bankofamerica.com', intro: '美国银行，全美大型零售与商业银行。' },
  PG: { website: 'https://www.pg.com', intro: '宝洁，日用消费品与个护品牌集团。' },
  MA: { website: 'https://www.mastercard.com', intro: '万事达，全球支付网络与清算服务。' },
  UNH: { website: 'https://www.unitedhealthgroup.com', intro: '联合健康，美国最大医疗健康保险与服务集团。' },
  HD: { website: 'https://www.homedepot.com', intro: '家得宝，家装建材零售连锁龙头。' },
  KO: { website: 'https://www.coca-colacompany.com', intro: '可口可乐，全球饮料品牌巨头。' },
  PEP: { website: 'https://www.pepsico.com', intro: '百事公司，饮料与休闲食品集团。' },
  NFLX: { website: 'https://www.netflix.com', intro: '奈飞，流媒体内容与订阅服务平台。' },
  ADBE: { website: 'https://www.adobe.com', intro: 'Adobe，创意与设计软件（Photoshop/PDF）领导者。' },
  CRM: { website: 'https://www.salesforce.com', intro: 'Salesforce，企业 CRM 与云服务龙头。' },
  INTC: { website: 'https://www.intel.com', intro: '英特尔，CPU 与半导体芯片老牌巨头。' },
  AMD: { website: 'https://www.amd.com', intro: 'AMD，CPU/GPU 与数据中心芯片厂商。' },
  ORCL: { website: 'https://www.oracle.com', intro: '甲骨文，数据库与企业级软件、云服务商。' },
  COST: { website: 'https://www.costco.com', intro: 'Costco，会员制仓储量贩零售巨头。' },
  PFE: { website: 'https://www.pfizer.com', intro: '辉瑞，全球大型制药与疫苗企业。' },
  GOOG: { website: 'https://www.alphabet.com', intro: 'Alphabet（Google 类股），搜索与广告、云与 AI。' },
};

// ---------- 5. 组装 companies.json ----------
const buckets = {};
TAXONOMY.forEach(t => { buckets[t.id] = []; });

for (const c of companies) {
  const catId = classify(c.secName);
  const feat = FEATURED[c.ticker];
  const catName = taxById[catId].name;
  const entry = {
    ticker: c.ticker,
    name: c.name,
    sector: catName,
    exchange: c.exchange,
    intro: feat ? feat.intro : `${c.exchange}上市公司，主营${catName.replace(/与.*$/, '')}相关业务。`,
    website: feat ? feat.website : `https://finance.yahoo.com/quote/${encodeURIComponent(c.ticker)}`,
    featured: feat ? true : false,
  };
  buckets[catId].push(entry);
}

// 每个分类内按 ticker 排序
for (const id of Object.keys(buckets)) buckets[id].sort((a, b) => a.ticker.localeCompare(b.ticker));

const categories = TAXONOMY.map(t => ({
  id: t.id,
  name: t.name,
  companies: buckets[t.id],
})).filter(c => c.companies.length > 0);

const total = categories.reduce((s, c) => s + c.companies.length, 0);
console.log('分类数:', categories.length, '| 公司总数:', total);

const out = {
  meta: {
    title: '美股上市公司分类导航',
    description: '按细分行业分类的美股全部上市公司目录，机器可读、可跳转。',
    updated: new Date().toISOString().slice(0, 10),
    source: 'NASDAQ Trader 上市清单 + SEC EDGAR（合并去重，已排除 ETF/测试股/优先股权证等）',
    total,
    generatedBy: '名称关键词启发式分类；知名公司保留官方站点与真实简介，其余跳转 Yahoo Finance 行情页。',
  },
  categories,
};

fs.writeFileSync(path.join(ROOT, 'companies.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('已写入 companies.json');

// 输出分类计数，便于检查
categories.forEach(c => console.log(`  ${c.name}: ${c.companies.length}`));
