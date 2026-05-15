import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputFile = path.join(rootDir, "public", "data", "papers.json");

const ARXIV_ENDPOINT = "https://export.arxiv.org/api/query";
const OPENALEX_ENDPOINT = "https://api.openalex.org/works";
const OPENALEX_ARXIV_SOURCE = "S4306400194";
const MAX_PER_TRACK = Number(process.env.PAPER_MAX_RESULTS || 18);
const TOTAL_LIMIT = Number(process.env.PAPER_TOTAL_LIMIT || 42);
const LOOKBACK_DAYS = Number(process.env.PAPER_LOOKBACK_DAYS || 180);

const tracks = [
  {
    id: "recsys",
    label: "推荐系统",
    accent: "#2f7d67",
    openAlexQuery: "recommender system recommendation ranking retrieval sequential recommendation",
    query:
      'all:"recommender system" OR all:"recommendation model" OR all:"sequential recommendation" OR all:"ranking model"',
  },
  {
    id: "search-ads",
    label: "搜索广告",
    accent: "#c55a2e",
    lookbackDays: 365,
    allowBroadFallback: true,
    openAlexQuery: "sponsored search search advertising ad ranking advertising auction ctr cvr",
    query:
      'all:"sponsored search" OR all:"search advertising" OR all:"ad ranking" OR all:"advertising auction"',
  },
  {
    id: "llm",
    label: "大模型",
    accent: "#5e6ad2",
    openAlexQuery: "large language model LLM foundation model instruction tuning alignment",
    query:
      'all:"large language model" OR all:"LLM" OR all:"foundation model" OR all:"instruction tuning"',
  },
  {
    id: "llm-recsys",
    label: "LLM x 推荐广告",
    accent: "#9b6b2f",
    openAlexQuery: "large language model recommendation advertising generative recommendation LLM recommender",
    query:
      '(all:"large language model" AND all:"recommendation") OR (all:"LLM" AND all:"advertising") OR (all:"generative recommendation")',
  },
];

const keywordSignals = [
  ["retrieval", "召回"],
  ["ranking", "排序"],
  ["rerank", "重排"],
  ["auction", "拍卖机制"],
  ["ctr", "CTR 预估"],
  ["conversion", "CVR 预估"],
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
];

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isoDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function dateRangeFilter(days = LOOKBACK_DAYS) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return `from_publication_date:${isoDateOnly(start)},to_publication_date:${isoDateOnly(end)}`;
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

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function pickKeywords(text) {
  const lower = text.toLowerCase();
  return keywordSignals
    .filter(([needle]) => lower.includes(needle))
    .slice(0, 6)
    .map(([, label]) => label);
}

function inferTrack(text, fallbackTrack) {
  const lower = text.toLowerCase();
  if (lower.includes("sponsored search") || lower.includes("advertising") || lower.includes("auction")) {
    return "search-ads";
  }
  if (lower.includes("recommender") || lower.includes("recommendation")) {
    return lower.includes("large language model") || lower.includes("llm") ? "llm-recsys" : "recsys";
  }
  if (lower.includes("large language model") || lower.includes("llm") || lower.includes("foundation model")) {
    return "llm";
  }
  return fallbackTrack;
}

function getLink(entry, type) {
  const links = normalizeArray(entry.link);
  const hit = links.find((item) => item?.["@_title"] === type || item?.["@_type"] === type);
  return hit?.["@_href"] || links.find((item) => item?.["@_href"])?.["@_href"] || "";
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

function buildProblem(summary, trackLabel) {
  const firstSentence = summary.split(/(?<=[.!?])\s+/).find(Boolean) || summary;
  return `${trackLabel}场景下的核心问题：${firstSentence.slice(0, 220)}${firstSentence.length > 220 ? "..." : ""}`;
}

function buildMethod(title, summary, keywords) {
  const hints = keywords.length ? `重点信号包括${keywords.join("、")}。` : "论文需要重点关注模型结构、训练目标、数据构造和评估协议。";
  return `从题目“${title}”和摘要看，方法大概率围绕任务建模、数据/反馈信号组织、训练目标设计与线上可部署性展开。${hints}`;
}

function buildContribution(summary, keywords) {
  const lower = summary.toLowerCase();
  const points = [];
  if (lower.includes("benchmark")) points.push("提供新的评测集或基准，适合纳入内部离线评估面板。");
  if (lower.includes("efficient") || lower.includes("latency")) points.push("强调效率或延迟优化，可关注线上推理成本。");
  if (lower.includes("personal")) points.push("围绕个性化建模，对推荐与广告定向有直接参考价值。");
  if (lower.includes("reason")) points.push("引入推理或解释能力，适合拆成可观测的中间决策链路。");
  if (lower.includes("align")) points.push("关注对齐与偏好学习，可迁移到用户反馈闭环。");
  if (points.length < 3) {
    points.push("建议阅读全文时抽取数据来源、负采样方式、损失函数和线上/离线指标口径。");
    points.push(`优先验证${keywords[0] || "主方法"}是否能在现有召回、粗排、精排或生成式交互链路中复用。`);
  }
  return points.slice(0, 4);
}

function buildExperimentChecklist(trackId) {
  const common = ["数据集是否接近真实业务分布", "是否报告消融实验", "是否包含效率、延迟或成本指标"];
  const byTrack = {
    recsys: ["召回率、NDCG、MRR 等排序指标是否完整", "负采样和时间切分是否避免泄漏"],
    "search-ads": ["CTR/CVR/AUC 与校准指标是否同时报告", "拍卖约束、预算约束和长期价值是否被纳入"],
    llm: ["是否说明基础模型、上下文长度和训练数据规模", "是否包含人工评测与自动评测的一致性分析"],
    "llm-recsys": ["LLM 是否真正参与排序/生成决策，而不只是文本特征增强", "是否比较传统 ID-based 模型和文本语义模型"],
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
        p_ctr = torch.sigmoid(self.ctr(h))
        p_cvr = torch.sigmoid(self.cvr(h))
        return p_ctr, p_cvr

def auction_score(p_ctr, p_cvr, bid, quality=1.0):
    return bid * p_ctr * p_cvr * quality
`,
      note: "适合作为 CTR/CVR 多任务预估、广告质量分和出价融合的最小实现。论文如涉及拍卖或校准，可在 score 层替换为对应机制。",
    };
  }

  if (trackId === "llm" || keywords.includes("RAG")) {
    return {
      title: "RAG/LLM 论文方法复现实验骨架",
      language: "python",
      code: `from typing import List

def retrieve(query: str, index, k: int = 5) -> List[str]:
    hits = index.search(query, top_k=k)
    return [doc.text for doc in hits]

def build_prompt(query: str, contexts: List[str]) -> str:
    evidence = "\\n\\n".join(f"[{i+1}] {ctx}" for i, ctx in enumerate(contexts))
    return f"基于证据回答问题。\\n{evidence}\\n\\n问题：{query}\\n回答："

def evaluate(answer: str, reference: str) -> dict:
    return {
        "contains_reference": reference.lower() in answer.lower(),
        "length": len(answer),
    }
`,
      note: "用于把论文中的检索、提示词、评估指标拆成可替换组件。真实接入时替换 index 和模型调用即可。",
    };
  }

  if (trackId === "llm-recsys") {
    return {
      title: "LLM 增强推荐特征融合骨架",
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
      note: "用于验证 LLM 文本表示是否真的带来增益，而不是替代成熟的 ID 特征链路。",
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

function enrichEntry(entry, fallbackTrack) {
  const title = cleanText(entry.title);
  const summary = cleanText(entry.summary);
  const authors = normalizeArray(entry.author).map((author) => cleanText(author.name)).filter(Boolean);
  const text = `${title} ${summary}`;
  const trackId = inferTrack(text, fallbackTrack);
  const track = tracks.find((item) => item.id === trackId) || tracks[0];
  const keywords = pickKeywords(text);
  const categories = normalizeArray(entry.category).map((category) => category?.["@_term"]).filter(Boolean);
  const pdfUrl = getLink(entry, "pdf");
  const absUrl = cleanText(entry.id);

  return {
    id: absUrl || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    authors,
    published: entry.published,
    updated: entry.updated,
    summary,
    track: track.id,
    trackLabel: track.label,
    accent: track.accent,
    categories,
    keywords: keywords.length ? keywords : ["论文精读", "工程验证"],
    links: {
      abstract: absUrl,
      pdf: pdfUrl,
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

function enrichOpenAlexWork(work, fallbackTrack) {
  const title = cleanText(work.title || work.display_name);
  const restoredAbstract = restoreAbstract(work.abstract_inverted_index);
  const summary =
    restoredAbstract ||
    `OpenAlex 当前没有返回这篇论文的摘要。建议从论文原文抽取方法、数据集、训练目标和实验指标；本条目先基于标题与主题进行工程化初筛。`;
  const authors = normalizeArray(work.authorships)
    .map((authorship) => cleanText(authorship.author?.display_name))
    .filter(Boolean);
  const concepts = normalizeArray(work.concepts).map((concept) => concept.display_name).filter(Boolean);
  const keywords = normalizeArray(work.keywords).map((keyword) => keyword.display_name || keyword.keyword).filter(Boolean);
  const text = `${title} ${summary} ${concepts.join(" ")} ${keywords.join(" ")}`;
  const trackId = inferTrack(text, fallbackTrack);
  const track = tracks.find((item) => item.id === trackId) || tracks[0];
  const pickedKeywords = [...new Set([...pickKeywords(text), ...keywords.slice(0, 3)])].slice(0, 6);
  const landingUrl = work.primary_location?.landing_page_url || work.doi || work.id;

  return {
    id: work.doi || work.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    authors,
    published: work.publication_date || `${work.publication_year || new Date().getFullYear()}-01-01`,
    updated: work.updated_date || work.publication_date || new Date().toISOString(),
    summary,
    track: track.id,
    trackLabel: track.label,
    accent: track.accent,
    categories: concepts.slice(0, 5),
    keywords: pickedKeywords.length ? pickedKeywords : ["论文精读", "工程验证"],
    links: {
      abstract: landingUrl,
      pdf: openAlexPdfUrl(work),
    },
    deconstruction: {
      problem: buildProblem(summary, track.label),
      method: buildMethod(title, summary, pickedKeywords),
      contributions: buildContribution(summary, pickedKeywords),
      experimentChecklist: buildExperimentChecklist(track.id),
      engineeringUse:
        "建议先做离线复现：固定数据切分和指标口径，抽出论文中的主损失、特征输入和对照组，再决定是否进入线上小流量实验。",
    },
    codeBlueprint: buildCodeBlueprint(track.id, pickedKeywords),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 16000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenAlexTrack(track) {
  return fetchOpenAlexTrackWithScope(track, true);
}

async function fetchOpenAlexTrackWithScope(track, arxivOnly) {
  const filters = [dateRangeFilter(track.lookbackDays || LOOKBACK_DAYS)];
  if (arxivOnly) {
    filters.push(`primary_location.source.id:${OPENALEX_ARXIV_SOURCE}`);
  }

  const params = new URLSearchParams({
    search: track.openAlexQuery,
    filter: filters.join(","),
    sort: "publication_date:desc",
    "per-page": String(MAX_PER_TRACK),
    select:
      "id,doi,title,display_name,publication_year,publication_date,updated_date,authorships,abstract_inverted_index,primary_location,best_oa_location,open_access,concepts,keywords,type",
  });

  const response = await fetchWithTimeout(`${OPENALEX_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": "paper-intelligence-hub/0.1 (mailto:paper-hub@example.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAlex ${track.id} request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return normalizeArray(data.results).map((work) => enrichOpenAlexWork(work, track.id));
}

async function fetchArxivTrack(track) {
  const params = new URLSearchParams({
    search_query: track.query,
    sortBy: "submittedDate",
    sortOrder: "descending",
    start: "0",
    max_results: String(MAX_PER_TRACK),
  });

  const response = await fetchWithTimeout(`${ARXIV_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": "paper-intelligence-hub/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`arXiv ${track.id} request failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const data = parser.parse(xml);
  return normalizeArray(data.feed?.entry).map((entry) => enrichEntry(entry, track.id));
}

async function main() {
  const fetched = [];
  const errors = [];

  for (const track of tracks) {
    try {
      const papers = await fetchOpenAlexTrack(track);
      if (track.allowBroadFallback && papers.length < 6) {
        papers.push(...(await fetchOpenAlexTrackWithScope(track, false)));
      }
      fetched.push(...papers);
      await new Promise((resolve) => setTimeout(resolve, 900));
    } catch (error) {
      errors.push({ track: track.id, source: "OpenAlex", message: error.message });
      try {
        const papers = await fetchArxivTrack(track);
        fetched.push(...papers);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (fallbackError) {
        errors.push({ track: track.id, source: "arXiv", message: fallbackError.message });
      }
    }
  }

  const byId = new Map();
  for (const paper of fetched) {
    const dedupeKey = cleanText(paper.title).toLowerCase();
    if (!byId.has(paper.id) && !byId.has(dedupeKey)) {
      byId.set(paper.id, paper);
      byId.set(dedupeKey, paper);
    }
  }

  const uniquePapers = [...new Set(byId.values())].sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime(),
  );
  const perTrackQuota = Math.max(6, Math.floor(TOTAL_LIMIT / tracks.length));
  const balanced = [];

  for (const track of tracks) {
    balanced.push(...uniquePapers.filter((paper) => paper.track === track.id).slice(0, perTrackQuota));
  }

  for (const paper of uniquePapers) {
    if (balanced.length >= TOTAL_LIMIT) break;
    if (!balanced.includes(paper)) balanced.push(paper);
  }

  const papers = balanced
    .slice(0, TOTAL_LIMIT)
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  const data = {
    generatedAt: new Date().toISOString(),
    source: "OpenAlex API + arXiv fallback",
    focus: ["推荐系统", "搜索广告", "大模型", "LLM x 推荐广告"],
    tracks,
    stats: {
      total: papers.length,
      byTrack: tracks.map((track) => ({
        id: track.id,
        label: track.label,
        count: papers.filter((paper) => paper.track === track.id).length,
      })),
      errors,
    },
    papers,
  };

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(`Wrote ${papers.length} papers to ${path.relative(rootDir, outputFile)}`);
  if (errors.length) {
    console.warn("Completed with partial errors:", errors);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
