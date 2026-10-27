'use strict';

const PAGE_SIZE = 60;
const MARKETS_FILE = './markets.json';

// 分类中英文映射（id -> {zh, en}）
const CATEGORY_I18N = {
  semiconductor: { zh: '半导体与芯片', en: 'Semiconductors & Chips' },
  biotech: { zh: '生物科技', en: 'Biotechnology' },
  pharma: { zh: '制药与生命科学', en: 'Pharmaceuticals & Life Sciences' },
  meddevice: { zh: '医疗器械', en: 'Medical Devices' },
  healthcare: { zh: '医疗健康服务', en: 'Healthcare Services' },
  software: { zh: '软件与 SaaS', en: 'Software & SaaS' },
  ai: { zh: '人工智能与机器人', en: 'AI & Robotics' },
  internet: { zh: '互联网与社交', en: 'Internet & Social' },
  ecommerce: { zh: '电商与数字零售', en: 'E-commerce & Digital Retail' },
  telecom: { zh: '电信与通信', en: 'Telecom & Communications' },
  banking: { zh: '银行与储蓄', en: 'Banks & Savings' },
  insurance: { zh: '保险', en: 'Insurance' },
  asset: { zh: '资管·私募·SPAC', en: 'Asset Mgmt · PE/VC · SPAC' },
  reit: { zh: '房地产与 REIT', en: 'Real Estate & REITs' },
  oilgas: { zh: '油气与能源', en: 'Oil, Gas & Energy' },
  renewable: { zh: '新能源与电力', en: 'Renewables & Utilities' },
  chemical: { zh: '化工与材料', en: 'Chemicals & Materials' },
  mining: { zh: '金属与采矿', en: 'Metals & Mining' },
  auto: { zh: '汽车与零部件', en: 'Automobiles & Parts' },
  aerospace: { zh: '航空航天与国防', en: 'Aerospace & Defense' },
  transport: { zh: '铁路·物流·海运', en: 'Rail · Logistics · Shipping' },
  restaurant: { zh: '餐饮与食品饮料', en: 'Restaurants & Food & Beverage' },
  retail: { zh: '零售与消费品牌', en: 'Retail & Consumer Brands' },
  manufacturing: { zh: '工业与制造', en: 'Industrial & Manufacturing' },
  construction: { zh: '建筑与工程', en: 'Construction & Engineering' },
  media: { zh: '媒体与娱乐', en: 'Media & Entertainment' },
  education: { zh: '教育', en: 'Education' },
  travel: { zh: '旅游·酒店·博彩', en: 'Travel · Hotels · Gaming' },
  advertising: { zh: '广告与营销', en: 'Advertising & Marketing' },
  hr: { zh: '人力资源服务', en: 'HR Services' },
  services: { zh: '商业与专业服务', en: 'Business & Professional Services' },
  tech: { zh: '科技综合', en: 'Technology (General)' },
  financial: { zh: '金融综合', en: 'Financials (General)' },
  other: { zh: '其他综合', en: 'Other' },
};

const I18N = {
  zh: {
    title: '全球股市上市公司分类导航',
    searchPlaceholder: '搜索公司名 / 股票代码…',
    allCategories: '全部分类',
    allCompanies: '全部公司',
    loading: '加载中…',
    copy: '复制链接',
    copied: '已复制 ✓',
    visitSite: '访问官网 ↗',
    learnMore: '了解更多 ↗',
    featured: '★ 知名',
    marketPending: '该市场数据整理中，敬请期待。',
    noteOther: '「其他综合」：业务描述缺失或无法按主营业务归类的企业。',
    noteSearch: '正在跨全部分类匹配。',
    noteRepresent: '本市场当前展示【代表性上市公司】（按真实主营业务分类），全量列表正在持续扩充中。',
    metaLine: '数据来源：{source} ｜ 更新：{updated}',
  },
  en: {
    title: 'Global Stock Market Company Navigator',
    searchPlaceholder: 'Search company name / ticker…',
    allCategories: 'All Categories',
    allCompanies: 'All Companies',
    loading: 'Loading…',
    copy: 'Copy Link',
    copied: 'Copied ✓',
    visitSite: 'Visit Site ↗',
    learnMore: 'Learn More ↗',
    featured: '★ Featured',
    marketPending: 'Data for this market is being prepared.',
    noteOther: '"Other": companies with missing or unclassifiable business descriptions.',
    noteSearch: 'Matching across all categories.',
    noteRepresent: 'This market currently shows a curated set of representative listed companies (classified by real business line); the full list is being expanded.',
    metaLine: 'Source: {source} ｜ Updated: {updated}',
  },
};

let lang = 'zh';

const state = {
  markets: [],
  currentMarket: null,
  data: null,
  all: [],
  catIndex: {},
  current: 'all',
  search: '',
  rendered: 0,
};

const els = {
  marketTabs: document.getElementById('marketnav'),
  catList: document.getElementById('catList'),
  grid: document.getElementById('grid'),
  more: document.getElementById('more'),
  catTitle: document.getElementById('catTitle'),
  catSub: document.getElementById('catSub'),
  note: document.getElementById('note'),
  search: document.getElementById('search'),
  totalMeta: document.getElementById('totalMeta'),
  footer: document.getElementById('footer'),
  langBtn: document.getElementById('langBtn'),
};

function catName(id) { const m = CATEGORY_I18N[id]; return m ? m[lang] : id; }
function t(key, vars) {
  let s = (I18N[lang] && I18N[lang][key]) || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function loadMarkets() {
  try {
    const res = await fetch(MARKETS_FILE, { cache: 'no-cache' });
    state.markets = (await res.json()).markets;
  } catch (e) {
    els.grid.innerHTML = '<p class="err">无法加载 markets.json：' + e.message + '</p>';
    return;
  }
  renderMarketTabs();
  const first = state.markets.find(m => m.status === 'ready') || state.markets[0];
  selectMarket(first);
}

function renderMarketTabs() {
  const box = els.marketTabs;
  box.innerHTML = '';
  for (const m of state.markets) {
    const b = document.createElement('button');
    b.className = 'market-tab' + (state.currentMarket && state.currentMarket.id === m.id ? ' active' : '');
    b.innerHTML = `<span class="flag">${m.flag}</span><span class="mlabel">${lang === 'zh' ? m.label : m.labelEn}</span>${m.status === 'pending' ? '<span class="badge">…</span>' : ''}`;
    b.addEventListener('click', () => selectMarket(m));
    box.appendChild(b);
  }
}

async function selectMarket(m) {
  state.currentMarket = m;
  renderMarketTabs();
  if (m.status !== 'ready') {
    state.data = null; state.all = []; state.catIndex = {};
    els.catList.innerHTML = '';
    els.grid.innerHTML = `<p class="pending">${t('marketPending')}</p>`;
    els.catTitle.textContent = lang === 'zh' ? m.label : m.labelEn;
    els.catSub.textContent = '';
    els.note.style.display = 'none';
    els.more.hidden = true;
    els.totalMeta.textContent = '';
    return;
  }
  els.grid.innerHTML = `<p class="pending">${t('loading')}</p>`;
  try {
    const res = await fetch('./' + m.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.data = await res.json();
  } catch (e) {
    els.grid.innerHTML = '<p class="err">无法加载 ' + m.file + '：' + e.message + '。请通过 GitHub Pages 或本地服务器访问。</p>';
    return;
  }
  prepare();
  renderSidebar();
  render();
}

function prepare() {
  state.all = [];
  state.catIndex = {};
  for (const c of state.data.categories) {
    state.catIndex[c.id] = c;
    for (const co of c.companies) { co._cat = c.id; state.all.push(co); }
  }
  const m = state.data.meta || {};
  els.totalMeta.textContent = `${state.all.length} · ${state.data.categories.length}`;
  els.footer.innerHTML = t('metaLine', { source: m.source || '', updated: m.updated || '' });
}

function renderSidebar() {
  const frag = document.createDocumentFragment();
  frag.appendChild(makeCat('all', t('allCompanies'), state.all.length));
  for (const c of state.data.categories) frag.appendChild(makeCat(c.id, catName(c.id), c.companies.length));
  els.catList.innerHTML = '';
  els.catList.appendChild(frag);
}

function makeCat(id, name, count) {
  const div = document.createElement('div');
  div.className = 'cat' + (id === state.current ? ' active' : '');
  div.dataset.id = id;
  div.innerHTML = `<span>${name}</span><span class="cnt">${count}</span>`;
  div.addEventListener('click', () => {
    state.current = id;
    state.search = ''; els.search.value = '';
    document.querySelectorAll('.cat').forEach(e => e.classList.remove('active'));
    div.classList.add('active');
    render();
  });
  return div;
}

function currentList() {
  let list = state.current === 'all' ? state.all.slice() : state.catIndex[state.current].companies.slice();
  const q = state.search.trim().toLowerCase();
  if (q) list = list.filter(c => c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  return list;
}

function render() {
  const list = currentList();
  const cat = state.current === 'all' ? null : state.catIndex[state.current];
  els.catTitle.textContent = cat ? catName(cat.id) : t('allCompanies');
  els.catSub.textContent = state.search
    ? `${list.length}`
    : (cat ? `${cat.companies.length}` : `${state.all.length}`);

  if (state.search) {
    els.note.style.display = ''; els.note.textContent = t('noteSearch');
  } else if (state.current === 'other') {
    els.note.style.display = ''; els.note.textContent = t('noteOther');
  } else if (state.currentMarket && state.currentMarket.id !== 'us') {
    els.note.style.display = ''; els.note.textContent = t('noteRepresent');
  } else {
    els.note.style.display = 'none';
  }

  state.rendered = 0;
  els.grid.innerHTML = '';
  appendCards(list);
}

function appendCards(list) {
  const slice = list.slice(state.rendered, state.rendered + PAGE_SIZE);
  const frag = document.createDocumentFragment();
  for (const c of slice) frag.appendChild(makeCard(c));
  els.grid.appendChild(frag);
  state.rendered += slice.length;
  if (state.rendered < list.length) {
    els.more.hidden = false;
    els.more.textContent = `+${list.length - state.rendered}`;
  } else {
    els.more.hidden = true;
  }
}

function copyToClipboard(text) {
  return new Promise((resolve) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => resolve(fallbackCopy(text)));
    } else {
      resolve(fallbackCopy(text));
    }
  });
}
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

function makeCard(c) {
  const a = document.createElement('article');
  a.className = 'card';
  const btnLabel = c.featured ? t('visitSite') : t('learnMore');
  const exHot = c.featured ? `<span class="hot">${t('featured')}</span> ` : '';
  const url = c.website || '#';
  a.innerHTML = `
    <div class="top">
      <span class="ticker">${esc(c.ticker)}</span>
      <span class="tag">${esc(catName(c._cat || c.sector))}</span>
    </div>
    <h3 class="cname">${esc(c.name)}</h3>
    <div class="ex">${exHot}${esc(c.exchange || '')}</div>
    <p class="intro">${esc(c.intro || '')}</p>
    <div class="card-actions">
      <a class="btn" href="${encodeURI(url)}" target="_blank" rel="noopener">${btnLabel}</a>
      <button class="btn copy" type="button" data-url="${encodeURI(url)}">${t('copy')}</button>
    </div>`;
  a.querySelector('.copy').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const target = decodeURIComponent(btn.dataset.url);
    copyToClipboard(target).then((ok) => {
      if (ok) {
        btn.textContent = t('copied');
        setTimeout(() => (btn.textContent = t('copy')), 1500);
      }
    });
  });
  return a;
}

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(e => (e.textContent = t(e.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach(e => (e.placeholder = t(e.dataset.i18nPh)));
  els.langBtn.textContent = lang === 'zh' ? 'EN' : '中';
  document.title = t('title');
  if (state.data) { renderMarketTabs(); renderSidebar(); render(); }
}

// 事件
els.more.addEventListener('click', () => appendCards(currentList()));
els.search.addEventListener('input', (e) => { state.search = e.target.value; render(); });
els.langBtn.addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; applyLang(); });

loadMarkets();
