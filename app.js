'use strict';

const PAGE_SIZE = 60;
const DATA_FILE = './companies.json';

// 分类中英文映射（id -> {zh, en}）
const CATEGORY_I18N = {
  semiconductor: { zh: '半导体与芯片', en: 'Semiconductors & Chips' },
  hardware: { zh: '电子与硬件设备', en: 'Electronics & Hardware' },
  biotech: { zh: '生物科技', en: 'Biotechnology' },
  pharma: { zh: '制药', en: 'Pharmaceuticals' },
  meddevice: { zh: '医疗器械', en: 'Medical Devices' },
  healthcare: { zh: '医疗健康服务', en: 'Healthcare Services' },
  software: { zh: '软件与 SaaS', en: 'Software & SaaS' },
  internet: { zh: '互联网与平台', en: 'Internet & Platforms' },
  ecommerce: { zh: '电商与数字零售', en: 'E-commerce & Digital Retail' },
  telecom: { zh: '电信与通信', en: 'Telecom & Communications' },
  banking: { zh: '银行', en: 'Banks' },
  insurance: { zh: '保险', en: 'Insurance' },
  asset: { zh: '资管·私募·SPAC', en: 'Asset Mgmt · PE/VC · SPAC' },
  financial: { zh: '金融综合服务', en: 'Financial Services' },
  reit: { zh: '房地产与 REIT', en: 'Real Estate & REITs' },
  oilgas: { zh: '油气与能源', en: 'Oil, Gas & Energy' },
  renewable: { zh: '新能源与公用事业', en: 'Renewables & Utilities' },
  chemical: { zh: '化工与材料', en: 'Chemicals & Materials' },
  mining: { zh: '金属与采矿', en: 'Metals & Mining' },
  auto: { zh: '汽车与零部件', en: 'Autos & Parts' },
  aerospace: { zh: '航空航天与国防', en: 'Aerospace & Defense' },
  transport: { zh: '运输·物流·航运', en: 'Transport · Logistics · Shipping' },
  restaurant: { zh: '食品饮料与餐饮', en: 'Food, Beverage & Restaurants' },
  retail: { zh: '零售与消费品牌', en: 'Retail & Consumer Brands' },
  manufacturing: { zh: '工业与机械制造', en: 'Industrial & Machinery' },
  construction: { zh: '建筑与工程', en: 'Construction & Engineering' },
  media: { zh: '媒体与娱乐', en: 'Media & Entertainment' },
  education: { zh: '教育', en: 'Education' },
  travel: { zh: '旅游·酒店·博彩', en: 'Travel · Hotels · Gaming' },
  advertising: { zh: '广告与营销', en: 'Advertising & Marketing' },
  hr: { zh: '人力资源与商业服务', en: 'HR & Business Services' },
  other: { zh: '其他', en: 'Other' },
};

// 交易所中英文映射
const EXCHANGE_EN = { '纳斯达克': 'NASDAQ', '纽交所': 'NYSE', '美交所': 'AMEX', '场外': 'OTC', 'OTC': 'OTC' };

const I18N = {
  zh: {
    title: '美股上市公司分类导航',
    searchPlaceholder: '搜索公司名 / 股票代码…',
    allCategories: '全部分类',
    allCompanies: '全部公司',
    loading: '加载中…',
    copy: '复制官网',
    copied: '已复制 ✓',
    visitSite: '访问官网 ↗',
    quote: '行情页 ↗',
    filing: 'SEC 备案 ↗',
    featured: '★ 知名',
    noSite: '官网缺失',
    noIntro: '暂无业务描述',
    unitCompanies: '{n} 家',
    unitCategories: '{n} 类',
    matches: '{n} 条匹配',
    loadMore: '加载更多（剩 {n}）',
    noteOther: '「其他」：暂无可用的行业分类信息的企业。',
    noteSearch: '正在全部分类中匹配。',
    noteAbout: '全部美股上市公司（NYSE / NASDAQ / AMEX），按主营业务分类。已剔除 ETF、ETN、权证、优先股等非普通股。简介为该公司官方业务描述原文（英文）。',
    emp: '员工 {n} 人',
    ipoYear: '{y} 年上市',
    metaLine: '数据来源：{source}<br />最近更新：{updated}',
  },
  en: {
    title: 'US Listed Companies Navigator',
    searchPlaceholder: 'Search company or ticker…',
    allCategories: 'All Categories',
    allCompanies: 'All Companies',
    loading: 'Loading…',
    copy: 'Copy Site',
    copied: 'Copied ✓',
    visitSite: 'Visit Site ↗',
    quote: 'Quote ↗',
    filing: 'SEC Filing ↗',
    featured: '★ Featured',
    noSite: 'No site',
    noIntro: 'No description available',
    unitCompanies: '{n} companies',
    unitCategories: '{n} categories',
    matches: '{n} matches',
    loadMore: 'Load more ({n} left)',
    noteOther: '"Other": companies without usable industry classification.',
    noteSearch: 'Matching across all categories.',
    noteAbout: 'All US-listed operating companies (NYSE / NASDAQ / AMEX), grouped by primary business. ETFs, ETNs, warrants and preferred shares are excluded. Descriptions are the companies\' official business summaries.',
    emp: '{n} employees',
    ipoYear: 'IPO {y}',
    metaLine: 'Source: {source}<br />Updated: {updated}',
  },
};

let lang = /[?&]lang=en\b/i.test(location.search) ? 'en' : 'zh';

const state = {
  data: null,
  all: [],
  catIndex: {},
  current: 'all',
  search: '',
  rendered: 0,
};

const els = {
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
function exName(x) { return lang === 'zh' ? (x || '') : (EXCHANGE_EN[x] || x || ''); }
function t(key, vars) {
  let s = (I18N[lang] && I18N[lang][key]) || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function loadData() {
  els.grid.innerHTML = `<p class="pending">${t('loading')}</p>`;
  try {
    const res = await fetch(DATA_FILE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.data = await res.json();
  } catch (e) {
    els.grid.innerHTML = '<p class="err">无法加载 companies.json：' + esc(e.message) + '。请通过 GitHub Pages 或本地服务器访问。</p>';
    return;
  }
  prepare();
  renderSidebar();
  render();
  applyLang();
}

function prepare() {
  state.all = [];
  state.catIndex = {};
  for (const c of state.data.categories) {
    state.catIndex[c.id] = c;
    for (const co of c.companies) { co._cat = c.id; state.all.push(co); }
  }
  const m = state.data.meta || {};
  els.totalMeta.textContent = `${t('unitCompanies', { n: state.all.length })} · ${t('unitCategories', { n: state.data.categories.length })}`;
  els.footer.innerHTML = t('metaLine', { source: esc(m.source || ''), updated: esc(m.updated || '') });
  state.current = catFromHash();
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
  div.innerHTML = `<span>${esc(name)}</span><span class="cnt">${count}</span>`;
  div.addEventListener('click', () => selectCat(id));
  return div;
}

function selectCat(id, push) {
  state.current = id;
  state.search = ''; els.search.value = '';
  document.querySelectorAll('.cat').forEach(e => e.classList.toggle('active', e.dataset.id === id));
  if (push !== false) {
    const hash = id === 'all' ? '' : '#/' + id;
    if (location.hash !== hash) history.pushState(null, '', location.hash = hash || location.pathname + location.search);
  }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function catFromHash() {
  const m = location.hash.match(/^#\/([a-z0-9_-]+)$/i);
  if (m && (m[1] === 'all' || state.catIndex[m[1]])) return m[1];
  return 'all';
}

window.addEventListener('popstate', () => {
  if (!state.data) return;
  state.current = catFromHash();
  document.querySelectorAll('.cat').forEach(e => e.classList.toggle('active', e.dataset.id === state.current));
  render();
});

window.addEventListener('hashchange', () => {
  if (!state.data) return;
  const id = catFromHash();
  if (id !== state.current) {
    state.current = id;
    document.querySelectorAll('.cat').forEach(e => e.classList.toggle('active', e.dataset.id === state.current));
    render();
  }
});

function currentList() {
  let list = state.current === 'all' ? state.all.slice() : (state.catIndex[state.current] || { companies: [] }).companies.slice();
  const q = state.search.trim().toLowerCase();
  if (q) list = list.filter(c => c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  return list;
}

function render() {
  const list = currentList();
  const cat = state.current === 'all' ? null : state.catIndex[state.current];
  els.catTitle.textContent = cat ? catName(cat.id) : t('allCompanies');
  els.catSub.textContent = state.search
    ? t('matches', { n: list.length })
    : t('unitCompanies', { n: cat ? cat.companies.length : state.all.length });

  if (state.search) {
    els.note.style.display = ''; els.note.textContent = t('noteSearch');
  } else if (state.current === 'other') {
    els.note.style.display = ''; els.note.textContent = t('noteOther');
  } else {
    els.note.style.display = ''; els.note.textContent = t('noteAbout');
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
    els.more.textContent = t('loadMore', { n: list.length - state.rendered });
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
  const url = c.website || '';
  const isOfficial = c.linkType === 'official' || (!!url && !/stockanalysis\.com|finance\.yahoo\.com|sec\.gov/i.test(url));
  const linkLabel = isOfficial ? t('visitSite') : (c.linkType === 'filing' ? t('filing') : t('quote'));
  const exHot = c.featured ? `<span class="hot">${t('featured')}</span> · ` : '';
  const bits = [exName(c.exchange)];
  if (c.employees) bits.push(t('emp', { n: c.employees }));
  if (c.ipo) bits.push(t('ipoYear', { y: c.ipo }));
  const sub = bits.filter(Boolean).join(' · ');
  const intro = c.intro || '';
  const introText = intro || c.industry || t('noIntro');

  a.innerHTML = `
    <div class="top">
      <span class="ticker">${esc(c.ticker)}</span>
      <span class="tag">${esc(catName(c._cat || 'other'))}</span>
    </div>
    <h3 class="cname">${esc(c.name)}</h3>
    <div class="ex">${exHot}${esc(sub)}</div>
    <p class="intro${intro ? '' : ' empty'}">${esc(introText)}</p>
    <div class="card-actions">
      ${url
        ? `<a class="btn" href="${esc(encodeURI(url))}" target="_blank" rel="noopener">${linkLabel}</a>
           <button class="btn copy" type="button">${t('copy')}</button>`
        : `<button class="btn disabled" type="button" disabled>${t('noSite')}</button>`}
    </div>`;

  if (url) {
    a.querySelector('.copy').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      copyToClipboard(url).then((ok) => {
        if (ok) {
          btn.textContent = t('copied');
          setTimeout(() => (btn.textContent = t('copy')), 1500);
        }
      });
    });
  }
  return a;
}

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(e => (e.textContent = t(e.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach(e => (e.placeholder = t(e.dataset.i18nPh)));
  els.langBtn.textContent = lang === 'zh' ? 'EN' : '中';
  document.title = t('title');
  if (state.data) { prepare(); renderSidebar(); render(); }
}

// 事件
els.more.addEventListener('click', () => appendCards(currentList()));
els.search.addEventListener('input', (e) => { state.search = e.target.value; render(); });
els.langBtn.addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; applyLang(); });

loadData();
