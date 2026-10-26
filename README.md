# 美股上市公司分类导航

按**细分行业**分类的**美股全部上市公司**目录：左侧全部分类导航，右侧卡片展示，可跳转官网或行情页。一份数据源（companies.json），两种出口——人类看的网页 + AI 读的 llms.txt。

## 数据规模

- **全量上市运营公司**：约 5,653 家（数据更新时点数，随源变动）
- **细分分类**：33 个行业品类
- 数据来源：NASDAQ Trader 上市清单（nasdaqlisted + otherlisted）合并 SEC EDGAR，去重后排除 ETF、测试股、优先股/权证/单位/票据等非普通运营公司证券

## 文件结构

- `companies.json` — 机器可读数据源（唯一事实来源，由 `build/build.js` 生成）
- `index.html` / `style.css` / `app.js` — 人类浏览页（左侧分类栏 + 右侧卡片 + 搜索 + 分页）
- `llms.txt` — 给 AI agent 的索引说明
- `build/` — 原始数据下载与生成脚本（可复现）

## 分类与链接策略（重要说明）

- **分类方式**：基于公司证券名称的**关键词启发式**归类（半导体、银行、生物科技、油气、房地产 REIT、餐饮……）。**未接入逐家真实 GICS 行业数据**，因此名称中无行业特征的公司归入「其他综合」兜底分类（约 2,500 家）。分类仅供参考。
- **链接策略**：
  - 知名公司（约 30 家）保留**真实官方网站**与人工撰写的简介；
  - 其余公司统一跳转该股票在 **Yahoo Finance 的行情页**（`finance.yahoo.com/quote/<代码>`），保证每个链接都存在且信息真实，简介为规则生成的简短说明。
- 官网 / 行业归属以各公司正式披露为准，本目录不对其准确性作担保。

## 本地预览

因浏览器安全策略，直接双击 index.html 读不到 json，请用本地服务器：

```bash
cd us-stocks-hub
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 重新生成数据

```bash
cd us-stocks-hub/build
curl -A "Mozilla/5.0" -o sec_tickers.json "https://www.sec.gov/files/company_tickers.json"
curl -o nasdaqlisted.txt "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
curl -o otherlisted.txt "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
node build.js
```

## 部署

已上线 GitHub Pages：`https://little-fat-pig.github.io/us-stocks-hub/`
