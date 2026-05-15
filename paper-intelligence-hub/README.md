# Paper Intelligence Hub

自动论文库，面向推荐系统、搜索广告、大模型和 LLM x 推荐广告方向。

## 快速开始

```bash
npm install
npm run fetch:papers
npm run dev
```

访问 Vite 输出的本地地址即可查看网页。

## 自动更新

本地常驻运行：

```bash
npm run dev:all
```

`schedule:papers` 默认在 `Asia/Shanghai` 时区每天 08:00 拉取一次，也会在启动时立即拉取一次。可以通过环境变量调整：

```bash
PAPER_DAILY_CRON="30 9 * * *" PAPER_TIMEZONE="Asia/Shanghai" npm run dev:all
```

如果部署到 GitHub，可以用 `gh-pages` 分支发布静态网页；也可以在 GitHub 上手动添加 Actions workflow 实现每日自动构建。

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
- arXiv API fallback
- 输出文件：`public/data/papers.json`
- 拉取脚本：`scripts/fetch-papers.mjs`

论文拆解和关键代码是基于标题、摘要与方向关键词生成的工程化初筛结果，适合用来决定是否阅读全文和复现实验。
