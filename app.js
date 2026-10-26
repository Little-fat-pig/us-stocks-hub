'use strict';

const PAGE_SIZE = 60;

const state = {
  data: null,
  all: [],            // 扁平化全部公司
  catIndex: {},       // id -> 分类对象
  current: 'all',     // 'all' 或分类 id
  search: '',
  rendered: 0,        // 当前已渲染数量
};

const els = {
  sidebar: document.getElementById('sidebar'),
  grid: document.getElementById('grid'),
  more: document.getElementById('more'),
  catTitle: document.getElementById('catTitle'),
  catSub: document.getElementById('catSub'),
  note: document.getElementById('note'),
  search: document.getElementById('search'),
  totalMeta: document.getElementById('totalMeta'),
  footer: document.getElementById('footer'),
};

// ---------- 加载数据 ----------
async function load() {
  try {
    const res = await fetch('./companies.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.data = await res.json();
    prepare();
    renderSidebar();
    render();
  } catch (e) {
    els.grid.innerHTML = '<p style="color:#C42819;padding:20px">无法加载 companies.json：' + e.message +
      '。请通过 GitHub Pages 或本地服务器访问（直接双击打开文件会因浏览器安全策略读不到数据）。</p>';
  }
}

function prepare() {
  state.all = [];
  state.catIndex = {};
  for (const c of state.data.categories) {
    state.catIndex[c.id] = c;
    for (const co of c.companies) {
      co._cat = c.name;
      state.all.push(co);
    }
  }
  const m = state.data.meta || {};
  els.totalMeta.textContent = `共 ${m.total || state.all.length} 家 · ${state.data.categories.length} 个分类`;
  els.footer.innerHTML = `数据来源：${m.source || '公开上市清单'} ｜ 更新：${m.updated || ''} ｜ ` +
    `分类为名称关键词启发式，仅供参考，官网以各公司公布为准。`;
}

// ---------- 左侧分类栏 ----------
function renderSidebar() {
  const frag = document.createDocumentFragment();
  const total = state.all.length;

  frag.appendChild(makeCat('all', '全部公司', total, true));

  for (const c of state.data.categories) {
    frag.appendChild(makeCat(c.id, c.name, c.companies.length, false));
  }
  els.sidebar.appendChild(frag);
}

function makeCat(id, name, count, isAll) {
  const div = document.createElement('div');
  div.className = 'cat' + (id === state.current ? ' active' : '');
  div.dataset.id = id;
  div.innerHTML = `<span>${name}</span><span class="cnt">${count}</span>`;
  div.addEventListener('click', () => {
    state.current = id;
    state.search = '';
    els.search.value = '';
    document.querySelectorAll('.cat').forEach(e => e.classList.remove('active'));
    div.classList.add('active');
    render();
  });
  return div;
}

// ---------- 过滤 + 渲染卡片 ----------
function currentList() {
  let list = state.current === 'all' ? state.all.slice() : (state.catIndex[state.current].companies.slice());
  const q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter(c =>
      c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }
  return list;
}

function render() {
  const list = currentList();
  const cat = state.current === 'all' ? null : state.catIndex[state.current];
  els.catTitle.textContent = cat ? cat.name : '全部公司';
  const scope = cat ? `${cat.companies.length} 家` : `${state.all.length} 家`;
  els.catSub.textContent = state.search
    ? `匹配 ${list.length} 家`
    : `共 ${scope}`;

  // 说明文案
  if (state.current === 'other') {
    els.note.style.display = '';
    els.note.textContent = '「其他综合」：公司名称中未出现明显行业关键词、无法自动归类的企业。本目录依据公司名称关键词进行启发式分类，未接入逐家行业数据，故存在此兜底分类。';
  } else if (state.search) {
    els.note.style.display = '';
    els.note.textContent = `正在搜索「${state.search}」，跨全部分类匹配。`;
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
  for (const c of slice) {
    frag.appendChild(makeCard(c));
  }
  els.grid.appendChild(frag);
  state.rendered += slice.length;

  if (state.rendered < list.length) {
    els.more.hidden = false;
    els.more.textContent = `加载更多（还剩 ${list.length - state.rendered} 家）`;
  } else {
    els.more.hidden = true;
  }
}

function makeCard(c) {
  const a = document.createElement('article');
  a.className = 'card';
  const btnLabel = c.featured ? '访问官网 ↗' : '了解更多 ↗';
  const exHot = c.featured ? '<span class="hot">★ 知名</span> ' : '';
  a.innerHTML = `
    <div class="top">
      <span class="ticker">${escapeHtml(c.ticker)}</span>
      <span class="tag">${escapeHtml(c._cat || c.sector)}</span>
    </div>
    <h3 class="cname">${escapeHtml(c.name)}</h3>
    <div class="ex">${exHot}${escapeHtml(c.exchange)}</div>
    <p class="intro">${escapeHtml(c.intro)}</p>
    <a class="btn" href="${encodeURI(c.website)}" target="_blank" rel="noopener">${btnLabel}</a>
  `;
  return a;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

// ---------- 事件 ----------
els.more.addEventListener('click', () => appendCards(currentList()));
els.search.addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});

load();
