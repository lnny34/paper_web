# Paper Intelligence Hub

自动论文库，面向推荐系统、搜索广告、大模型和 LLM x 推荐广告方向。默认拉取 `2023-01-01` 至今的数据，并生成时间线、主题趋势、论文拆解、复现代码骨架和导出文件。

## 快速开始

```bash
npm install
npm run fetch:papers
npm run dev
```

访问 Vite 输出的本地地址即可查看网页。

## 主要功能

- 全量抓取：OpenAlex、arXiv API、Semantic Scholar API 三源合并，覆盖 `2023-01-01` 至今。
- 年份回填：全量模式会按年份窗口抓取，避免热门方向只保留最新年份。
- 分桶保底：输出层按 `年份 x 方向` 先保留高质量论文，再按质量补齐，避免 2026 新论文挤掉 2023-2025。
- 增量更新：`npm run fetch:incremental` 会读取现有 `public/data/papers.json`，只抓最近窗口并合并去重。
- 主题与趋势：自动归类到 LLM 推荐、生成式推荐、CTR/CVR、拍卖出价、RAG/智能体、对齐、多模态等主题。
- 论文拆解：为每篇论文生成问题、方法、贡献、实验检查、质量分、复现路径和关键代码骨架。
- 本地工作流：网页支持收藏、待读、在读、已读、复现等状态，状态保存在浏览器本地。
- 导出：生成 `public/data/exports/papers.csv`、`papers.bib`、`weekly.md`。

## 自动更新

本地常驻运行：

```bash
npm run dev:all
```

`schedule:papers` 默认在 `Asia/Shanghai` 时区每天 08:00 拉取一次，也会在启动时立即拉取一次。可以通过环境变量调整：

```bash
PAPER_DAILY_CRON="30 9 * * *" PAPER_TIMEZONE="Asia/Shanghai" npm run dev:all
```

增量刷新：

```bash
npm run fetch:incremental
```

年份回填：

```bash
npm run fetch:backfill
```

只补 arXiv 或 Semantic Scholar：

```bash
npm run fetch:arxiv
npm run fetch:s2
```

全量采集参数：

```bash
PAPER_START_DATE="2023-01-01" PAPER_TOTAL_LIMIT=12000 npm run fetch:papers
```

只想刷新派生字段和导出文件，不重新请求网络：

```bash
npm run augment:data
```

如果部署到 GitHub，可以用 `gh-pages` 分支发布静态网页；每日线上自动构建需要仓库启用 GitHub Actions workflow。

## 公网部署

发布步骤：

```bash
git add paper-intelligence-hub
git commit -m "feat: add paper intelligence hub"
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
npm run build
git subtree push --prefix paper-intelligence-hub/dist origin gh-pages
```

然后在 GitHub 仓库里打开 `Settings -> Pages`，把 `Build and deployment` 的 `Source` 设为 `Deploy from a branch`，分支选 `gh-pages`，目录选 `/root`。

## 数据来源

- OpenAlex API
- arXiv API
- Semantic Scholar Graph API
- 输出文件：`public/data/papers.json`
- 导出文件：`public/data/exports/*`
- 拉取脚本：`scripts/fetch-papers.mjs`

论文拆解和关键代码是基于标题、摘要与方向关键词生成的工程化初筛结果，适合用来决定是否阅读全文和复现实验。
