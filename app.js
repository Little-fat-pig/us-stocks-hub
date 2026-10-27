'use strict';

const PAGE_SIZE = 60;
const DATA_FILE = './companies.json';

// 界面文案（单一英文，无语言切换）
const STR = {
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
  noteAbout: 'All US-listed operating companies (NYSE / NASDAQ / AMEX), grouped by primary business. ETFs, ETNs, bonds, warrants, preferred shares and closed-end funds are excluded. Descriptions are the companies\' official business summaries.',
  emp: '{n} employees',
  ipoYear: 'IPO {y}',
  metaLine: 'Source: {source}<br />Updated: {updated}',
  loadFail: 'Failed to load companies.json: {msg}. Please open this page via GitHub Pages or a local server.',
};

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
};

function catName(id, fallback) {
  const c = state.catIndex[id];
  return (c && c.name) || fallback || id;
}
function t(key, vars) {
  let s = STR[key] || key;
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
    els.grid.innerHTML = `<p class="err">${t('loadFail', { msg: esc(e.message) })}</p>`;
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
  els.totalMeta.textContent = `${t('unitCompanies', { n: state.all.length })} · ${t('unitCategories', { n: state.data.categories.length })}`;
  els.footer.innerHTML = t('metaLine', { source: esc(m.source || ''), updated: esc(m.updated || '') });
  state.current = catFromHash();
}

function renderSidebar() {
  const frag = document.createDocumentFragment();
  frag.appendChild(makeCat('all', t('allCompanies'), state.all.length));
  for (const c of state.data.categories) frag.appendChild(makeCat(c.id, c.name, c.companies.length));
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
  els.catTitle.textContent = cat ? cat.name : t('allCompanies');
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
  const bits = [c.exchange];
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

// 事件
els.more.addEventListener('click', () => appendCards(currentList()));
els.search.addEventListener('input', (e) => { state.search = e.target.value; render(); });

loadData();
