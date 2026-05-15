import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  CalendarClock,
  Code2,
  Copy,
  FlaskConical,
  GitBranch,
  Layers3,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";

type Track = {
  id: string;
  label: string;
  accent: string;
  openAlexQueries?: string[];
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
  source?: string;
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

type PaperData = {
  generatedAt: string;
  source: string;
  dateRange?: {
    from: string;
    to: string;
  };
  tracks: Track[];
  timeline?: {
    years: TimelineYear[];
    months: TimelineMonth[];
  };
  stats: {
    total: number;
    rawFetched?: number;
    uniqueTotal?: number;
    outputLimit?: number;
    perTrackLimit?: number;
    byTrack: { id: string; label: string; count: number }[];
    bySource?: { source: string; count: number }[];
    errors: { track: string; source?: string; query?: string; message: string }[];
  };
  papers: Paper[];
};

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

function formatDate(value?: string) {
  if (!value) return "-";
  return dateFormatter.format(new Date(value));
}

function formatTime(value?: string) {
  if (!value) return "-";
  return timeFormatter.format(new Date(value));
}

function getYear(value: string) {
  return String(new Date(value).getFullYear());
}

function getMonth(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [, month] = value.split("-");
  return `${Number(month)}月`;
}

function App() {
  const [data, setData] = useState<PaperData | null>(null);
  const [activeTrack, setActiveTrack] = useState("all");
  const [activeYear, setActiveYear] = useState("all");
  const [activeMonth, setActiveMonth] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(240);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/papers.json?v=${Date.now()}`, { cache: "no-store" })
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
    setDisplayLimit(240);
  }, [activeTrack, activeYear, activeMonth, query]);

  const filteredPapers = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();

    return data.papers.filter((paper) => {
      const year = paper.year || getYear(paper.published);
      const month = paper.month || getMonth(paper.published);
      const inTrack = activeTrack === "all" || paper.track === activeTrack;
      const inYear = activeYear === "all" || year === activeYear;
      const inMonth = activeMonth === "all" || month === activeMonth;
      const inText =
        !needle ||
        [paper.title, paper.summary, paper.trackLabel, paper.authors.join(" "), paper.keywords.join(" "), paper.source || ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return inTrack && inYear && inMonth && inText;
    });
  }, [activeMonth, activeTrack, activeYear, data, query]);

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
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [data, filteredPapers]);

  const monthsForActiveYear = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.months.filter((item) => activeYear === "all" || item.year === activeYear);
  }, [activeYear, data]);

  const activeTrackMeta = data?.tracks.find((track) => track.id === activeTrack);
  const dateRange = data?.dateRange ? `${data.dateRange.from} 至 ${data.dateRange.to}` : "2023 至今";

  async function copyCode() {
    if (!selectedPaper) return;
    await navigator.clipboard.writeText(selectedPaper.codeBlueprint.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function clearFilters() {
    setActiveTrack("all");
    setActiveYear("all");
    setActiveMonth("all");
    setQuery("");
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-row">
          <div className="brand-mark">
            <BookOpenText size={24} />
          </div>
          <div>
            <p>Paper Intelligence Hub</p>
            <h1>推荐、搜索广告与大模型论文时间线</h1>
          </div>
        </div>
        <div className="header-meta">
          <span>
            <CalendarClock size={16} />
            {formatTime(data.generatedAt)}
          </span>
          <span>{dateRange}</span>
        </div>
      </header>

      <section className="stat-strip">
        <div className="stat-cell primary">
          <span>论文库</span>
          <strong>{data.stats.total}</strong>
          <em>已入库论文</em>
        </div>
        <div className="stat-cell">
          <span>候选</span>
          <strong>{data.stats.rawFetched ?? data.stats.total}</strong>
          <em>跨主题抓取</em>
        </div>
        <div className="stat-cell">
          <span>去重</span>
          <strong>{data.stats.uniqueTotal ?? data.stats.total}</strong>
          <em>标题/DOI 合并</em>
        </div>
        <div className="stat-cell">
          <span>时间</span>
          <strong>{data.timeline?.years.length ?? 0}</strong>
          <em>年份覆盖</em>
        </div>
        {data.stats.byTrack.map((item) => (
          <button
            className={`stat-cell track-stat ${activeTrack === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => setActiveTrack(item.id)}
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者、关键词、来源" />
        </div>
        <div className="active-context">
          <Target size={16} />
          {activeTrackMeta?.label || "全方向"}
          {activeYear !== "all" ? ` · ${activeYear}` : ""}
          {activeMonth !== "all" ? ` · ${monthLabel(activeMonth)}` : ""}
        </div>
        <button className="ghost-button" onClick={clearFilters} type="button">
          <X size={16} />
          重置
        </button>
      </section>

      <section className="main-grid">
        <aside className="timeline-panel">
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
            {monthsForActiveYear.slice(0, activeYear === "all" ? 18 : 12).map((item) => (
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
          <div className="keyword-box">
            <div className="panel-title compact">
              <Sparkles size={16} />
              当前热点
            </div>
            {topKeywords.map(([keyword, count]) => (
              <span key={keyword}>
                {keyword}
                <b>{count}</b>
              </span>
            ))}
          </div>
        </aside>

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
              {visiblePapers.map((paper) => (
                <button
                  className={`paper-card ${selectedPaper?.id === paper.id ? "selected" : ""}`}
                  key={paper.id}
                  onClick={() => setSelectedId(paper.id)}
                  style={{ "--accent": paper.accent } as React.CSSProperties}
                  type="button"
                >
                  <div className="paper-card-top">
                    <span>{paper.trackLabel}</span>
                    <b>{formatDate(paper.published)}</b>
                  </div>
                  <h3>{paper.title}</h3>
                  <p>{paper.summary}</p>
                  <div className="paper-foot">
                    <span>{paper.source || "OpenAlex"}</span>
                    <span>{paper.authors.slice(0, 2).join(", ") || "Unknown"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredPapers.length > displayLimit && (
            <button className="load-more" onClick={() => setDisplayLimit((value) => value + 240)} type="button">
              加载更多
            </button>
          )}
        </section>

        {selectedPaper && (
          <aside className="detail-panel" style={{ "--accent": selectedPaper.accent } as React.CSSProperties}>
            <div className="detail-head">
              <span className="track-label">{selectedPaper.trackLabel}</span>
              <h2>{selectedPaper.title}</h2>
              <p>{selectedPaper.authors.slice(0, 8).join(", ") || "Unknown authors"}</p>
              <div className="detail-meta">
                <span>{formatDate(selectedPaper.published)}</span>
                <span>{selectedPaper.source || data.source}</span>
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
                <span key={keyword}>{keyword}</span>
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
