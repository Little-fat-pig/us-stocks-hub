# 美股上市公司分类导航

按行业 / 业务分类的美股上市公司目录：一句话简介 + 官网跳转。
一份数据源（companies.json），两种出口——人类看的网页 + AI 读的 llms.txt。

## 文件结构

- `companies.json` — 机器可读数据源（唯一事实来源）
- `index.html` — 人类浏览页（运行时读取 companies.json 渲染）
- `style.css` — 页面样式
- `llms.txt` — 给 AI agent 的索引说明

## 本地预览

因浏览器安全策略，直接双击 index.html 读不到 json。请用本地服务器：

```bash
cd us-stocks-hub
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（如 `us-stocks-hub`），把本目录文件推上去
2. 仓库 Settings → Pages → Source 选 `main` 分支根目录 → Save
3. 等待约 1 分钟，访问 `https://<你的用户名>.github.io/us-stocks-hub/`

## 扩展

往 `companies.json` 的对应分类里加对象即可，网页与 llms.txt 自动同步。
