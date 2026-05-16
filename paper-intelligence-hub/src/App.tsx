import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownAZ,
  ArrowUpRight,
  BadgeCheck,
  BookMarked,
  BookOpenText,
  BrainCircuit,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Command,
  Compass,
  Copy,
  Database,
  Download,
  Eye,
  FileJson,
  FileText,
  FlaskConical,
  Gauge,
  Library,
  Layers3,
  LineChart,
  ListFilter,
  RefreshCcw,
  Rows3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Telescope,
  Target,
  Wrench,
  X,
  Zap,
} from "lucide-react";

type Track = {
  id: string;
  label: string;
  accent: string;
  openAlexQueries?: string[];
};

type Topic = {
  id: string;
  label: string;
  accent: string;
  count: number;
  byYear?: Record<string, number>;
};

type Quality = {
  score: number;
  level: string;
  reasons: string[];
};

type DeepDive = {
  methodSignals: string[];
  datasetSignals: string[];
  metricSignals: string[];
  formulaSignals: string[];
  reproducePlan: string[];
};

type Paper = {
  id: string;
  title: string;
  authors: string[];
  published: string;
  updated: string;
  year?: string;
  month?: string;
  summary: string;
  track: string;
  trackLabel: string;
  accent: string;
  categories: string[];
  keywords: string[];
  topics?: string[];
  quality?: Quality;
  deepDive?: DeepDive;
  detailPath?: string;
  source?: string;
  relevanceScore?: number;
  coreRelevanceScore?: number;
  links: {
    abstract: string;
    pdf: string;
  };
  deconstruction?: {
    problem: string;
    method: string;
    contributions: string[];
    experimentChecklist: string[];
    engineeringUse: string;
  };
  codeBlueprint?: {
    title: string;
    language: string;
    code: string;
    note: string;
  };
};

type TimelineYear = {
  year: string;
  count: number;
  byTrack: Record<string, number>;
};

type TimelineMonth = {
  month: string;
  year: string;
  count: number;
  byTrack: Record<string, number>;
};

type TrendMonth = {
  month: string;
  count: number;
  byTrack: Record<string, number>;
  byTopic: Record<string, number>;
};

type RisingTopic = Topic & {
  recent: number;
  previous: number;
  delta: number;
};

type PaperData = {
  generatedAt: string;
  source: string;
  mode?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  tracks: Track[];
  topics?: Topic[];
  timeline?: {
    years: TimelineYear[];
    months: TimelineMonth[];
  };
  trends?: {
    monthly: TrendMonth[];
    topKeywords: { keyword: string; count: number }[];
    risingTopics: RisingTopic[];
  };
  exports?: {
    csv?: string;
    bibtex?: string;
    weekly?: string;
    json?: string;
    index?: string;
  };
  index?: string;
  detailShards?: { path: string; count: number }[];
  stats: {
    total: number;
    rawFetched?: number;
    networkFetched?: number;
    uniqueTotal?: number;
    outputLimit?: number;
    perTrackLimit?: number;
    newSinceLastRun?: number;
    byTrack: { id: string; label: string; count: number }[];
    bySource?: { source: string; count: number }[];
    errors: { track: string; source?: string; query?: string; message: string }[];
  };
  papers: Paper[];
};

type PaperIndexPayload = {
  generatedAt: string;
  total: number;
  papers: Paper[];
};

type UserStatus = "todo" | "reading" | "read" | "reproduce" | "ignored";

type PaperUserState = {
  status?: UserStatus;
  favorite?: boolean;
};

type SortMode = "latest" | "quality" | "relevance" | "title";
type SourceFilter = "all" | "pdf" | "arxiv" | "openalex";
type StatusFilter = "all" | "favorite" | UserStatus;
type DetailTab = "brief" | "reproduce" | "code" | "meta";
type InsightCard = {
  id: string;
  label: string;
  title: string;
  meta: string;
  icon: ReactNode;
  action: () => void;
};

const STORAGE_KEY = "paper-intelligence-hub/user-state/v2";
const baseUrl = import.meta.env.BASE_URL;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const statusOptions: { id: UserStatus; label: string; icon: ReactNode }[] = [
  { id: "todo", label: "待读", icon: <BookMarked size={14} /> },
  { id: "reading", label: "在读", icon: <Eye size={14} /> },
  { id: "read", label: "已读", icon: <CheckCircle2 size={14} /> },
  { id: "reproduce", label: "复现", icon: <Wrench size={14} /> },
  { id: "ignored", label: "忽略", icon: <X size={14} /> },
];

const detailTabs: { id: DetailTab; label: string; icon: ReactNode }[] = [
  { id: "brief", label: "解读", icon: <BookOpenText size={15} /> },
  { id: "reproduce", label: "复现", icon: <FlaskConical size={15} /> },
  { id: "code", label: "代码", icon: <Code2 size={15} /> },
  { id: "meta", label: "元数据", icon: <FileText size={15} /> },
];

function formatNumber(value?: number) {
  return numberFormatter.format(value ?? 0);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return timeFormatter.format(date);
}

function getYear(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : String(date.getFullYear());
}

function getMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  if (value === "unknown") return "未知";
  const [, month] = value.split("-");
  return month ? `${Number(month)}月` : value;
}

function assetUrl(path?: string) {
  if (!path) return "";
  return `${baseUrl}${path.replace(/^\//, "")}`;
}

function qualityScore(paper: Paper) {
  return paper.quality?.score ?? (paper.coreRelevanceScore || 0) * 8 + (paper.relevanceScore || 0);
}

function authorLine(authors: string[]) {
  if (!authors.length) return "Unknown authors";
  const shown = authors.slice(0, 5).join(", ");
  return authors.length > 5 ? `${shown} +${authors.length - 5}` : shown;
}

function sourceKind(paper: Paper) {
  const source = (paper.source || "").toLowerCase();
  if (source.includes("arxiv")) return "arXiv";
  if (paper.links?.pdf) return "Open PDF";
  return paper.source || "OpenAlex";
}

function compactSummary(value: string, maxLength = 132) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function paperSignal(paper: Paper) {
  if (paper.quality?.reasons?.[0]) return paper.quality.reasons[0];
  if (paper.keywords?.[0]) return paper.keywords[0];
  if (paper.categories?.[0]) return paper.categories[0];
  return "待分析";
}

function highlightText(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return text;

  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let index = 0;
  let match = lower.indexOf(target, index);

  while (match >= 0) {
    if (match > index) parts.push(text.slice(index, match));
    parts.push(<mark key={`${match}-${target}`}>{text.slice(match, match + target.length)}</mark>);
    index = match + target.length;
    match = lower.indexOf(target, index);
  }

  if (index < text.length) parts.push(text.slice(index));
  return parts.length ? parts : text;
}

function App() {
  const [data, setData] = useState<PaperData | null>(null);
  const [activeTrack, setActiveTrack] = useState("all");
  const [activeYear, setActiveYear] = useState("all");
  const [activeMonth, setActiveMonth] = useState("all");
  const [activeTopic, setActiveTopic] = useState("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("brief");
  const [displayLimit, setDisplayLimit] = useState(180);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [userState, setUserState] = useState<Record<string, PaperUserState>>({});
  const [paperDetails, setPaperDetails] = useState<Record<string, Paper>>({});
  const [detailLoadingPath, setDetailLoadingPath] = useState("");
  const [detailError, setDetailError] = useState("");
  const loadedDetailShards = useRef(new Set<string>());

  useEffect(() => {
    fetch(`${baseUrl}data/papers.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("论文数据尚未生成，请先运行 npm run fetch:papers");
        return response.json();
      })
      .then(async (payload: PaperData) => {
        const indexPath = payload.index || payload.exports?.index || "data/papers-index.json";
        const papers =
          payload.papers ||
          (await fetch(`${assetUrl(indexPath)}?v=${Date.now()}`, { cache: "no-store" })
            .then((response) => {
              if (!response.ok) throw new Error("论文索引尚未生成，请先运行 npm run augment:data");
              return response.json();
            })
            .then((indexPayload: PaperIndexPayload) => indexPayload.papers));

        setData({ ...payload, papers });
        setSelectedId(papers[0]?.id ?? null);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setUserState(JSON.parse(stored) as Record<string, PaperUserState>);
    } catch {
      setUserState({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
  }, [userState]);

  useEffect(() => {
    setDisplayLimit(180);
  }, [activeTrack, activeYear, activeMonth, activeTopic, query, sortMode, sourceFilter, statusFilter]);

  useEffect(() => {
    setDetailTab("brief");
  }, [selectedId]);

  const filteredPapers = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();

    const filtered = data.papers.filter((paper) => {
      const year = paper.year || getYear(paper.published);
      const month = paper.month || getMonth(paper.published);
      const state = userState[paper.id] || {};
      const source = (paper.source || "").toLowerCase();
      const hasPdf = Boolean(paper.links?.pdf);
      const inTrack = activeTrack === "all" || paper.track === activeTrack;
      const inYear = activeYear === "all" || year === activeYear;
      const inMonth = activeMonth === "all" || month === activeMonth;
      const inTopic = activeTopic === "all" || (paper.topics || []).includes(activeTopic);
      const inSource =
        sourceFilter === "all" ||
        (sourceFilter === "pdf" && hasPdf) ||
        (sourceFilter === "arxiv" && source.includes("arxiv")) ||
        (sourceFilter === "openalex" && !source.includes("arxiv"));
      const inStatus =
        statusFilter === "all" ||
        (statusFilter === "favorite" && state.favorite) ||
        (statusFilter !== "favorite" && state.status === statusFilter);
      const inText =
        !needle ||
        [
          paper.title,
          paper.summary,
          paper.trackLabel,
          paper.authors.join(" "),
          paper.keywords.join(" "),
          paper.categories.join(" "),
          paper.source || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return inTrack && inYear && inMonth && inTopic && inSource && inStatus && inText;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "quality") return qualityScore(b) - qualityScore(a);
      if (sortMode === "relevance") return (b.coreRelevanceScore || b.relevanceScore || 0) - (a.coreRelevanceScore || a.relevanceScore || 0);
      if (sortMode === "title") return a.title.localeCompare(b.title);
      const dateDiff = new Date(b.published).getTime() - new Date(a.published).getTime();
      return dateDiff || qualityScore(b) - qualityScore(a);
    });
  }, [activeMonth, activeTopic, activeTrack, activeYear, data, query, sortMode, sourceFilter, statusFilter, userState]);

  useEffect(() => {
    if (filteredPapers.length === 0) return;
    if (!filteredPapers.some((paper) => paper.id === selectedId)) {
      setSelectedId(filteredPapers[0].id);
    }
  }, [filteredPapers, selectedId]);

  const selectedPaper = useMemo(() => {
    if (!data) return null;
    const indexPaper = filteredPapers.find((paper) => paper.id === selectedId) ?? filteredPapers[0] ?? data.papers[0] ?? null;
    return indexPaper ? paperDetails[indexPaper.id] || indexPaper : null;
  }, [data, filteredPapers, paperDetails, selectedId]);

  useEffect(() => {
    if (!data || !selectedPaper?.detailPath || selectedPaper.deconstruction || loadedDetailShards.current.has(selectedPaper.detailPath)) {
      return;
    }

    const detailPath = selectedPaper.detailPath;
    setDetailLoadingPath(detailPath);
    setDetailError("");

    fetch(`${assetUrl(detailPath)}?v=${data.generatedAt}`, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("论文详情分片加载失败");
        return response.json();
      })
      .then((payload: { papers?: Paper[] }) => {
        loadedDetailShards.current.add(detailPath);
        setPaperDetails((current) => {
          const next = { ...current };
          (payload.papers || []).forEach((paper) => {
            next[paper.id] = paper;
          });
          return next;
        });
      })
      .catch((error: Error) => setDetailError(error.message))
      .finally(() => setDetailLoadingPath((path) => (path === detailPath ? "" : path)));
  }, [data, selectedPaper]);

  const visiblePapers = filteredPapers.slice(0, displayLimit);

  const topKeywords = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    filteredPapers.forEach((paper) => paper.keywords.forEach((keyword) => counts.set(keyword, (counts.get(keyword) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [data, filteredPapers]);

  const monthsForActiveYear = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.months.filter((item) => activeYear === "all" || item.year === activeYear);
  }, [activeYear, data]);

  const recentTrendMonths = useMemo(() => data?.trends?.monthly.slice(-18) ?? [], [data]);
  const maxTrendCount = Math.max(1, ...recentTrendMonths.map((item) => item.count));
  const activeTrackMeta = data?.tracks.find((track) => track.id === activeTrack);
  const activeTopicMeta = data?.topics?.find((topic) => topic.id === activeTopic);
  const dateRange = data?.dateRange ? `${data.dateRange.from} 至 ${data.dateRange.to}` : "2023 至今";
  const selectedState = selectedPaper ? userState[selectedPaper.id] || {} : {};

  const userStats = useMemo(() => {
    const values = Object.values(userState);
    return {
      favorite: values.filter((item) => item.favorite).length,
      read: values.filter((item) => item.status === "read").length,
      reproduce: values.filter((item) => item.status === "reproduce").length,
    };
  }, [userState]);

  const topicOptions = useMemo(() => {
    return (data?.topics || []).filter((topic) => topic.count > 0).sort((a, b) => b.count - a.count);
  }, [data]);

  const selectedPosition = selectedPaper ? filteredPapers.findIndex((paper) => paper.id === selectedPaper.id) + 1 : 0;
  const pdfCount = useMemo(() => data?.papers.filter((paper) => Boolean(paper.links?.pdf)).length ?? 0, [data]);
  const sourceCount = data?.stats.bySource?.length ?? 0;
  const latestTrend = recentTrendMonths[recentTrendMonths.length - 1];
  const coverageRate = Math.round((pdfCount / Math.max(1, data?.stats.total ?? 1)) * 100);
  const activeFilterCount = [
    activeTrack !== "all",
    activeYear !== "all",
    activeMonth !== "all",
    activeTopic !== "all",
    sourceFilter !== "all",
    statusFilter !== "all",
    query.trim().length > 0,
  ].filter(Boolean).length;

  const qualityPapers = useMemo(() => filteredPapers.filter((paper) => qualityScore(paper) >= 90), [filteredPapers]);
  const reproduceCandidates = useMemo(
    () =>
      filteredPapers.filter(
        (paper) =>
          paper.links?.pdf &&
          ((paper.keywords || []).some((keyword) => /dataset|benchmark|evaluation|training|ranking|retrieval|agent|rag/i.test(keyword)) ||
            qualityScore(paper) >= 88),
      ),
    [filteredPapers],
  );
  const latestPapers = useMemo(() => filteredPapers.slice(0, 12), [filteredPapers]);

  function clearFilters() {
    setActiveTrack("all");
    setActiveYear("all");
    setActiveMonth("all");
    setActiveTopic("all");
    setSourceFilter("all");
    setStatusFilter("all");
    setSortMode("latest");
    setQuery("");
  }

  function setPaperStatus(id: string, status?: UserStatus) {
    setUserState((current) => {
      const next = { ...current };
      const item = { ...(next[id] || {}) };
      if (status) item.status = status;
      else delete item.status;
      if (!item.status && !item.favorite) delete next[id];
      else next[id] = item;
      return next;
    });
  }

  function toggleFavorite(id: string) {
    setUserState((current) => {
      const next = { ...current };
      const item = { ...(next[id] || {}) };
      item.favorite = !item.favorite;
      if (!item.status && !item.favorite) delete next[id];
      else next[id] = item;
      return next;
    });
  }

  function selectAdjacentPaper(offset: number) {
    if (!filteredPapers.length) return;
    const currentIndex = Math.max(0, filteredPapers.findIndex((paper) => paper.id === selectedPaper?.id));
    const nextIndex = Math.min(filteredPapers.length - 1, Math.max(0, currentIndex + offset));
    setSelectedId(filteredPapers[nextIndex].id);
  }

  async function copyCode() {
    if (!selectedPaper?.codeBlueprint) return;
    await navigator.clipboard.writeText(selectedPaper.codeBlueprint.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const insightCards: InsightCard[] = [
    {
      id: "rising",
      label: "趋势主题",
      title: data?.trends?.risingTopics?.[0]?.label || "研究主题",
      meta: data?.trends?.risingTopics?.[0] ? `近月增长 ${data.trends.risingTopics[0].delta >= 0 ? "+" : ""}${data.trends.risingTopics[0].delta}` : "暂无趋势数据",
      icon: <Sparkles size={16} />,
      action: () => {
        const topic = data?.trends?.risingTopics?.[0];
        if (topic) setActiveTopic(topic.id);
      },
    },
    {
      id: "quality",
      label: "高质量优先",
      title: `${formatNumber(qualityPapers.length)} 篇强信号论文`,
      meta: qualityPapers[0] ? compactSummary(qualityPapers[0].title, 58) : "当前筛选下暂无高分论文",
      icon: <BadgeCheck size={16} />,
      action: () => {
        setSortMode("quality");
        if (qualityPapers[0]) setSelectedId(qualityPapers[0].id);
      },
    },
    {
      id: "reproduce",
      label: "复现候选",
      title: `${formatNumber(reproduceCandidates.length)} 篇可落地`,
      meta: reproduceCandidates[0] ? paperSignal(reproduceCandidates[0]) : "优先选择有 PDF 和实验信号的论文",
      icon: <FlaskConical size={16} />,
      action: () => {
        setSourceFilter("pdf");
        setSortMode("quality");
        if (reproduceCandidates[0]) setSelectedId(reproduceCandidates[0].id);
      },
    },
    {
      id: "latest",
      label: "最新队列",
      title: `${latestTrend?.month || "最新"} 更新`,
      meta: latestPapers[0] ? compactSummary(latestPapers[0].title, 58) : "当前筛选暂无论文",
      icon: <Telescope size={16} />,
      action: () => {
        setSortMode("latest");
        if (latestPapers[0]) setSelectedId(latestPapers[0].id);
      },
    },
  ];

  function renderPaperRow(paper: Paper, index: number) {
    if (!data) return null;
    const state = userState[paper.id] || {};
    const topics = paper.topics?.map((id) => data.topics?.find((topic) => topic.id === id)).filter(Boolean) as Topic[];
    const score = Math.min(100, Math.max(0, Math.round(qualityScore(paper))));

    return (
      <article
        className={`paper-row ${selectedPaper?.id === paper.id ? "selected" : ""}`}
        data-testid="paper-row"
        key={paper.id}
        onClick={() => setSelectedId(paper.id)}
        style={{ "--accent": paper.accent, "--score": `${score}%` } as CSSProperties}
      >
        <div className="paper-rank">{String(index + 1).padStart(2, "0")}</div>
        <div className="paper-main">
          <div className="paper-line">
            <span className="track-dot" />
            <span className="track-name">{paper.trackLabel}</span>
            <span>{formatDate(paper.published)}</span>
            <span>{sourceKind(paper)}</span>
          </div>
          <h3>{highlightText(paper.title, query)}</h3>
          <p>{paper.summary}</p>
          <div className="paper-meta-row">
            <span>{authorLine(paper.authors)}</span>
            {topics.slice(0, 3).map((topic) => (
              <button
                key={topic.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveTopic(activeTopic === topic.id ? "all" : topic.id);
                }}
                style={{ "--accent": topic.accent } as CSSProperties}
                type="button"
              >
                {topic.label}
              </button>
            ))}
          </div>
          <div className="paper-signal-row">
            <span>
              <BrainCircuit size={13} />
              {paperSignal(paper)}
            </span>
            <span>
              <Library size={13} />
              {paper.categories.slice(0, 2).join(" / ") || sourceKind(paper)}
            </span>
          </div>
        </div>
        <div className="paper-score" aria-label={`质量 ${score}`}>
          <strong>{score}</strong>
          <span>score</span>
          <i />
        </div>
        <div className="paper-actions">
          <button
            className={state.favorite ? "active" : ""}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(paper.id);
            }}
            type="button"
            title="收藏"
          >
            <Star size={14} />
          </button>
          {statusOptions.slice(0, 4).map((item) => (
            <button
              className={state.status === item.id ? "active" : ""}
              key={item.id}
              onClick={(event) => {
                event.stopPropagation();
                setPaperStatus(paper.id, state.status === item.id ? undefined : item.id);
              }}
              type="button"
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </article>
    );
  }

  function renderDetailContent() {
    if (!selectedPaper) return null;

    if (!selectedPaper.deconstruction || !selectedPaper.codeBlueprint) {
      return (
        <section className="detail-loading">
          <RefreshCcw className={detailLoadingPath ? "spin" : ""} size={18} />
          <h3>{detailError || "正在加载论文拆解"}</h3>
          <p>完整解读、实验检查与代码骨架会随详情分片加载。</p>
        </section>
      );
    }

    if (detailTab === "reproduce") {
      return (
        <>
          <section className="signal-grid">
            <div>
              <h3>方法信号</h3>
              {(selectedPaper.deepDive?.methodSignals || []).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div>
              <h3>数据/指标</h3>
              {[...(selectedPaper.deepDive?.datasetSignals || []), ...(selectedPaper.deepDive?.metricSignals || [])].slice(0, 10).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <h3>
              <FlaskConical size={16} />
              实验检查
            </h3>
            <div className="check-list">
              {selectedPaper.deconstruction.experimentChecklist.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <h3>
              <BookOpenText size={16} />
              复现路径
            </h3>
            <ul>
              {(selectedPaper.deepDive?.reproducePlan || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="quality-box">
            <h3>质量依据</h3>
            {(selectedPaper.quality?.reasons || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </section>
        </>
      );
    }

    if (detailTab === "code") {
      return (
        <section className="code-panel">
          <div className="code-head">
            <h3>
              <Code2 size={16} />
              {selectedPaper.codeBlueprint.title}
            </h3>
            <button onClick={copyCode} type="button">
              <Copy size={15} />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <p>{selectedPaper.codeBlueprint.note}</p>
          <pre>
            <code>{selectedPaper.codeBlueprint.code}</code>
          </pre>
        </section>
      );
    }

    if (detailTab === "meta") {
      return (
        <>
          <section className="detail-section">
            <h3>
              <FileText size={16} />
              摘要
            </h3>
            <p>{selectedPaper.summary}</p>
          </section>

          <section className="meta-grid">
            <div>
              <span>来源</span>
              <b>{selectedPaper.source || data?.source || "OpenAlex"}</b>
            </div>
            <div>
              <span>分类</span>
              <b>{selectedPaper.categories.slice(0, 4).join(" / ") || "-"}</b>
            </div>
            <div>
              <span>相关性</span>
              <b>{selectedPaper.coreRelevanceScore ?? selectedPaper.relevanceScore ?? "-"}</b>
            </div>
            <div>
              <span>更新</span>
              <b>{formatDate(selectedPaper.updated)}</b>
            </div>
          </section>

          <div className="link-row detail-link-row">
            {selectedPaper.links.abstract && (
              <a href={selectedPaper.links.abstract} target="_blank" rel="noreferrer">
                摘要
                <ArrowUpRight size={15} />
              </a>
            )}
            {selectedPaper.links.pdf && (
              <a href={selectedPaper.links.pdf} target="_blank" rel="noreferrer">
                PDF
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        <section className="takeaway-panel">
          <div className="takeaway-head">
            <span>
              <BrainCircuit size={16} />
              核心拆解
            </span>
            <b>{selectedPaper.quality?.level || "观察"}质量</b>
          </div>
          <div className="takeaway-grid">
            <article>
              <span>问题定义</span>
              <p>{selectedPaper.deconstruction.problem}</p>
            </article>
            <article>
              <span>方法路径</span>
              <p>{selectedPaper.deconstruction.method}</p>
            </article>
          </div>
        </section>

        <section className="detail-section">
          <h3>
            <Zap size={16} />
            关键贡献
          </h3>
          <div className="contribution-list">
            {selectedPaper.deconstruction.contributions.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <h3>
            <BadgeCheck size={16} />
            工程价值
          </h3>
          <p>{selectedPaper.deconstruction.engineeringUse}</p>
        </section>
      </>
    );
  }

  if (loadError) {
    return (
      <main className="empty-state">
        <BookOpenText size={38} />
        <h1>Paper Intelligence Hub</h1>
        <p>{loadError}</p>
        <code>cd paper-intelligence-hub && npm install && npm run fetch:papers && npm run dev</code>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="empty-state">
        <RefreshCcw className="spin" size={38} />
        <h1>正在载入论文库</h1>
      </main>
    );
  }

  const exportLinks = [
    { label: "JSON", path: data.exports?.json || "data/papers.json", icon: <FileJson size={15} /> },
    { label: "CSV", path: data.exports?.csv || "data/exports/papers.csv", icon: <Database size={15} /> },
    { label: "BibTeX", path: data.exports?.bibtex || "data/exports/papers.bib", icon: <FileText size={15} /> },
    { label: "周报", path: data.exports?.weekly || "data/exports/weekly.md", icon: <Download size={15} /> },
  ];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-row">
          <div className="brand-mark">
            <BookOpenText size={24} />
          </div>
          <div>
            <p>Paper Intelligence Hub</p>
            <h1>推荐 · 搜索广告 · 大模型研究工作台</h1>
            <div className="brand-subline">
              <span>
                <CalendarClock size={15} />
                {formatTime(data.generatedAt)}
              </span>
              <span>{dateRange}</span>
              <span>{formatNumber(data.stats.uniqueTotal || data.stats.rawFetched || data.stats.total)} 候选去重</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <div className="sync-card">
            <span>自动更新</span>
            <strong>{data.mode === "augment" ? "已增强" : "增量同步"}</strong>
            <em>{data.detailShards?.length ?? 0} 个详情分片</em>
          </div>
          <div className="export-row">
            {exportLinks.map((item) => (
              <a href={assetUrl(item.path)} key={item.label} target="_blank" rel="noreferrer">
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <section className="research-console" data-testid="metric-strip">
        <div className="console-main">
          <div className="console-kicker">
            <Command size={15} />
            Research Command Center
          </div>
          <div className="console-title-row">
            <strong>{formatNumber(filteredPapers.length)}</strong>
            <div>
              <span>当前可读论文</span>
              <p>
                {activeFilterCount ? `${activeFilterCount} 个筛选条件` : "全库视图"} / {dateRange}
              </p>
            </div>
          </div>
          <div className="console-metrics">
            <div>
              <span>总论文</span>
              <b>{formatNumber(data.stats.total)}</b>
            </div>
            <div>
              <span>PDF 覆盖</span>
              <b>{coverageRate}%</b>
            </div>
            <div>
              <span>数据源</span>
              <b>{formatNumber(sourceCount)}</b>
            </div>
            <div>
              <span>详情分片</span>
              <b>{formatNumber(data.detailShards?.length ?? 0)}</b>
            </div>
          </div>
        </div>

        <div className="track-lane">
          <div className="lane-head">
            <span>
              <SlidersHorizontal size={15} />
              方向筛选
            </span>
            <button className={statusFilter === "favorite" ? "active" : ""} onClick={() => setStatusFilter(statusFilter === "favorite" ? "all" : "favorite")} type="button">
              <Star size={14} />
              收藏 {formatNumber(userStats.favorite)}
            </button>
          </div>
          <div className="track-pills">
            <button className={activeTrack === "all" ? "active" : ""} onClick={() => setActiveTrack("all")} type="button">
              <span>全部方向</span>
              <b>{formatNumber(data.stats.total)}</b>
              <i style={{ width: "100%" }} />
            </button>
            {data.stats.byTrack.map((item) => {
              const track = data.tracks.find((trackItem) => trackItem.id === item.id);
              return (
                <button
                  className={activeTrack === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setActiveTrack(activeTrack === item.id ? "all" : item.id)}
                  style={{ "--accent": track?.accent || "#2f7d67", "--share": `${Math.max(8, (item.count / data.stats.total) * 100)}%` } as CSSProperties}
                  type="button"
                >
                  <span>{item.label}</span>
                  <b>{formatNumber(item.count)}</b>
                  <i />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="insight-digest" aria-label="研究洞察摘要">
        <div className="digest-title">
          <Compass size={17} />
          <div>
            <span>今日研究优先级</span>
            <b>从 {formatNumber(filteredPapers.length)} 篇匹配结果中自动提炼</b>
          </div>
        </div>
        <div className="digest-grid">
          {insightCards.map((item) => (
            <button className="digest-card" key={item.id} onClick={item.action} type="button">
              <span>
                {item.icon}
                {item.label}
              </span>
              <strong>{item.title}</strong>
              <em>{item.meta}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="control-bar">
        <div className="searchbox">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者、关键词、来源、摘要" />
        </div>
        <label className="selectbox">
          <ArrowDownAZ size={16} />
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="latest">按时间</option>
            <option value="quality">按质量</option>
            <option value="relevance">按相关性</option>
            <option value="title">按标题</option>
          </select>
        </label>
        <label className="selectbox">
          <ListFilter size={16} />
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
            <option value="all">全部来源</option>
            <option value="pdf">有 PDF</option>
            <option value="arxiv">arXiv</option>
            <option value="openalex">其他来源</option>
          </select>
        </label>
        <label className="selectbox">
          <BookMarked size={16} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">全部状态</option>
            <option value="favorite">收藏</option>
            {statusOptions.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="active-context">
          <Target size={16} />
          <span>{activeTrackMeta?.label || "全方向"}</span>
          {activeTopicMeta && <span>{activeTopicMeta.label}</span>}
          {activeYear !== "all" && <span>{activeYear}</span>}
          {activeMonth !== "all" && <span>{monthLabel(activeMonth)}</span>}
        </div>
        <button className="ghost-button" onClick={clearFilters} type="button">
          <X size={16} />
          重置
        </button>
      </section>

      <section className="workspace-grid">
        <aside className="insight-panel">
          <div className="panel-card scope-card">
            <div className="panel-title compact">
              <Gauge size={16} />
              当前视图
            </div>
            <strong>{formatNumber(filteredPapers.length)} 篇</strong>
            <p>
              {activeTrackMeta?.label || "全部方向"}
              {activeTopicMeta ? ` / ${activeTopicMeta.label}` : ""}
              {latestTrend ? ` / 最新月 ${latestTrend.month}` : ""}
            </p>
            <div className="scope-meta">
              <span>已读 {formatNumber(userStats.read)}</span>
              <span>复现 {formatNumber(userStats.reproduce)}</span>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title">
              <CalendarDays size={18} />
              时间线
            </div>
            <button
              className={`timeline-all ${activeYear === "all" && activeMonth === "all" ? "active" : ""}`}
              onClick={() => {
                setActiveYear("all");
                setActiveMonth("all");
              }}
              type="button"
            >
              <span>全部年份</span>
              <b>{formatNumber(data.stats.total)}</b>
            </button>
            <div className="year-list">
              {data.timeline?.years.map((item) => (
                <button
                  className={`year-row ${activeYear === item.year ? "active" : ""}`}
                  key={item.year}
                  onClick={() => {
                    setActiveYear(item.year);
                    setActiveMonth("all");
                  }}
                  type="button"
                >
                  <span>{item.year}</span>
                  <i style={{ width: `${Math.max(8, (item.count / data.stats.total) * 100)}%` }} />
                  <b>{formatNumber(item.count)}</b>
                </button>
              ))}
            </div>
            <div className="month-list">
              {monthsForActiveYear.slice(0, activeYear === "all" ? 18 : 14).map((item) => (
                <button
                  className={`month-row ${activeMonth === item.month ? "active" : ""}`}
                  key={item.month}
                  onClick={() => {
                    setActiveYear(item.year);
                    setActiveMonth(item.month);
                  }}
                  type="button"
                >
                  <span>{item.year === activeYear ? monthLabel(item.month) : item.month}</span>
                  <b>{formatNumber(item.count)}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-card topic-panel">
            <div className="panel-title compact">
              <Layers3 size={16} />
              研究主题
            </div>
            <button className={`topic-chip ${activeTopic === "all" ? "active" : ""}`} onClick={() => setActiveTopic("all")} type="button">
              全部主题
              <b>{formatNumber(data.stats.total)}</b>
            </button>
            {topicOptions.map((topic) => (
              <button
                className={`topic-chip ${activeTopic === topic.id ? "active" : ""}`}
                key={topic.id}
                onClick={() => setActiveTopic(activeTopic === topic.id ? "all" : topic.id)}
                style={{ "--accent": topic.accent } as CSSProperties}
                type="button"
              >
                {topic.label}
                <b>{formatNumber(topic.count)}</b>
              </button>
            ))}
          </div>

          <div className="panel-card trend-panel">
            <div className="panel-title compact">
              <LineChart size={16} />
              近 18 个月趋势
            </div>
            <div className="trend-bars">
              {recentTrendMonths.map((item) => (
                <button
                  className={`trend-bar ${activeMonth === item.month ? "active" : ""}`}
                  key={item.month}
                  onClick={() => {
                    setActiveYear(item.month.slice(0, 4));
                    setActiveMonth(item.month);
                  }}
                  type="button"
                  title={`${item.month}: ${item.count}`}
                >
                  <i style={{ height: `${Math.max(12, (item.count / maxTrendCount) * 100)}%` }} />
                  <span>{item.month.slice(5)}</span>
                </button>
              ))}
            </div>
            <div className="rising-list">
              {data.trends?.risingTopics.slice(0, 5).map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setActiveTopic(topic.id)}
                  style={{ "--accent": topic.accent } as CSSProperties}
                  type="button"
                >
                  <span>{topic.label}</span>
                  <b>{topic.delta >= 0 ? `+${topic.delta}` : topic.delta}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-card keyword-box">
            <div className="panel-title compact">
              <Sparkles size={16} />
              当前热点
            </div>
            {topKeywords.map(([keyword, count]) => (
              <button key={keyword} onClick={() => setQuery(keyword)} type="button">
                {keyword}
                <b>{count}</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="paper-board">
          <div className="board-head">
            <div>
              <p>Research Queue</p>
              <h2>{formatNumber(filteredPapers.length)} 篇匹配论文</h2>
            </div>
            <div className="board-count">
              <Rows3 size={15} />
              显示 {formatNumber(visiblePapers.length)} / {formatNumber(filteredPapers.length)}
            </div>
          </div>

          {visiblePapers.length === 0 ? <div className="empty-list">没有匹配的论文</div> : <div className="paper-list">{visiblePapers.map(renderPaperRow)}</div>}

          {filteredPapers.length > displayLimit && (
            <button className="load-more" onClick={() => setDisplayLimit((value) => value + 180)} type="button">
              加载更多
            </button>
          )}
        </section>

        {selectedPaper && (
          <aside className="detail-panel" data-testid="detail-panel" style={{ "--accent": selectedPaper.accent } as CSSProperties}>
            <div className="detail-head">
              <div className="detail-kicker">
                <span className="track-label">{selectedPaper.trackLabel}</span>
                <span className="quality-pill">
                  质量 {selectedPaper.quality?.score ?? "-"} · {selectedPaper.quality?.level || "观察"}
                </span>
              </div>
              <h2>{selectedPaper.title}</h2>
              <p>{authorLine(selectedPaper.authors)}</p>
              <div className="detail-meta">
                <span>{formatDate(selectedPaper.published)}</span>
                <span>{sourceKind(selectedPaper)}</span>
                <span>#{selectedPosition || "-"}</span>
              </div>
              <div className="detail-progress" style={{ "--score": `${Math.min(100, Math.round(qualityScore(selectedPaper)))}%` } as CSSProperties}>
                <span>质量信号</span>
                <i />
              </div>
              <div className="detail-actions">
                <button className={selectedState.favorite ? "active" : ""} onClick={() => toggleFavorite(selectedPaper.id)} type="button">
                  <Star size={15} />
                  {selectedState.favorite ? "已收藏" : "收藏"}
                </button>
                <select
                  value={selectedState.status || ""}
                  onChange={(event) => setPaperStatus(selectedPaper.id, (event.target.value || undefined) as UserStatus | undefined)}
                >
                  <option value="">未标记</option>
                  {statusOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="reader-toolbar">
                <button disabled={selectedPosition <= 1} onClick={() => selectAdjacentPaper(-1)} type="button">
                  <ChevronLeft size={15} />
                  上一篇
                </button>
                <span>
                  {formatNumber(selectedPosition || 0)} / {formatNumber(filteredPapers.length)}
                </span>
                <button disabled={selectedPosition >= filteredPapers.length} onClick={() => selectAdjacentPaper(1)} type="button">
                  下一篇
                  <ChevronRight size={15} />
                </button>
                {selectedPaper.links.abstract && (
                  <a href={selectedPaper.links.abstract} target="_blank" rel="noreferrer">
                    摘要
                    <ArrowUpRight size={15} />
                  </a>
                )}
                {selectedPaper.links.pdf && (
                  <a href={selectedPaper.links.pdf} target="_blank" rel="noreferrer">
                    PDF
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            </div>

            <div className="keyword-row">
              {selectedPaper.keywords.map((keyword) => (
                <button key={keyword} onClick={() => setQuery(keyword)} type="button">
                  {keyword}
                </button>
              ))}
            </div>

            <div className="detail-tabs">
              {detailTabs.map((item) => (
                <button className={detailTab === item.id ? "active" : ""} key={item.id} onClick={() => setDetailTab(item.id)} type="button">
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="detail-body">{renderDetailContent()}</div>
          </aside>
        )}
      </section>

      {data.stats.errors.length > 0 && (
        <div className="warning">
          部分查询失败：{data.stats.errors.slice(0, 5).map((error) => `${error.track}/${error.source || "source"}`).join("、")}
        </div>
      )}
    </main>
  );
}

export default App;
