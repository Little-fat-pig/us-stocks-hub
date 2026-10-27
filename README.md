# 美股上市公司分类导航

把美国三大交易所（NYSE / NASDAQ / AMEX）的上市公司，按**主营业务**归成 30 多个行业品类，做成一个可以按分类浏览、按名字/代码搜索、一键直达官网的静态目录。

一份数据（`companies.json`），两种出口：人看的网页 + AI 读的 `llms.txt`。

线上地址：<https://little-fat-pig.github.io/us-stocks-hub/>

## 数据规模

| 项目 | 数值 |
| --- | --- |
| 上市公司 | 5,264 家（运营公司，不含 ETF/ETN/基金） |
| 行业分类 | 32 个品类 |
| 官网直链 | 4,994 家（94.9%）；其余退至资料页或 SEC 备案页 |
| 业务描述 | 5,253 家逐家真实业务摘要（英文原文） |

数据源：

1. **NASDAQ Trader** 官方上市清单（`nasdaqlisted.txt` + `otherlisted.txt`）—— 确定"谁在上市"
2. **SEC EDGAR**（`company_tickers.json`）—— 提供 CIK，用于兜底链接到官方备案页
3. **StockAnalysis** 公司资料页 —— 提供现代行业分类（Sector / Industry）、官方网站、员工数、上市年份、官方业务描述

## 文件结构

```
companies.json          唯一事实来源（网页与 AI 共用）
index.html / style.css / app.js   浏览页
llms.txt                给 AI agent 的索引说明
build/                  采集与生成脚本（可复现）
```

## 分类与链接策略

- **分类依据**：以现代行业分类（Sector → Industry）为准，映射到本站 32 个中文品类；行业信息缺失时用公司名关键词兜底；两者都没有才归入「其他」（占比很低）。
- **非普通股剔除**：ETF、ETN、企业债、权证、优先股，以及封闭式基金等非运营实体一律剔除，只保留普通股运营公司。这类证券多以 `$` 后缀或 `FUND/TRUST` 命名标记（如 `TRTN$A`、`MER$K`、`Invesco Senior Income Trust`），已单独识别。
- **链接优先级**：
  1. 公司**官方网站**（首选，标注「访问官网」）
  2. 无官网则退至该公司的 **SEC 备案页**（标注「SEC 备案」，任何美股公司都有）
- **业务描述**：直接采用数据源提供的官方业务摘要原文（英文），不做二次改写，避免失真。
- 分类与链接均转载自公开数据源，仅供检索参考，不构成投资建议。

## 本地预览

浏览器出于安全策略不允许 `file://` 读取 json，需起本地服务：

```bash
cd us-stocks-hub
python -m http.server 8080
# 打开 http://localhost:8080
```

## 重新生成数据

```bash
cd us-stocks-hub

# 1) 下载上市清单与 SEC 代码表
curl -A "Mozilla/5.0" -o build/sec_tickers.json "https://www.sec.gov/files/company_tickers.json"
curl -o build/nasdaqlisted.txt "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
curl -o build/otherlisted.txt "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"

# 2) 合并清单，生成基础 companies.json（代码 / 名称 / 交易所）
node build/build.js

# 3) 逐家抓取行业、官网、业务描述（带断点续传，中断后重跑会自动续抓）
python build/fetch_profiles.py

# 4) 按现代行业分类重建，并剔除非普通股与基金
python build/rebuild_us.py

# 5) 数据体检
python build/verify.py
```

## 界面功能

- 左侧贴边行业分类栏（含每家数量），点击筛选，URL 带 `#/分类id` 可直接分享（如 `#/banking`）
- 顶部搜索：公司名 / 股票代码
- 中英切换：界面文案、分类名、交易所名全部双语；也可用 `?lang=en` 直接进英文版
- 每张卡片：一键「访问官网」+「复制官网」链接
- 分页加载（每次 60 家），避免一次性渲染数千张卡片卡顿

## 部署

GitHub Pages，主分支根目录直接发布。
