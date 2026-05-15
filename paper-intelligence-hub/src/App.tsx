import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
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
  Zap,
} from "lucide-react";

type Track = {
  id: string;
  label: string;
  accent: string;
  query?: string;
  openAlexQueries?: string[];
  lookbackDays?: number;
};

type Paper = {
  id: string;
  title: string;
  authors: string[];
  published: string;
  updated: string;
  summary: string;
  track: string;
  trackLabel: string;
  accent: string;
  categories: string[];
  keywords: string[];
  links: {
    abstract: string;
    pdf: string;
  };
  source?: string;
  relevanceScore?: number;
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

type PaperData = {
  generatedAt: string;
  source: string;
  focus: string[];
  tracks: Track[];
  stats: {
    total: number;
    rawFetched?: number;
    uniqueTotal?: number;
    perTrackQuota?: number;
    byTrack: { id: string; label: string; count: number }[];
    errors: { track: string; source?: string; query?: string; message: string }[];
  };
  papers: Paper[];
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(value: string) {
  if (!value) return "-";
  return dateFormatter.format(new Date(value));
}

function shortDate(value: string) {
  if (!value) return "-";
  return dayFormatter.format(new Date(value));
}

function App() {
  const [data, setData] = useState<PaperData | null>(null);
  const [activeTrack, setActiveTrack] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/papers.json`, { cache: "no-store" })
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

  const filteredPapers = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.papers.filter((paper) => {
      const inTrack = activeTrack === "all" || paper.track === activeTrack;
      const inText =
        !needle ||
        [paper.title, paper.summary, paper.trackLabel, paper.authors.join(" "), paper.keywords.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return inTrack && inText;
    });
  }, [activeTrack, data, query]);

  const selectedPaper = useMemo(() => {
    if (!data) return null;
    return filteredPapers.find((paper) => paper.id === selectedId) ?? filteredPapers[0] ?? data.papers[0] ?? null;
  }, [data, filteredPapers, selectedId]);

  const topKeywords = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    data.papers.forEach((paper) => paper.keywords.forEach((keyword) => counts.set(keyword, (counts.get(keyword) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [data]);

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

  const activeTrackMeta = data.tracks.find((track) => track.id === activeTrack);
  const newestDate = data.papers[0]?.published;

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            推荐 · 搜索广告 · 大模型
          </div>
          <h1>Paper Intelligence Hub</h1>
          <p>
            今日覆盖 {data.stats.total} 篇论文，来自 {data.stats.uniqueTotal ?? data.stats.total} 篇去重候选，重点追踪推荐、搜索广告、LLM 和交叉方向。
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={selectedPaper?.links.pdf || selectedPaper?.links.abstract} target="_blank" rel="noreferrer">
              打开最新论文
              <ArrowUpRight size={17} />
            </a>
            <div className="timestamp">
              <CalendarClock size={17} />
              更新 {formatDate(data.generatedAt)}
            </div>
            {newestDate && <div className="timestamp">最新 {shortDate(newestDate)}</div>}
          </div>
        </div>

        <div className="radar" aria-label="paper radar">
          <div className="radar-grid" />
          <div className="pulse p1" />
          <div className="pulse p2" />
          <div className="radar-core">
            <strong>{data.stats.total}</strong>
            <span>papers</span>
          </div>
          {data.stats.byTrack.map((item, index) => (
            <div
              className={`radar-node n${index + 1}`}
              key={item.id}
              style={{ "--node-size": `${Math.min(116, Math.max(54, Math.sqrt(item.count) * 14))}px` } as React.CSSProperties}
            >
              <span>{item.label}</span>
              <b>{item.count}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="metric-row">
        {data.stats.byTrack.map((item) => (
          <button
            className={`metric ${activeTrack === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => setActiveTrack(item.id)}
            type="button"
          >
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
        <button className={`metric ${activeTrack === "all" ? "active" : ""}`} onClick={() => setActiveTrack("all")} type="button">
          <span>全部</span>
          <strong>{data.stats.total}</strong>
        </button>
      </section>

      <section className="toolbar">
        <div className="searchbox">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者、关键词" />
        </div>
        <div className="context-pill">
          <Target size={16} />
          {activeTrackMeta ? activeTrackMeta.label : "全主题"}
        </div>
      </section>

      <section className="workspace">
        <aside className="paper-list">
          <div className="section-title">
            <span>
              <Layers3 size={18} />
              最新论文
            </span>
            <b>{filteredPapers.length}</b>
          </div>
          {filteredPapers.length === 0 && <div className="empty-list">没有匹配的论文</div>}
          {filteredPapers.map((paper) => (
            <button
              className={`paper-card ${selectedPaper?.id === paper.id ? "selected" : ""}`}
              key={paper.id}
              onClick={() => setSelectedId(paper.id)}
              style={{ "--accent": paper.accent } as React.CSSProperties}
              type="button"
            >
              <span className="track-label">{paper.trackLabel}</span>
              <h2>{paper.title}</h2>
              <p>{paper.authors.slice(0, 4).join(", ") || "Unknown authors"}</p>
              <div className="card-meta">
                <span>{shortDate(paper.published)}</span>
                <span>{paper.source || paper.categories.slice(0, 1).join(" · ")}</span>
              </div>
            </button>
          ))}
        </aside>

        {selectedPaper && (
          <article className="detail" style={{ "--accent": selectedPaper.accent } as React.CSSProperties}>
            <div className="detail-head">
              <div>
                <span className="track-label">{selectedPaper.trackLabel}</span>
                <h2>{selectedPaper.title}</h2>
                <p>{selectedPaper.authors.slice(0, 8).join(", ") || "Unknown authors"}</p>
                <div className="detail-meta">
                  <span>{shortDate(selectedPaper.published)}</span>
                  <span>{selectedPaper.source || data.source}</span>
                  <span>{selectedPaper.categories.slice(0, 3).join(" · ") || "Research paper"}</span>
                </div>
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

            <div className="insight-grid">
              <section className="insight">
                <h3>
                  <Target size={17} />
                  问题
                </h3>
                <p>{selectedPaper.deconstruction.problem}</p>
              </section>
              <section className="insight">
                <h3>
                  <GitBranch size={17} />
                  方法
                </h3>
                <p>{selectedPaper.deconstruction.method}</p>
              </section>
            </div>

            <section className="full-band">
              <h3>
                <Zap size={17} />
                关键贡献
              </h3>
              <ul>
                {selectedPaper.deconstruction.contributions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="full-band">
              <h3>
                <FlaskConical size={17} />
                实验检查
              </h3>
              <div className="check-grid">
                {selectedPaper.deconstruction.experimentChecklist.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>

            <section className="code-panel">
              <div className="code-head">
                <div>
                  <h3>
                    <Code2 size={17} />
                    {selectedPaper.codeBlueprint.title}
                  </h3>
                  <p>{selectedPaper.codeBlueprint.note}</p>
                </div>
                <button onClick={copyCode} type="button">
                  <Copy size={16} />
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
              <pre>
                <code>{selectedPaper.codeBlueprint.code}</code>
              </pre>
            </section>
          </article>
        )}

        <aside className="trend-panel">
          <div className="section-title">
            <Sparkles size={18} />
            关键词热度
          </div>
          {topKeywords.map(([keyword, count]) => (
            <div className="trend" key={keyword}>
              <span>{keyword}</span>
              <div>
                <i style={{ width: `${Math.max(12, count * 18)}px` }} />
              </div>
              <b>{count}</b>
            </div>
          ))}
          {data.stats.errors.length > 0 && (
            <div className="warning">
              部分查询失败：{data.stats.errors.slice(0, 4).map((error) => `${error.track}/${error.source || "source"}`).join("、")}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;
