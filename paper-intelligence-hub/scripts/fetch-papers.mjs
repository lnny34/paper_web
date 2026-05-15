import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "public", "data");
const outputFile = path.join(dataDir, "papers.json");
const exportsDir = path.join(dataDir, "exports");

const OPENALEX_ENDPOINT = "https://api.openalex.org/works";
const OPENALEX_ARXIV_SOURCE = "S4306400194";
const DEFAULT_START_DATE = "2023-01-01";
const MODE = process.env.PAPER_MODE || "full";
const INCREMENTAL_DAYS = Number(process.env.PAPER_INCREMENTAL_DAYS || 7);
let START_DATE = process.env.PAPER_START_DATE || DEFAULT_START_DATE;
const END_DATE = process.env.PAPER_END_DATE || new Date().toISOString().slice(0, 10);
const PAGE_SIZE = Number(process.env.PAPER_PAGE_SIZE || 200);
const MAX_ARXIV_PAGES_PER_QUERY = Number(process.env.PAPER_MAX_ARXIV_PAGES_PER_QUERY || 5);
const MAX_ALL_PAGES_PER_QUERY = Number(process.env.PAPER_MAX_ALL_PAGES_PER_QUERY || 2);
const HISTORICAL_ARXIV_PAGES_PER_QUERY = Number(process.env.PAPER_HISTORICAL_ARXIV_PAGES_PER_QUERY || 2);
const HISTORICAL_ALL_PAGES_PER_QUERY = Number(process.env.PAPER_HISTORICAL_ALL_PAGES_PER_QUERY || 1);
const TOTAL_LIMIT = Number(process.env.PAPER_TOTAL_LIMIT || 6000);
const PER_TRACK_LIMIT = Number(process.env.PAPER_PER_TRACK_LIMIT || TOTAL_LIMIT);
const REQUEST_DELAY_MS = Number(process.env.PAPER_REQUEST_DELAY_MS || 90);

const tracks = [
  {
    id: "recsys",
    label: "推荐系统",
    accent: "#2f7d67",
    sourceScopes: ["arxiv", "all"],
    openAlexQueries: [
      "recommender system",
      "recommender systems",
      "sequential recommendation",
      "session-based recommendation",
      "collaborative filtering",
      "graph neural recommendation",
      "learning to rank recommendation",
      "candidate generation recommendation",
      "personalized recommendation system",
      "news recommendation",
      "e-commerce recommendation",
      "generative recommendation",
    ],
  },
  {
    id: "search-ads",
    label: "搜索广告",
    accent: "#c55a2e",
    sourceScopes: ["arxiv", "all"],
    openAlexQueries: [
      "sponsored search advertising",
      "search advertising auction",
      "computational advertising",
      "online advertising auction",
      "ad ranking",
      "click through rate prediction advertising",
      "conversion rate prediction advertising",
      "real time bidding advertising",
      "auto-bidding advertising",
      "budget pacing advertising",
      "ad delivery fairness",
      "generative advertising",
    ],
  },
  {
    id: "llm",
    label: "大模型",
    accent: "#5e6ad2",
    sourceScopes: ["arxiv"],
    openAlexQueries: [
      "large language model",
      "large language models",
      "foundation model",
      "instruction tuning",
      "preference optimization alignment",
      "reinforcement learning from human feedback",
      "retrieval augmented generation",
      "long context language model",
      "multimodal large language model",
      "large language model agent",
      "efficient inference large language model",
    ],
  },
  {
    id: "llm-recsys",
    label: "LLM x 推荐广告",
    accent: "#9b6b2f",
    sourceScopes: ["arxiv", "all"],
    openAlexQueries: [
      "large language model recommendation",
      "large language model recommender system",
      "LLM recommender system",
      "generative recommendation",
      "LLM e-commerce recommendation",
      "large language model advertising",
      "LLM advertising",
      "large language model sponsored search",
      "LLM user modeling recommendation",
    ],
  },
];

const topicTaxonomy = [
  {
    id: "llm4rec",
    label: "LLM 推荐",
    accent: "#5e6ad2",
    signals: ["llm recommender", "language model recommendation", "large language model recommendation", "user modeling"],
  },
  {
    id: "generative-rec",
    label: "生成式推荐",
    accent: "#7d5cc8",
    signals: ["generative recommendation", "generative recommender", "diffusion recommendation", "generative retrieval"],
  },
  {
    id: "sequential-rec",
    label: "序列/会话推荐",
    accent: "#2f7d67",
    signals: ["sequential recommendation", "session-based", "sequence recommendation", "next item"],
  },
  {
    id: "graph-rec",
    label: "图推荐",
    accent: "#32806e",
    signals: ["graph neural", "knowledge graph", "graph recommendation", "gnn recommender"],
  },
  {
    id: "ranking-retrieval",
    label: "召回排序",
    accent: "#386f98",
    signals: ["retrieval", "ranking", "learning to rank", "rerank", "candidate generation", "two tower"],
  },
  {
    id: "ctr-cvr",
    label: "CTR/CVR 预估",
    accent: "#c55a2e",
    signals: ["ctr", "click through", "cvr", "conversion rate", "calibration"],
  },
  {
    id: "auction-bidding",
    label: "拍卖/出价/预算",
    accent: "#b45f36",
    signals: ["auction", "auto-bidding", "autobidding", "real time bidding", "budget pacing", "bid"],
  },
  {
    id: "ads-creatives",
    label: "广告生成与投放",
    accent: "#d07a34",
    signals: ["advertising", "sponsored search", "ad ranking", "generative advertising", "ad creative", "ad delivery"],
  },
  {
    id: "rag-agent",
    label: "RAG/智能体",
    accent: "#4e72c4",
    signals: ["retrieval augmented generation", "rag", "agent", "tool use", "planning"],
  },
  {
    id: "alignment",
    label: "对齐/偏好优化",
    accent: "#6f5bc2",
    signals: ["alignment", "preference optimization", "rlhf", "dpo", "human feedback", "instruction tuning"],
  },
  {
    id: "multimodal",
    label: "多模态大模型",
    accent: "#8b5ca6",
    signals: ["multimodal", "vision language", "image-text", "vlm", "video language"],
  },
  {
    id: "efficient-llm",
    label: "高效训练/推理",
    accent: "#51606d",
    signals: ["efficient inference", "quantization", "distillation", "mixture of experts", "long context", "lora"],
  },
];

const keywordSignals = [
  ["retrieval", "召回"],
  ["ranking", "排序"],
  ["rerank", "重排"],
  ["auction", "拍卖机制"],
  ["ctr", "CTR 预估"],
  ["cvr", "CVR 预估"],
  ["conversion", "转化预估"],
  ["calibration", "校准"],
  ["agent", "智能体"],
  ["rag", "RAG"],
  ["instruction", "指令微调"],
  ["alignment", "对齐"],
  ["multimodal", "多模态"],
  ["sequential", "序列建模"],
  ["graph", "图学习"],
  ["distillation", "蒸馏"],
  ["preference", "偏好建模"],
  ["auto-bidding", "自动出价"],
  ["autobidding", "自动出价"],
  ["budget", "预算控制"],
  ["long context", "长上下文"],
  ["fairness", "公平性"],
];

const trackSignals = {
  recsys: [
    "recommender system",
    "recommender systems",
    "recommendation system",
    "recommendation systems",
    "recommendation model",
    "personalized recommendation",
    "sequential recommendation",
    "session-based recommendation",
    "collaborative filtering",
    "user-item",
    "item recommendation",
    "candidate generation",
    "next-basket",
    "learning to rank",
  ],
  "search-ads": [
    "sponsored search",
    "search advertising",
    "computational advertising",
    "online advertising",
    "ad auction",
    "advertising auction",
    "second-price auction",
    "ad ranking",
    "ad delivery",
    "click-through rate",
    "conversion rate",
    "ctr prediction",
    "cvr prediction",
    "real time bidding",
    "auto-bidding",
    "autobidding",
    "budget pacing",
    "paid advertising",
    "personalized advertising",
  ],
  llm: [
    "large language model",
    "large language models",
    "llm",
    "llms",
    "foundation model",
    "foundation models",
    "instruction tuning",
    "direct preference optimization",
    "preference optimization",
    "rlhf",
    "retrieval augmented generation",
    "rag",
    "multimodal large language model",
    "long context",
    "language model agent",
  ],
  "llm-recsys": [
    "large language model recommendation",
    "large language model recommender",
    "llm recommender",
    "llm recommendation",
    "generative recommendation",
    "llm advertising",
    "large language model advertising",
    "llm e-commerce recommendation",
    "large language model sponsored search",
  ],
};

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeTitle(title) {
  return cleanText(title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasSignal(text, signal) {
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}s?([^a-z0-9]|$)`, "i").test(text);
}

function scoreSignals(text, signals) {
  const lower = text.toLowerCase();
  return signals.reduce((score, signal) => score + (hasSignal(lower, signal) ? 1 : 0), 0);
}

function scoreTrack(text, trackId) {
  const base = scoreSignals(text, trackSignals[trackId] || []);

  if (trackId === "llm-recsys") {
    const hasLlm = scoreSignals(text, trackSignals.llm) > 0;
    const hasRecsys = scoreSignals(text, trackSignals.recsys) > 0;
    const hasAds = scoreSignals(text, trackSignals["search-ads"]) > 0;
    return base + (hasLlm && (hasRecsys || hasAds) ? 3 : 0);
  }

  return base;
}

function inferTrack(text, fallbackTrack) {
  const scores = tracks
    .map((track) => ({ id: track.id, score: scoreTrack(text, track.id) }))
    .sort((a, b) => b.score - a.score);

  if (scores[0]?.score > 0) {
    return scores[0].id;
  }

  return fallbackTrack;
}

function pickKeywords(text, concepts = [], keywords = []) {
  const picked = keywordSignals.filter(([needle]) => hasSignal(text, needle)).map(([, label]) => label);
  return [...new Set([...picked, ...keywords.slice(0, 3), ...concepts.slice(0, 2)])].slice(0, 7);
}

function restoreAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") {
    return "";
  }
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      words[position] = word;
    }
  }
  return cleanText(words.join(" "));
}

function openAlexPdfUrl(work) {
  return (
    work.primary_location?.pdf_url ||
    work.open_access?.oa_url ||
    work.best_oa_location?.pdf_url ||
    work.best_oa_location?.landing_page_url ||
    work.primary_location?.landing_page_url ||
    work.doi ||
    work.id
  );
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { year: "unknown", month: "unknown" };
  }
  const year = String(date.getUTCFullYear());
  const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return { year, month };
}

function subtractDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return DEFAULT_START_DATE;
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function maxDateString(...values) {
  return values.filter(Boolean).sort().at(-1) || END_DATE;
}

function buildFetchWindows(from, to, yearly) {
  if (!yearly) {
    return [{ from, to, label: `${from}..${to}`, current: true }];
  }

  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [{ from, to, label: `${from}..${to}`, current: true }];
  }

  const windows = [];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  for (let year = startYear; year <= endYear; year += 1) {
    const windowFrom = year === startYear ? from : `${year}-01-01`;
    const windowTo = year === endYear ? to : `${year}-12-31`;
    windows.push({
      from: windowFrom,
      to: windowTo,
      year: String(year),
      label: String(year),
      current: year === endYear,
    });
  }

  return windows;
}

function maxPagesForWindow(sourceScope, fetchWindow) {
  const base = sourceScope === "arxiv" ? MAX_ARXIV_PAGES_PER_QUERY : MAX_ALL_PAGES_PER_QUERY;
  if (fetchWindow.current) return base;
  const historical = sourceScope === "arxiv" ? HISTORICAL_ARXIV_PAGES_PER_QUERY : HISTORICAL_ALL_PAGES_PER_QUERY;
  return Math.min(base, historical);
}

function signalList(text, signals) {
  return signals.filter((signal) => hasSignal(text, signal));
}

function assignTopics(paper) {
  const text = `${paper.title} ${paper.summary} ${(paper.keywords || []).join(" ")} ${(paper.categories || []).join(" ")}`.toLowerCase();
  const scored = topicTaxonomy
    .map((topic) => ({ id: topic.id, score: signalList(text, topic.signals).length }))
    .filter((topic) => topic.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((topic) => topic.id);

  if (scored.length) {
    return scored.slice(0, 3);
  }

  const fallback = {
    recsys: ["ranking-retrieval"],
    "search-ads": ["ads-creatives"],
    llm: ["rag-agent"],
    "llm-recsys": ["llm4rec"],
  };
  return fallback[paper.track] || ["ranking-retrieval"];
}

function qualityProfile(paper) {
  const source = (paper.source || "").toLowerCase();
  const summaryLength = cleanText(paper.summary).length;
  const reasons = [];
  let score = 18;

  if (source.includes("arxiv")) {
    score += 14;
    reasons.push("arXiv 开放论文");
  } else if (source.includes("acm") || source.includes("ieee") || source.includes("neurips") || source.includes("icml")) {
    score += 10;
    reasons.push("高可信学术来源");
  }

  if (paper.links?.pdf) {
    score += 10;
    reasons.push("可直接访问 PDF/开放版本");
  }

  if (summaryLength > 700) {
    score += 18;
    reasons.push("摘要信息密度高");
  } else if (summaryLength > 260) {
    score += 11;
    reasons.push("摘要可用于方法拆解");
  }

  if ((paper.authors || []).length >= 3) {
    score += 5;
    reasons.push("作者信息完整");
  }

  const relevance = (paper.coreRelevanceScore || 0) * 6 + (paper.requestedCoreScore || 0) * 5 + (paper.relevanceScore || 0) * 2;
  score += Math.min(30, relevance);

  const published = new Date(paper.published);
  if (!Number.isNaN(published.getTime()) && published.getUTCFullYear() >= 2025) {
    score += 5;
    reasons.push("近两年论文");
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const level = bounded >= 78 ? "高" : bounded >= 58 ? "中" : "观察";
  if (reasons.length < 3) {
    reasons.push("主题相关性来自标题、摘要、概念和关键词综合打分");
  }

  return { score: bounded, level, reasons: reasons.slice(0, 4) };
}

function pickDeepSignals(text, pairs) {
  return pairs.filter(([signal]) => hasSignal(text, signal)).map(([, label]) => label);
}

function buildDeepDive(paper) {
  const text = `${paper.title} ${paper.summary} ${(paper.keywords || []).join(" ")} ${(paper.categories || []).join(" ")}`.toLowerCase();
  const methodSignals = pickDeepSignals(text, [
    ["transformer", "Transformer/注意力结构"],
    ["contrastive", "对比学习"],
    ["graph", "图神经网络"],
    ["reinforcement", "强化学习"],
    ["preference", "偏好优化"],
    ["retrieval", "检索增强"],
    ["diffusion", "扩散/生成模型"],
    ["auction", "拍卖机制建模"],
    ["calibration", "概率校准"],
    ["distillation", "蒸馏/压缩"],
  ]);
  const datasetSignals = pickDeepSignals(text, [
    ["amazon", "Amazon"],
    ["movielens", "MovieLens"],
    ["mmlu", "MMLU"],
    ["ms marco", "MS MARCO"],
    ["criteo", "Criteo"],
    ["avazu", "Avazu"],
    ["kuairand", "KuaiRand"],
    ["benchmark", "公开 Benchmark"],
    ["dataset", "自建或公开数据集"],
  ]);
  const metricSignals = pickDeepSignals(text, [
    ["ndcg", "NDCG"],
    ["recall", "Recall"],
    ["auc", "AUC"],
    ["ctr", "CTR"],
    ["cvr", "CVR"],
    ["latency", "Latency"],
    ["conversion", "Conversion"],
    ["accuracy", "Accuracy"],
    ["win rate", "Win Rate"],
  ]);

  return {
    methodSignals: methodSignals.length ? methodSignals : ["需从正文抽取模型结构与训练目标"],
    datasetSignals: datasetSignals.length ? datasetSignals : ["需从实验章节确认数据集与切分"],
    metricSignals: metricSignals.length ? metricSignals : ["需从实验表格确认主指标"],
    formulaSignals: pickDeepSignals(text, [
      ["loss", "主损失函数"],
      ["objective", "优化目标"],
      ["reward", "奖励函数"],
      ["regularization", "正则项"],
    ]),
    reproducePlan: [
      "固定数据切分、负采样和评价口径，先复现论文主表中的核心指标。",
      "把方法拆成输入特征、模型主干、训练目标、推理服务四层，逐层替换到现有链路。",
      paper.track === "search-ads"
        ? "广告方向额外检查预算约束、出价策略、校准和线上竞价模拟。"
        : "推荐/大模型方向额外检查冷启动、长尾、延迟和安全边界。",
    ],
  };
}

function finalizePaper(paper) {
  const topics = Array.isArray(paper.topics) && paper.topics.length ? paper.topics : assignTopics(paper);
  const nextPaper = {
    ...paper,
    topics,
    links: {
      abstract: paper.links?.abstract || "",
      pdf: paper.links?.pdf || paper.links?.abstract || "",
    },
  };
  return {
    ...nextPaper,
    quality: paper.quality?.score ? paper.quality : qualityProfile(nextPaper),
    deepDive: paper.deepDive || buildDeepDive(nextPaper),
  };
}

function buildProblem(summary, trackLabel) {
  const firstSentence = summary.split(/(?<=[.!?])\s+/).find(Boolean) || summary;
  return `${trackLabel}场景下的核心问题：${firstSentence.slice(0, 240)}${firstSentence.length > 240 ? "..." : ""}`;
}

function buildMethod(title, summary, keywords) {
  const hints = keywords.length ? `重点信号包括${keywords.join("、")}。` : "建议重点查看模型结构、训练目标、数据构造和评估协议。";
  return `从题目“${title}”和摘要看，方法应拆成输入信号、主干模型、训练目标、负样本/反馈构造、评估口径五部分。${hints}`;
}

function buildContribution(summary, keywords) {
  const lower = summary.toLowerCase();
  const points = [];
  if (lower.includes("benchmark") || lower.includes("dataset")) points.push("提供数据集或评测基准，可纳入内部离线评测面板。");
  if (lower.includes("efficient") || lower.includes("latency") || lower.includes("inference")) points.push("强调效率、延迟或推理成本，适合评估线上部署收益。");
  if (lower.includes("personal") || lower.includes("user")) points.push("涉及个性化或用户建模，适合映射到召回、粗排、精排或广告定向链路。");
  if (lower.includes("agent") || lower.includes("reason")) points.push("引入智能体或推理过程，建议关注可观测的中间决策与失败模式。");
  if (lower.includes("align") || lower.includes("preference")) points.push("包含偏好优化或对齐目标，可迁移到用户反馈闭环。");
  if (points.length < 3) {
    points.push("建议阅读全文时抽取数据来源、时间切分、负采样方式、损失函数和对照组。");
    points.push(`优先验证${keywords[0] || "主方法"}是否能在现有工程链路中低成本复用。`);
  }
  return points.slice(0, 4);
}

function buildExperimentChecklist(trackId) {
  const common = ["数据切分是否避免时间泄漏", "是否报告消融实验", "是否包含效率、延迟或成本指标"];
  const byTrack = {
    recsys: ["Recall/NDCG/MRR 等排序指标是否完整", "负采样和冷启动设置是否接近真实业务"],
    "search-ads": ["CTR/CVR/AUC 与校准指标是否同时报告", "拍卖、预算、出价和长期价值约束是否纳入"],
    llm: ["基础模型、上下文长度和训练数据规模是否说明", "自动评测与人工评测是否相互校验"],
    "llm-recsys": ["LLM 是否实际参与推荐/广告决策", "是否比较传统 ID 模型、文本语义模型和混合模型"],
  };
  return [...(byTrack[trackId] || []), ...common].slice(0, 5);
}

function buildCodeBlueprint(trackId, keywords) {
  if (trackId === "search-ads") {
    return {
      title: "广告排序与拍卖校准骨架",
      language: "python",
      code: `import torch
import torch.nn as nn

class AdsRanker(nn.Module):
    def __init__(self, feature_dim: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(feature_dim, 256), nn.ReLU(), nn.Dropout(0.1),
            nn.Linear(256, 128), nn.ReLU()
        )
        self.ctr = nn.Linear(128, 1)
        self.cvr = nn.Linear(128, 1)

    def forward(self, x):
        h = self.backbone(x)
        return torch.sigmoid(self.ctr(h)), torch.sigmoid(self.cvr(h))

def auction_score(p_ctr, p_cvr, bid, quality=1.0):
    return bid * p_ctr * p_cvr * quality
`,
      note: "可作为 CTR/CVR 多任务预估、广告质量分和出价融合的最小实现。",
    };
  }

  if (trackId === "llm-recsys") {
    return {
      title: "LLM 表示与推荐特征融合骨架",
      language: "python",
      code: `import torch
import torch.nn as nn

class LLMRecFusion(nn.Module):
    def __init__(self, id_dim: int, text_dim: int):
        super().__init__()
        self.id_tower = nn.Sequential(nn.Linear(id_dim, 128), nn.ReLU())
        self.text_tower = nn.Sequential(nn.Linear(text_dim, 128), nn.ReLU())
        self.gate = nn.Sequential(nn.Linear(256, 1), nn.Sigmoid())
        self.head = nn.Linear(128, 1)

    def forward(self, id_features, llm_text_embedding):
        id_vec = self.id_tower(id_features)
        text_vec = self.text_tower(llm_text_embedding)
        gate = self.gate(torch.cat([id_vec, text_vec], dim=-1))
        fused = gate * text_vec + (1 - gate) * id_vec
        return torch.sigmoid(self.head(fused))
`,
      note: "用于验证 LLM 文本表示是否带来增益，而不是替代成熟 ID 特征链路。",
    };
  }

  if (trackId === "llm" || keywords.includes("RAG")) {
    return {
      title: "RAG/LLM 复现实验骨架",
      language: "python",
      code: `from typing import List

def retrieve(query: str, index, k: int = 5) -> List[str]:
    hits = index.search(query, top_k=k)
    return [doc.text for doc in hits]

def build_prompt(query: str, contexts: List[str]) -> str:
    evidence = "\\n\\n".join(f"[{i+1}] {ctx}" for i, ctx in enumerate(contexts))
    return f"基于证据回答问题。\\n{evidence}\\n\\n问题：{query}\\n回答："

def evaluate(answer: str, reference: str) -> dict:
    return {"contains_reference": reference.lower() in answer.lower(), "length": len(answer)}
`,
      note: "把检索、提示词和评估拆成可替换组件，便于复现实验。",
    };
  }

  return {
    title: "双塔召回/排序实验骨架",
    language: "python",
    code: `import torch
import torch.nn as nn
import torch.nn.functional as F

class TwoTower(nn.Module):
    def __init__(self, user_dim: int, item_dim: int, hidden: int = 128):
        super().__init__()
        self.user_tower = nn.Sequential(nn.Linear(user_dim, hidden), nn.ReLU(), nn.Linear(hidden, hidden))
        self.item_tower = nn.Sequential(nn.Linear(item_dim, hidden), nn.ReLU(), nn.Linear(hidden, hidden))

    def forward(self, user_features, item_features):
        user_vec = F.normalize(self.user_tower(user_features), dim=-1)
        item_vec = F.normalize(self.item_tower(item_features), dim=-1)
        return user_vec @ item_vec.T

def contrastive_loss(scores):
    labels = torch.arange(scores.size(0), device=scores.device)
    return F.cross_entropy(scores, labels)
`,
    note: "适合先复现召回阶段的语义匹配，再接业务负采样、hard negative 和 ANN 检索。",
  };
}

function isLikelyNonResearch(work, title) {
  const source = work.primary_location?.source?.display_name?.toLowerCase() || "";
  const authors = normalizeArray(work.authorships)
    .map((authorship) => cleanText(authorship.author?.display_name))
    .join(" ")
    .toLowerCase();
  const normalizedTitle = normalizeTitle(title);

  if (source.includes("arxiv") || source.includes("acm") || source.includes("ieee")) {
    return false;
  }

  const badTitleSignals = [
    "complete guide",
    "agency",
    "agencies",
    "find the right partner",
    "services in",
    "clone app",
    "how digital marketing",
  ];

  return authors === "google ads" || badTitleSignals.some((signal) => normalizedTitle.includes(signal));
}

function enrichOpenAlexWork(work, requestedTrack) {
  const title = cleanText(work.title || work.display_name);
  if (!title || isLikelyNonResearch(work, title)) {
    return null;
  }

  const summary =
    restoreAbstract(work.abstract_inverted_index) ||
    "OpenAlex 当前没有返回摘要。建议从论文原文抽取方法、数据集、训练目标和实验指标；本条目先基于标题与主题进行工程化初筛。";
  const authors = normalizeArray(work.authorships)
    .map((authorship) => cleanText(authorship.author?.display_name))
    .filter(Boolean);
  const concepts = normalizeArray(work.concepts).map((concept) => concept.display_name).filter(Boolean);
  const rawKeywords = normalizeArray(work.keywords).map((keyword) => keyword.display_name || keyword.keyword).filter(Boolean);
  const coreText = `${title} ${summary}`;
  const fullText = `${coreText} ${concepts.join(" ")} ${rawKeywords.join(" ")}`;
  const requestedCoreScore = scoreTrack(coreText, requestedTrack);
  const requestedFullScore = scoreTrack(fullText, requestedTrack);

  if (requestedCoreScore === 0 && requestedFullScore === 0) {
    return null;
  }

  const inferredTrack = inferTrack(coreText, requestedTrack);
  const trackId = requestedTrack === "llm-recsys" && requestedFullScore >= 2 ? "llm-recsys" : inferredTrack;
  const track = tracks.find((item) => item.id === trackId) || tracks[0];
  const keywords = pickKeywords(fullText, concepts, rawKeywords);
  const published = work.publication_date || `${work.publication_year || new Date().getFullYear()}-01-01`;
  const { year, month } = dateParts(published);
  const landingUrl = work.primary_location?.landing_page_url || work.doi || work.id;

  return {
    id: work.doi || work.id || normalizeTitle(title),
    title,
    authors,
    published,
    updated: work.updated_date || published,
    year,
    month,
    summary,
    track: track.id,
    trackLabel: track.label,
    accent: track.accent,
    categories: concepts.slice(0, 5),
    keywords: keywords.length ? keywords : ["论文精读", "工程验证"],
    source: work.primary_location?.source?.display_name || "OpenAlex",
    relevanceScore: scoreTrack(fullText, track.id),
    coreRelevanceScore: scoreTrack(coreText, track.id),
    requestedCoreScore,
    requestedFullScore,
    links: {
      abstract: landingUrl,
      pdf: openAlexPdfUrl(work),
    },
    deconstruction: {
      problem: buildProblem(summary, track.label),
      method: buildMethod(title, summary, keywords),
      contributions: buildContribution(summary, keywords),
      experimentChecklist: buildExperimentChecklist(track.id),
      engineeringUse:
        "建议先做离线复现：固定数据切分和指标口径，抽出论文中的主损失、特征输入和对照组，再决定是否进入线上小流量实验。",
    },
    codeBlueprint: buildCodeBlueprint(track.id, keywords),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 22000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenAlexQuery(track, query, sourceScope, fetchWindow) {
  const fetched = [];
  let cursor = "*";
  const maxPages = maxPagesForWindow(sourceScope, fetchWindow);

  for (let page = 0; page < maxPages; page += 1) {
    const filters = [`from_publication_date:${fetchWindow.from}`, `to_publication_date:${fetchWindow.to}`];
    if (sourceScope === "arxiv") {
      filters.push(`primary_location.source.id:${OPENALEX_ARXIV_SOURCE}`);
    }

    const params = new URLSearchParams({
      search: query,
      filter: filters.join(","),
      sort: "publication_date:desc",
      "per-page": String(PAGE_SIZE),
      cursor,
      select:
        "id,doi,title,display_name,publication_year,publication_date,updated_date,authorships,abstract_inverted_index,primary_location,best_oa_location,open_access,concepts,keywords,type",
    });

    const response = await fetchWithTimeout(`${OPENALEX_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent": "paper-intelligence-hub/0.2 (mailto:paper-hub@example.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAlex ${track.id}/${query}/${sourceScope} failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = normalizeArray(data.results);
    const enriched = results
      .map((work) => enrichOpenAlexWork(work, track.id))
      .filter(Boolean)
      .map(finalizePaper);
    fetched.push(...enriched);
    console.log(
      `[${track.id}] ${fetchWindow.label} ${sourceScope} "${query}" page ${page + 1}/${maxPages}: ${enriched.length}/${results.length} kept`,
    );

    cursor = data.meta?.next_cursor;
    if (!cursor || results.length < PAGE_SIZE) break;
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  return fetched;
}

function qualityScore(paper) {
  if (paper.quality?.score != null) {
    return paper.quality.score;
  }
  const source = (paper.source || "").toLowerCase();
  const sourceBoost = source.includes("arxiv") ? 8 : source.includes("acm") || source.includes("ieee") ? 4 : 0;
  return sourceBoost + (paper.coreRelevanceScore || 0) * 6 + (paper.requestedCoreScore || 0) * 4 + (paper.relevanceScore || 0);
}

function buildTimeline(papers) {
  const byYear = new Map();
  const byMonth = new Map();

  for (const paper of papers) {
    const yearKey = paper.year || dateParts(paper.published).year;
    const monthKey = paper.month || dateParts(paper.published).month;

    if (!byYear.has(yearKey)) {
      byYear.set(yearKey, { year: yearKey, count: 0, byTrack: {} });
    }
    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { month: monthKey, year: yearKey, count: 0, byTrack: {} });
    }

    const year = byYear.get(yearKey);
    const month = byMonth.get(monthKey);
    year.count += 1;
    month.count += 1;
    year.byTrack[paper.track] = (year.byTrack[paper.track] || 0) + 1;
    month.byTrack[paper.track] = (month.byTrack[paper.track] || 0) + 1;
  }

  return {
    years: [...byYear.values()].sort((a, b) => String(b.year).localeCompare(String(a.year))),
    months: [...byMonth.values()].sort((a, b) => String(b.month).localeCompare(String(a.month))),
  };
}

function buildTopicSummary(papers) {
  return topicTaxonomy.map((topic) => {
    const topicPapers = papers.filter((paper) => (paper.topics || []).includes(topic.id));
    const byYear = topicPapers.reduce((acc, paper) => {
      const year = paper.year || dateParts(paper.published).year;
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});
    return {
      id: topic.id,
      label: topic.label,
      accent: topic.accent,
      count: topicPapers.length,
      byYear,
    };
  });
}

function buildTrends(papers, topics) {
  const months = buildTimeline(papers).months.slice().reverse();
  const keywordCounts = new Map();

  for (const paper of papers) {
    for (const keyword of paper.keywords || []) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    }
  }

  const monthly = months.map((month) => {
    const monthPapers = papers.filter((paper) => (paper.month || dateParts(paper.published).month) === month.month);
    const byTopic = {};
    for (const paper of monthPapers) {
      for (const topic of paper.topics || []) {
        byTopic[topic] = (byTopic[topic] || 0) + 1;
      }
    }
    return {
      month: month.month,
      count: month.count,
      byTrack: month.byTrack,
      byTopic,
    };
  });

  return {
    monthly,
    topKeywords: [...keywordCounts.entries()]
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24),
    risingTopics: topics
      .filter((topic) => topic.count > 0)
      .map((topic) => {
        const recent = monthly.slice(-6).reduce((sum, month) => sum + (month.byTopic[topic.id] || 0), 0);
        const previous = monthly.slice(-12, -6).reduce((sum, month) => sum + (month.byTopic[topic.id] || 0), 0);
        return { ...topic, recent, previous, delta: recent - previous };
      })
      .sort((a, b) => b.delta - a.delta || b.recent - a.recent)
      .slice(0, 8),
  };
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function bibKey(paper, index) {
  const author = normalizeTitle(paper.authors?.[0] || "paper").split(" ")[0] || "paper";
  const year = paper.year || dateParts(paper.published).year || "nd";
  const slug = normalizeTitle(paper.title).split(" ").slice(0, 4).join("");
  return `${author}${year}${slug || index}`;
}

function escapeBibtex(value) {
  return String(value ?? "").replace(/[{}]/g, "").replace(/\n/g, " ");
}

async function writeExports(data) {
  await fs.mkdir(exportsDir, { recursive: true });

  const csvRows = [
    ["title", "authors", "published", "track", "topics", "quality", "source", "abstract_url", "pdf_url", "summary"],
    ...data.papers.map((paper) => [
      paper.title,
      (paper.authors || []).join("; "),
      paper.published,
      paper.trackLabel,
      (paper.topics || []).join("; "),
      paper.quality?.score ?? "",
      paper.source || "",
      paper.links?.abstract || "",
      paper.links?.pdf || "",
      paper.summary,
    ]),
  ];
  await fs.writeFile(path.join(exportsDir, "papers.csv"), `${csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`, "utf8");

  const bib = data.papers
    .map((paper, index) => {
      const key = bibKey(paper, index + 1);
      const url = paper.links?.pdf || paper.links?.abstract || "";
      return `@misc{${key},
  title = {${escapeBibtex(paper.title)}},
  author = {${escapeBibtex((paper.authors || []).join(" and ") || "Unknown")}},
  year = {${escapeBibtex(paper.year || dateParts(paper.published).year)}},
  howpublished = {${escapeBibtex(paper.source || "OpenAlex")}},
  url = {${escapeBibtex(url)}},
  note = {${escapeBibtex(paper.trackLabel)}}
}`;
    })
    .join("\n\n");
  await fs.writeFile(path.join(exportsDir, "papers.bib"), `${bib}\n`, "utf8");

  const latest = data.papers.slice(0, 30);
  const weekly = [
    `# Paper Intelligence Weekly`,
    ``,
    `生成时间：${data.generatedAt}`,
    `覆盖范围：${data.dateRange.from} 至 ${data.dateRange.to}`,
    `论文总数：${data.stats.total}`,
    ``,
    `## 最近 30 篇`,
    ...latest.map((paper, index) => `${index + 1}. **${paper.title}** (${paper.trackLabel}, ${paper.published}) - ${paper.links?.abstract || ""}`),
    ``,
    `## 上升主题`,
    ...data.trends.risingTopics.map((topic) => `- ${topic.label}: 最近 6 个月 ${topic.recent} 篇，较前 6 个月 ${topic.delta >= 0 ? "+" : ""}${topic.delta}`),
  ].join("\n");
  await fs.writeFile(path.join(exportsDir, "weekly.md"), `${weekly}\n`, "utf8");
}

async function readExistingData() {
  try {
    return JSON.parse(await fs.readFile(outputFile, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const existingData = await readExistingData();
  const existingPapers = normalizeArray(existingData?.papers).map(finalizePaper);
  const fetched = [];
  const errors = [];
  let networkFetched = 0;

  if (MODE === "incremental" && !process.env.PAPER_START_DATE) {
    const anchor = existingData?.dateRange?.to || existingData?.generatedAt?.slice(0, 10) || END_DATE;
    START_DATE = subtractDays(anchor, INCREMENTAL_DAYS);
  }

  if (MODE === "augment") {
    fetched.push(...existingPapers);
    console.log(`Augmenting existing corpus: ${existingPapers.length} papers`);
  } else {
    const yearlyBackfill = MODE === "full" || process.env.PAPER_YEARLY_BACKFILL === "true";
    const fetchWindows = buildFetchWindows(START_DATE, END_DATE, yearlyBackfill);

    for (const track of tracks) {
      for (const query of track.openAlexQueries) {
        for (const sourceScope of track.sourceScopes) {
          for (const fetchWindow of fetchWindows) {
            try {
              const papers = await fetchOpenAlexQuery(track, query, sourceScope, fetchWindow);
              fetched.push(...papers);
              networkFetched += papers.length;
            } catch (error) {
              errors.push({
                track: track.id,
                source: `OpenAlex:${sourceScope}:${fetchWindow.label}`,
                query,
                message: error.message,
              });
            }
            await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
          }
        }
      }
    }

    if (MODE === "incremental") {
      fetched.push(...existingPapers);
      console.log(`Merged ${existingPapers.length} existing papers with ${networkFetched} freshly fetched papers`);
    }
  }

  const byKey = new Map();
  for (const paper of fetched) {
    const finalPaper = finalizePaper(paper);
    const titleKey = normalizeTitle(finalPaper.title);
    const idKey = cleanText(finalPaper.id).toLowerCase();
    const dedupeKey = idKey || titleKey;
    if (!titleKey) continue;

    const existing = byKey.get(dedupeKey) || byKey.get(titleKey);
    if (!existing || qualityScore(finalPaper) > qualityScore(existing)) {
      byKey.set(dedupeKey, finalPaper);
      byKey.set(titleKey, finalPaper);
    }
  }

  const uniquePapers = [...new Set(byKey.values())].sort((a, b) => {
    const dateDiff = new Date(b.published).getTime() - new Date(a.published).getTime();
    return dateDiff || qualityScore(b) - qualityScore(a);
  });

  const balanced = [];
  for (const track of tracks) {
    balanced.push(
      ...uniquePapers
        .filter((paper) => paper.track === track.id)
        .sort((a, b) => {
          const dateDiff = new Date(b.published).getTime() - new Date(a.published).getTime();
          return dateDiff || qualityScore(b) - qualityScore(a);
        })
        .slice(0, PER_TRACK_LIMIT),
    );
  }

  const papers = [...new Set(balanced)]
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
    .slice(0, TOTAL_LIMIT);
  const timeline = buildTimeline(papers);
  const topics = buildTopicSummary(papers);
  const trends = buildTrends(papers, topics);
  const previousIds = new Set(existingPapers.map((paper) => paper.id));
  const newSinceLastRun = MODE === "incremental" ? papers.filter((paper) => !previousIds.has(paper.id)).length : 0;

  const data = {
    generatedAt: new Date().toISOString(),
    source: "OpenAlex API",
    mode: MODE,
    dateRange: {
      from: MODE === "incremental" && existingData?.dateRange?.from ? existingData.dateRange.from : START_DATE,
      to: MODE === "incremental" ? maxDateString(existingData?.dateRange?.to, END_DATE) : END_DATE,
    },
    focus: ["推荐系统", "搜索广告", "大模型", "LLM x 推荐广告"],
    tracks,
    topics,
    timeline,
    trends,
    exports: {
      csv: "data/exports/papers.csv",
      bibtex: "data/exports/papers.bib",
      weekly: "data/exports/weekly.md",
      json: "data/papers.json",
    },
    stats: {
      total: papers.length,
      rawFetched: fetched.length,
      networkFetched,
      uniqueTotal: uniquePapers.length,
      outputLimit: TOTAL_LIMIT,
      perTrackLimit: PER_TRACK_LIMIT,
      newSinceLastRun,
      byTrack: tracks.map((track) => ({
        id: track.id,
        label: track.label,
        count: papers.filter((paper) => paper.track === track.id).length,
      })),
      bySource: Object.entries(
        papers.reduce((acc, paper) => {
          const source = paper.source || "Unknown";
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {}),
      )
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      errors,
    },
    papers,
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await writeExports(data);

  console.log(
    `Wrote ${papers.length} papers (${uniquePapers.length} unique, ${fetched.length} fetched, ${networkFetched} network) for ${data.dateRange.from}..${data.dateRange.to}`,
  );
  if (errors.length) {
    console.warn("Completed with partial errors:", errors.slice(0, 8));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
