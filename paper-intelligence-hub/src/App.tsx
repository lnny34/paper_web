import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownAZ,
  ArrowUpRight,
  BarChart3,
  BookMarked,
  BookOpenText,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  Eye,
  FileJson,
  FileText,
  FlaskConical,
  GitBranch,
  Layers3,
  ListFilter,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
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
  source?: string;
  relevanceScore?: number;
  coreRelevanceScore?: number;
  links: {
    abstract: string;
    pdf: string;
  };
  deconstruction: {
    problem: string;
    method: string;
    contributions: string[];
    experimentChecklist: string[];
    engineeringUse: string;
  };
  codeBlueprint: {
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
  };
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

type UserStatus = "todo" | "reading" | "read" | "reproduce" | "ignored";

type PaperUserState = {
  status?: UserStatus;
  favorite?: boolean;
};

type SortMode = "latest" | "quality" | "relevance" | "title";
type SourceFilter = "all" | "pdf" | "arxiv" | "openalex";
type StatusFilter = "all" | "favorite" | UserStatus;

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

const statusOptions: { id: UserStatus; label: string; icon: ReactNode }[] = [
  { id: "todo", label: "待读", icon: <BookMarked size={14} /> },
  { id: "reading", label: "在读", icon: <Eye size={14} /> },
  { id: "read", label: "已读", icon: <CheckCircle2 size={14} /> },
  { id: "reproduce", label: "复现", icon: <Wrench size={14} /> },
  { id: "ignored", label: "忽略", icon: <X size={14} /> },
];

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
  const [displayLimit, setDisplayLimit] = useState(180);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [userState, setUserState] = useState<Record<string, PaperUserState>>({});

  useEffect(() => {
    fetch(`${baseUrl}data/papers.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("论文数据尚未生成，请先运行 npm run fetch:papers");
        return response.json();
      })
      .then((payload: PaperData) => {
        setData(payload);
        setSelectedId(payload.papers[0]?.id ?? null);
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
    return filteredPapers.find((paper) => paper.id === selectedId) ?? filteredPapers[0] ?? data.papers[0] ?? null;
  }, [data, filteredPapers, selectedId]);

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

  async function copyCode() {
    if (!selectedPaper) return;
    await navigator.clipboard.writeText(selectedPaper.codeBlueprint.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
            <h1>推荐、搜索广告与大模型论文库</h1>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-meta">
            <span>
              <CalendarClock size={16} />
              {formatTime(data.generatedAt)}
            </span>
            <span>{dateRange}</span>
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

      <section className="stat-strip">
        <div className="stat-cell primary">
          <span>论文库</span>
          <strong>{data.stats.total}</strong>
          <em>覆盖 2023 至今</em>
        </div>
        <div className="stat-cell">
          <span>候选抓取</span>
          <strong>{data.stats.rawFetched ?? data.stats.total}</strong>
          <em>{data.stats.networkFetched ? `本次新增候选 ${data.stats.networkFetched}` : "OpenAlex 聚合"}</em>
        </div>
        <div className="stat-cell">
          <span>主题</span>
          <strong>{data.topics?.filter((topic) => topic.count > 0).length ?? 0}</strong>
          <em>自动归类</em>
        </div>
        <button className={`stat-cell track-stat ${statusFilter === "favorite" ? "active" : ""}`} onClick={() => setStatusFilter("favorite")} type="button">
          <span>收藏</span>
          <strong>{userStats.favorite}</strong>
          <em>本地标记</em>
        </button>
        {data.stats.byTrack.map((item) => (
          <button
            className={`stat-cell track-stat ${activeTrack === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => setActiveTrack(activeTrack === item.id ? "all" : item.id)}
            type="button"
          >
            <span>{item.label}</span>
            <strong>{item.count}</strong>
            <em>方向论文</em>
          </button>
        ))}
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
          {activeTrackMeta?.label || "全方向"}
          {activeTopicMeta ? ` · ${activeTopicMeta.label}` : ""}
          {activeYear !== "all" ? ` · ${activeYear}` : ""}
          {activeMonth !== "all" ? ` · ${monthLabel(activeMonth)}` : ""}
        </div>
        <button className="ghost-button" onClick={clearFilters} type="button">
          <X size={16} />
          重置
        </button>
      </section>

      <section className="workspace-grid">
        <aside className="insight-panel">
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
            <b>{data.stats.total}</b>
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
                <b>{item.count}</b>
              </button>
            ))}
          </div>
          <div className="month-list">
            {monthsForActiveYear.slice(0, activeYear === "all" ? 20 : 14).map((item) => (
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
                <b>{item.count}</b>
              </button>
            ))}
          </div>

          <div className="topic-panel">
            <div className="panel-title compact">
              <Layers3 size={16} />
              研究主题
            </div>
            <button className={`topic-chip ${activeTopic === "all" ? "active" : ""}`} onClick={() => setActiveTopic("all")} type="button">
              全部主题
              <b>{data.stats.total}</b>
            </button>
            {data.topics
              ?.filter((topic) => topic.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((topic) => (
                <button
                  className={`topic-chip ${activeTopic === topic.id ? "active" : ""}`}
                  key={topic.id}
                  onClick={() => setActiveTopic(activeTopic === topic.id ? "all" : topic.id)}
                  style={{ "--accent": topic.accent } as CSSProperties}
                  type="button"
                >
                  {topic.label}
                  <b>{topic.count}</b>
                </button>
              ))}
          </div>

          <div className="trend-panel">
            <div className="panel-title compact">
              <BarChart3 size={16} />
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

          <div className="keyword-box">
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

        <div className="content-grid">
          <section className="paper-board">
            <div className="board-head">
              <div>
                <p>论文矩阵</p>
                <h2>{filteredPapers.length} 篇匹配论文</h2>
              </div>
              <div className="board-count">
                显示 {visiblePapers.length} / {filteredPapers.length}
              </div>
            </div>

            {visiblePapers.length === 0 ? (
              <div className="empty-list">没有匹配的论文</div>
            ) : (
              <div className="paper-grid">
                {visiblePapers.map((paper) => {
                  const state = userState[paper.id] || {};
                  const topics = paper.topics?.map((id) => data.topics?.find((topic) => topic.id === id)).filter(Boolean) as Topic[];
                  return (
                    <article
                      className={`paper-card ${selectedPaper?.id === paper.id ? "selected" : ""}`}
                      key={paper.id}
                      onClick={() => setSelectedId(paper.id)}
                      style={{ "--accent": paper.accent } as CSSProperties}
                    >
                      <div className="paper-card-top">
                        <span>{paper.trackLabel}</span>
                        <b>{formatDate(paper.published)}</b>
                      </div>
                      <h3>{highlightText(paper.title, query)}</h3>
                      <p>{paper.summary}</p>
                      <div className="mini-topic-row">
                        {topics.slice(0, 3).map((topic) => (
                          <span key={topic.id} style={{ "--accent": topic.accent } as CSSProperties}>
                            {topic.label}
                          </span>
                        ))}
                      </div>
                      <div className="paper-foot">
                        <span>{paper.source || "OpenAlex"}</span>
                        <span>质量 {paper.quality?.score ?? "-"}</span>
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
                })}
              </div>
            )}

            {filteredPapers.length > displayLimit && (
              <button className="load-more" onClick={() => setDisplayLimit((value) => value + 180)} type="button">
                加载更多
              </button>
            )}
          </section>

          {selectedPaper && (
            <aside className="detail-panel" style={{ "--accent": selectedPaper.accent } as CSSProperties}>
              <div className="detail-head">
                <div className="detail-kicker">
                  <span className="track-label">{selectedPaper.trackLabel}</span>
                  <span className="quality-pill">质量 {selectedPaper.quality?.score ?? "-"} · {selectedPaper.quality?.level || "观察"}</span>
                </div>
                <h2>{selectedPaper.title}</h2>
                <p>{selectedPaper.authors.slice(0, 8).join(", ") || "Unknown authors"}</p>
                <div className="detail-meta">
                  <span>{formatDate(selectedPaper.published)}</span>
                  <span>{selectedPaper.source || data.source}</span>
                  <span>已读 {userStats.read}</span>
                  <span>复现 {userStats.reproduce}</span>
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
                <div className="link-row">
                  <a href={selectedPaper.links.abstract} target="_blank" rel="noreferrer">
                    摘要
                    <ArrowUpRight size={15} />
                  </a>
                  <a href={selectedPaper.links.pdf} target="_blank" rel="noreferrer">
                    PDF
                    <ArrowUpRight size={15} />
                  </a>
                </div>
              </div>

              <div className="keyword-row">
                {selectedPaper.keywords.map((keyword) => (
                  <button key={keyword} onClick={() => setQuery(keyword)} type="button">
                    {keyword}
                  </button>
                ))}
              </div>

              <section className="detail-section">
                <h3>
                  <Target size={16} />
                  问题
                </h3>
                <p>{selectedPaper.deconstruction.problem}</p>
              </section>

              <section className="detail-section">
                <h3>
                  <GitBranch size={16} />
                  方法
                </h3>
                <p>{selectedPaper.deconstruction.method}</p>
              </section>

              <section className="detail-section">
                <h3>
                  <Zap size={16} />
                  贡献
                </h3>
                <ul>
                  {selectedPaper.deconstruction.contributions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="signal-grid">
                <div>
                  <h3>方法信号</h3>
                  {(selectedPaper.deepDive?.methodSignals || []).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div>
                  <h3>数据/指标</h3>
                  {[...(selectedPaper.deepDive?.datasetSignals || []), ...(selectedPaper.deepDive?.metricSignals || [])].slice(0, 8).map((item) => (
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
            </aside>
          )}
        </div>
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
