'use strict';
// 用 SEC 主营业务（sic + sicDescription）重建分类，替代原"名字关键词"启发式。
// 三级映射：SIC 精确/范围 -> sicDescription 业务词 -> 公司名关键词 -> 其他
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = __dirname;

const comp = JSON.parse(fs.readFileSync(path.join(ROOT, 'companies.json'), 'utf8'));
const cache = fs.existsSync(path.join(BUILD, 'sic_cache.json'))
  ? JSON.parse(fs.readFileSync(path.join(BUILD, 'sic_cache.json'), 'utf8'))
  : {};

// 分类顺序与中文名
const TAX = [
  ['semiconductor', '半导体与芯片'], ['biotech', '生物科技'], ['pharma', '制药与生命科学'],
  ['meddevice', '医疗器械'], ['healthcare', '医疗健康服务'], ['software', '软件与 SaaS'],
  ['ai', '人工智能与机器人'], ['internet', '互联网与社交'], ['ecommerce', '电商与数字零售'],
  ['telecom', '电信与通信'], ['banking', '银行与储蓄'], ['insurance', '保险'],
  ['asset', '资管·私募·SPAC'], ['reit', '房地产与 REIT'], ['oilgas', '油气与能源'],
  ['renewable', '新能源与电力'], ['chemical', '化工与材料'], ['mining', '金属与采矿'],
  ['auto', '汽车与零部件'], ['aerospace', '航空航天与国防'], ['transport', '铁路·物流·海运'],
  ['restaurant', '餐饮与食品饮料'], ['retail', '零售与消费品牌'], ['manufacturing', '工业与制造'],
  ['construction', '建筑与工程'], ['media', '媒体与娱乐'], ['education', '教育'],
  ['travel', '旅游·酒店·博彩'], ['advertising', '广告与营销'], ['hr', '人力资源服务'],
  ['services', '商业与专业服务'], ['tech', '科技综合'], ['financial', '金融综合'],
  ['other', '其他综合'],
];
const taxName = {}; TAX.forEach(([id, n]) => (taxName[id] = n));

// 知名公司真实资料（保留官网 + 简介，分类仍按业务）
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

// 头部/典型公司强制归类（覆盖 SEC 对互联网/电商/AI 等现代行业的粗粒度），保证细分有代表且不空
const SECTOR_OVERRIDE = {
  GOOGL: 'internet', GOOG: 'internet', META: 'internet', NFLX: 'internet', BIDU: 'internet',
  SNAP: 'internet', TWLO: 'internet', PINS: 'internet', ROKU: 'internet', SPOT: 'internet',
  AMZN: 'ecommerce', SHOP: 'ecommerce', EBAY: 'ecommerce', ETSY: 'ecommerce', DASH: 'ecommerce',
  ABNB: 'ecommerce', W: 'ecommerce',
  PLTR: 'ai', AI: 'ai', PATH: 'ai',
  NVDA: 'semiconductor', INTC: 'semiconductor', AMD: 'semiconductor', QCOM: 'semiconductor',
  MSFT: 'software', ADBE: 'software', CRM: 'software', ORCL: 'software', NOW: 'software', SNOW: 'software',
  AAPL: 'tech', TSLA: 'auto',
  JPM: 'banking', BAC: 'banking', WFC: 'banking', C: 'banking',
  V: 'financial', MA: 'financial', PYPL: 'financial',
  WMT: 'retail', COST: 'retail', HD: 'retail', TGT: 'retail',
  XOM: 'oilgas', CVX: 'oilgas',
  DIS: 'media',
  JNJ: 'pharma', PFE: 'pharma', MRK: 'pharma',
  UNH: 'healthcare',
  KO: 'restaurant', PEP: 'restaurant',
  BRK_B: 'asset',
  PG: 'retail', NKE: 'retail',
};

// SIC 精确（3/4 位）细分
const EXACT = {
  '2833': 'pharma', '2834': 'pharma', '2835': 'meddevice', '2836': 'biotech',
  '284': 'chemical', '285': 'chemical', '286': 'chemical', '287': 'chemical',
  '291': 'oilgas', '331': 'mining',
  '3571': 'tech', '3572': 'tech', '3575': 'tech', '3577': 'tech', '3578': 'tech', '3579': 'tech',
  '366': 'telecom', '3674': 'semiconductor', '367': 'tech',
  '3711': 'auto', '3713': 'auto', '3714': 'auto', '3715': 'auto',
  '372': 'aerospace', '3721': 'aerospace', '3724': 'aerospace', '3728': 'aerospace',
  '376': 'aerospace', '378': 'aerospace',
  '373': 'transport', '374': 'transport', '375': 'manufacturing',
  '382': 'meddevice', '384': 'meddevice', '385': 'meddevice', '386': 'media', '387': 'retail',
  '737': 'tech', '7371': 'software', '7372': 'software', '7373': 'software', '7374': 'software',
  '7375': 'internet', '7376': 'tech', '7377': 'tech', '7378': 'tech', '7379': 'tech',
  '731': 'advertising', '736': 'hr',
  '7391': 'services', '738': 'services',
  '6798': 'reit', '6770': 'asset',
  '602': 'banking', '603': 'banking', '606': 'banking', '609': 'banking',
  '62': 'asset', '63': 'insurance', '64': 'insurance',
  '70': 'travel', '78': 'media', '79': 'travel', '80': 'healthcare', '82': 'education',
  '83': 'healthcare', '87': 'services', '89': 'services',
};
// SIC 前两位范围兜底（标准行业大类）
const RANGE = {
  '10': 'mining', '11': 'mining', '12': 'mining', '13': 'oilgas', '14': 'mining',
  '15': 'construction', '16': 'construction', '17': 'construction',
  '20': 'restaurant', '21': 'restaurant', '22': 'manufacturing', '23': 'retail', '24': 'manufacturing',
  '25': 'manufacturing', '26': 'manufacturing', '27': 'media', '28': 'chemical', '29': 'oilgas',
  '30': 'manufacturing', '31': 'retail', '32': 'manufacturing', '33': 'mining', '34': 'manufacturing',
  '35': 'manufacturing', '36': 'tech', '37': 'auto', '38': 'meddevice', '39': 'manufacturing',
  '40': 'transport', '41': 'transport', '42': 'transport', '43': 'transport', '44': 'transport',
  '45': 'transport', '46': 'transport', '47': 'transport', '48': 'telecom', '49': 'renewable',
  '50': 'services', '51': 'services', '52': 'retail', '53': 'retail', '54': 'retail', '55': 'auto',
  '56': 'retail', '57': 'retail', '58': 'restaurant', '59': 'retail',
  '60': 'banking', '61': 'financial', '65': 'reit', '67': 'asset',
  '72': 'services', '73': 'services', '75': 'auto', '76': 'services',
  '81': 'services', '84': 'other', '91': 'other', '99': 'other',
};
// sicDescription 业务词（跨 SIC 细分，作为 SIC 缺失时的补救）
const DESC_KW = [
  ['semiconductor', 'semiconductor'], ['silicon', 'semiconductor'],
  ['biotech', 'biotech'], ['bio', 'biotech'], ['gene', 'biotech'], ['therapeutic', 'biotech'],
  ['biological', 'biotech'], ['cell therapy', 'biotech'], ['vaccine', 'biotech'], ['antibod', 'biotech'],
  ['pharmaceutical', 'pharma'], ['pharma', 'pharma'], ['medicine', 'pharma'],
  ['medical device', 'meddevice'], ['surgical', 'meddevice'], ['diagnostic', 'meddevice'],
  ['health', 'healthcare'], ['clinic', 'healthcare'], ['hospital', 'healthcare'], ['patient', 'healthcare'],
  ['software', 'software'], ['saas', 'software'], ['internet', 'internet'],
  ['online', 'internet'], ['web', 'internet'], ['social', 'internet'],
  ['restaurant', 'restaurant'], ['food', 'restaurant'], ['beverage', 'restaurant'], ['coffee', 'restaurant'],
  ['brewery', 'restaurant'], ['wine', 'restaurant'], ['spirits', 'restaurant'],
  ['bank', 'banking'], ['banc', 'banking'], ['savings', 'banking'],
  ['insurance', 'insurance'], ['reinsurance', 'insurance'], ['casualty', 'insurance'], ['annuity', 'insurance'],
  ['real estate', 'reit'], ['reit', 'reit'], ['property', 'reit'], ['realty', 'reit'],
  ['oil', 'oilgas'], ['gas', 'oilgas'], ['petroleum', 'oilgas'], ['energy', 'oilgas'], ['drilling', 'oilgas'],
  ['solar', 'renewable'], ['wind', 'renewable'], ['renewable', 'renewable'], ['utility', 'renewable'],
  ['electric', 'renewable'], ['hydro', 'renewable'],
  ['chemical', 'chemical'], ['chem', 'chemical'], ['materials', 'chemical'], ['polymers', 'chemical'],
  ['mining', 'mining'], ['gold', 'mining'], ['silver', 'mining'], ['copper', 'mining'], ['steel', 'mining'],
  ['metal', 'mining'], ['lithium', 'mining'], ['mineral', 'mining'], ['coal', 'mining'], ['uranium', 'mining'],
  ['motor', 'auto'], ['automotive', 'auto'], ['vehicle', 'auto'], ['motor vehicle', 'auto'], ['electric vehicle', 'auto'], ['automobile', 'auto'], ['truck', 'auto'],
  ['electric vehicle', 'auto'], ['automobile', 'auto'],
  ['aerospace', 'aerospace'], ['defense', 'aerospace'], ['aircraft', 'aerospace'], ['aviation', 'aerospace'],
  ['space', 'aerospace'], ['rocket', 'aerospace'], ['military', 'aerospace'], ['drone', 'aerospace'], ['missile', 'aerospace'],
  ['rail', 'transport'], ['logistics', 'transport'], ['shipping', 'transport'], ['freight', 'transport'],
  ['transport', 'transport'], ['trucking', 'transport'], ['cargo', 'transport'], ['marine', 'transport'], ['courier', 'transport'],
  ['retail', 'retail'], ['store', 'retail'], ['shop', 'retail'], ['consumer', 'retail'], ['apparel', 'retail'],
  ['clothing', 'retail'], ['luxury', 'retail'], ['fashion', 'retail'], ['brand', 'retail'], ['merchandis', 'retail'],
  ['manufactur', 'manufacturing'], ['industrial', 'manufacturing'], ['machinery', 'manufacturing'],
  ['equipment', 'manufacturing'], ['products', 'manufacturing'], ['tools', 'manufacturing'], ['fabricat', 'manufacturing'],
  ['construction', 'construction'], ['build', 'construction'], ['concrete', 'construction'], ['cement', 'construction'],
  ['media', 'media'], ['entertainment', 'media'], ['broadcast', 'media'], ['film', 'media'], ['music', 'media'],
  ['game', 'media'], ['studio', 'media'], ['publishing', 'media'], ['streaming', 'media'], ['television', 'media'], ['sports', 'media'],
  ['education', 'education'], ['school', 'education'], ['learning', 'education'], ['academy', 'education'], ['university', 'education'], ['teach', 'education'],
  ['hotel', 'travel'], ['resort', 'travel'], ['travel', 'travel'], ['leisure', 'travel'], ['casino', 'travel'], ['cruise', 'travel'], ['vacation', 'travel'],
  ['advertising', 'advertising'], ['marketing', 'advertising'], ['adtech', 'advertising'],
  ['staffing', 'hr'], ['workforce', 'hr'], ['payroll', 'hr'],
  // 泛化词（tech/services/financial/asset 等）已移除，避免覆盖 SIC 精确分类；兜底由 SIC 范围与名称关键词负责
  ['ecommerce', 'ecommerce'], ['e-commerce', 'ecommerce'], ['marketplace', 'ecommerce'], ['digital commerce', 'ecommerce'],
  ['artificial intelligence', 'ai'], ['robotics', 'ai'], ['machine learning', 'ai'], ['cognitive', 'ai'],
  ['telecom', 'telecom'], ['telecommunication', 'telecom'], ['communication', 'telecom'], ['wireless', 'telecom'], ['broadband', 'telecom'], ['cable', 'telecom'],
];
// 公司名关键词（最后兜底，原 TAXONOMY 逻辑）
const NAME_KW = [
  ['semiconductor', 'semiconductor', ['semiconductor', 'semicon', 'microchip', 'integrated circuit', 'silicon']],
  ['biotech', 'biotech', ['biotech', 'bio-', 'bioscience', 'therapeutics', 'genomic', 'genetics', 'biopharma', 'cell therapy', 'gene', 'antibodies']],
  ['pharma', 'pharma', ['pharma', 'pharmaceutical', 'medicines', 'medicine', 'life science']],
  ['meddevice', 'meddevice', ['medical device', 'surgical', 'medtech', 'diagnostics', 'diagnostic']],
  ['healthcare', 'healthcare', ['health', 'healthcare', 'medical', 'clinic', 'hospital', 'care ', 'wellness', 'patient']],
  ['software', 'software', ['software', 'saas', 'platform software']],
  ['ai', 'ai', ['artificial intelligence', 'robotics', 'machine learning', 'ai corp', 'cognitive']],
  ['internet', 'internet', ['internet', 'online', 'social', '.com', 'web ', 'web3', 'networks', 'digital', 'cyber']],
  ['ecommerce', 'ecommerce', ['ecommerce', 'e-commerce', 'marketplace', 'online retail', 'digital commerce']],
  ['telecom', 'telecom', ['telecom', 'telecommunication', 'communication', 'wireless', 'mobile', 'cellular', 'broadband', 'cable ']],
  ['banking', 'banking', ['bank', 'banco', 'banc', 'bancorp', 'bancorporation', 'savings', 'trust co', 'trust company', 'national association']],
  ['insurance', 'insurance', ['insurance', 'assurance', 'reinsurance', 'casualty', ' life ', 'annuity', 'mutual insurance']],
  ['asset', 'asset', ['capital', 'partners', 'asset management', 'investment', 'holdings', 'acquisition', 'acquirer', 'spac', 'blank check', 'growth corp', 'opportunities', 'enterprises']],
  ['reit', 'reit', ['reit', 'realty', 'properties', 'property', 'real estate', 'apartments', 'residential', 'mortgage reit', 'lodging', 'prologis', 'land trust', 'centers ']],
  ['oilgas', 'oilgas', ['oil', 'gas ', 'petroleum', 'petro', 'energy', 'drilling', 'exploration', 'fuel', 'refining', 'pipeline', ' lng', 'natural gas']],
  ['renewable', 'renewable', ['solar', 'wind', 'renewable', 'utility', ' electric', 'power', 'hydro', 'clean energy', 'geothermal']],
  ['chemical', 'chemical', ['chemical', 'chem ', 'materials', 'polymers', 'resin', 'specialty materials', 'coatings']],
  ['mining', 'mining', ['mining', 'gold', 'silver', 'copper', 'steel', 'metals', 'ore', 'lithium', 'mineral', 'coal', 'uranium', 'resources']],
  ['auto', 'auto', ['motor', 'automotive', 'auto ', ' car ', 'vehicle', 'truck', 'electric vehicle', 'ev ']],
  ['aerospace', 'aerospace', ['aerospace', 'defense', 'defence', 'aviation', 'aircraft', 'airline', 'flight', 'space', 'rocket', 'military', 'drone', 'missile']],
  ['transport', 'transport', ['rail', 'logistics', 'shipping', 'freight', 'transport', 'trucking', 'delivery', 'courier', 'cargo', 'marine', 'navigat', 'port']],
  ['restaurant', 'restaurant', ['restaurant', 'food', 'beverage', 'coffee', 'dining', 'eat ', 'snack', 'brewery', 'wine', 'spirits', 'beverage']],
  ['retail', 'retail', ['retail', 'store', 'shop', 'consumer', 'goods', 'apparel', 'clothing', 'luxury', 'fashion', 'wear', 'merchandis', 'brand']],
  ['manufacturing', 'manufacturing', ['manufactur', 'industrial', 'industrials', 'industrials', 'products', 'machinery', 'equipment', 'tools', 'factory', 'fabricat']],
  ['construction', 'construction', ['construction', 'build', 'engineering', 'infrastructure', 'concrete', 'cement', 'contractor']],
  ['media', 'media', ['media', 'entertainment', 'broadcast', 'film', 'music', 'game', 'gaming', 'studio', 'publishing', 'news', 'sports', 'streaming', 'television']],
  ['education', 'education', ['education', 'school', 'learning', 'academy', 'university', 'teach', 'training']],
  ['travel', 'travel', ['hotel', 'resort', 'travel', 'leisure', 'lodging', 'casino', 'cruise', 'vacation', 'gaming']],
  ['advertising', 'advertising', ['advertising', 'marketing', 'agency', 'adtech']],
  ['hr', 'hr', ['staffing', 'workforce', 'payroll', 'hr ']],
  ['services', 'services', ['services', 'solutions', 'consulting', 'business services', 'outsourcing']],
  ['tech', 'tech', ['technologies', 'technology', 'tech ', 'techcorp', 'systems', 'labs']],
  ['financial', 'financial', ['financial', 'finance', 'financials', 'financier']],
];

function classifySic(sic) {
  if (!sic) return null;
  const s = String(sic);
  if (EXACT[s]) return EXACT[s];
  if (s.length >= 3 && EXACT[s.slice(0, 3)]) return EXACT[s.slice(0, 3)];
  if (s.length >= 2 && RANGE[s.slice(0, 2)]) return RANGE[s.slice(0, 2)];
  return null;
}
function classifyDesc(desc) {
  for (const [kw, id] of DESC_KW) if (desc.includes(kw)) return id;
  return null;
}
function classifyName(name) {
  const lower = name.toLowerCase();
  for (const [, id, kws] of NAME_KW) for (const kw of kws) if (lower.includes(kw)) return id;
  return null;
}

// 泛化业务词（仅作最后兜底，弱于 SIC，避免覆盖精确分类）
const DESC_GENERIC = [
  ['technologies', 'tech'], ['technology', 'tech'], ['tech', 'tech'], ['systems', 'tech'], ['labs', 'tech'],
  ['services', 'services'], ['solutions', 'services'], ['consulting', 'services'], ['business services', 'services'], ['outsourcing', 'services'],
  ['financial', 'financial'], ['finance', 'financial'],
  ['capital', 'asset'], ['partners', 'asset'], ['asset management', 'asset'], ['investment', 'asset'],
  ['holdings', 'asset'], ['acquisition', 'asset'], ['spac', 'asset'], ['blank check', 'asset'],
  ['growth', 'asset'], ['enterprises', 'asset'], ['trusts', 'asset'],
];
function classifyDescGeneric(desc) {
  for (const [kw, id] of DESC_GENERIC) if (desc.includes(kw)) return id;
  return null;
}

const buckets = {}; TAX.forEach(([id]) => (buckets[id] = []));
const counts = {}; TAX.forEach(([id]) => (counts[id] = 0));
let noSic = 0;

for (const cat of comp.categories) {
  for (const c of cat.companies) {
    const info = cache[c.ticker] || {};
    const sic = info.sic || null;
    const desc = (info.sicDescription || '').toLowerCase();
    if (!info.ok || (!sic && !desc)) noSic++;
    let id = SECTOR_OVERRIDE[c.ticker] || classifyDesc(desc) || classifySic(sic) || classifyDescGeneric(desc) || classifyName(c.name) || 'other';
    counts[id]++;
    const feat = FEATURED[c.ticker];
    const catName = taxName[id] || '其他综合';
    const intro = feat
      ? feat.intro
      : `${c.exchange}上市公司，主营【${catName}】${info.sicDescription ? `；SEC 登记业务：${info.sicDescription}` : ''}。`;
    const entry = {
      ticker: c.ticker,
      name: c.name,
      sector: catName,
      exchange: c.exchange,
      intro,
      website: feat ? feat.website : `https://finance.yahoo.com/quote/${encodeURIComponent(c.ticker)}`,
      featured: feat ? true : false,
    };
    buckets[id].push(entry);
  }
}

for (const id of Object.keys(buckets)) buckets[id].sort((a, b) => a.ticker.localeCompare(b.ticker));
const categories = TAX.map(([id, name]) => ({ id, name, companies: buckets[id] })).filter((c) => c.companies.length > 0);
const total = categories.reduce((s, c) => s + c.companies.length, 0);

const out = {
  meta: {
    title: comp.meta.title,
    description: comp.meta.description,
    updated: new Date().toISOString().slice(0, 10),
    source: comp.meta.source,
    total,
    generatedBy: '基于 SEC EDGAR 主营业务（sic 行业代码 + sicDescription 业务描述）分类，辅以公司名关键词兜底；知名公司保留官方站点与真实简介，其余跳转 Yahoo Finance 行情页。',
  },
  categories,
};
fs.writeFileSync(path.join(ROOT, 'companies.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('=== 重新分类完成，公司总数', total, '| 无 SIC/业务描述:', noSic, '===');
TAX.forEach(([id, name]) => {
  const pct = ((counts[id] / total) * 100).toFixed(1);
  console.log(`  ${name.padEnd(10, '　')} ${String(counts[id]).padStart(5)}  (${pct}%)`);
});
